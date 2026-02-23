/**
 * Tests for retry functionality
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RetryExhaustedError, TimeoutError } from '../errors';
import { executeWithRetry } from '../retry';

describe('executeWithRetry', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should succeed on first attempt if function succeeds', async () => {
    const fn = vi.fn(async () => 'success');

    const promise = executeWithRetry(
      fn,
      { attempts: 3 },
      { timeout: 5000 }
    );
    
    await vi.runAllTimersAsync();

    const executionResult = await promise;
    expect(executionResult.result).toBe('success');
    expect(fn).toHaveBeenCalledOnce();
  });

  it('should retry on failure and eventually succeed', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('fail 1'))
      .mockRejectedValueOnce(new Error('fail 2'))
      .mockResolvedValueOnce('success');

    const promise = executeWithRetry(
      fn,
      { attempts: 3, backoff: 'linear' },
      { timeout: 5000 }
    );
    
    // Fast-forward through all retries and backoff delays
    await vi.runAllTimersAsync();

    const executionResult = await promise;
    expect(executionResult.result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('should throw RetryExhaustedError when all attempts fail', async () => {
    const error = new Error('persistent failure');
    const fn = vi.fn(async () => {
      throw error;
    });

    const promise = executeWithRetry(
      fn,
      { attempts: 2 },
      { timeout: 5000 }
    );
    
    await vi.runAllTimersAsync();

    await expect(promise).rejects.toThrow(RetryExhaustedError);
    await expect(promise).rejects.toThrow('All 3 retry attempts exhausted');
    expect(fn).toHaveBeenCalledTimes(3); // initial + 2 retries
  });

  it('should use linear backoff strategy', async () => {
    const fn = vi.fn(async () => {
      throw new Error('fail');
    });

    const promise = executeWithRetry(
      fn,
      { attempts: 2, backoff: 'linear' },
      { timeout: 5000 }
    );

    // First attempt fails immediately
    await vi.runAllTimersAsync();
    
    // Should wait 1000ms (attempt 1 * 1000) before retry
    // Then fail and wait 2000ms (attempt 2 * 1000) before second retry
    
    await expect(promise).rejects.toThrow(RetryExhaustedError);
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('should use exponential backoff strategy', async () => {
    const fn = vi.fn(async () => {
      throw new Error('fail');
    });

    const promise = executeWithRetry(
      fn,
      { attempts: 2, backoff: 'exponential' },
      { timeout: 5000 }
    );

    await vi.runAllTimersAsync();

    // Should wait 2^1 * 1000 = 2000ms, then 2^2 * 1000 = 4000ms
    await expect(promise).rejects.toThrow(RetryExhaustedError);
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('should use custom backoff function', async () => {
    const fn = vi.fn(async () => {
      throw new Error('fail');
    });

    const backoffFn = vi.fn((attempt: number) => attempt * 500);

    const promise = executeWithRetry(
      fn,
      { attempts: 2, backoff: backoffFn },
      { timeout: 5000 }
    );

    await vi.runAllTimersAsync();

    await expect(promise).rejects.toThrow(RetryExhaustedError);
    expect(backoffFn).toHaveBeenCalled();
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('should call onRetry callback before each retry', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('fail 1'))
      .mockRejectedValueOnce(new Error('fail 2'))
      .mockResolvedValueOnce('success');

    const onRetry = vi.fn();

    const promise = executeWithRetry(
      fn,
      { attempts: 3, onRetry },
      { timeout: 5000 }
    );

    await vi.runAllTimersAsync();

    await promise;
    expect(onRetry).toHaveBeenCalledTimes(2); // Called before 2nd and 3rd attempts
    expect(onRetry).toHaveBeenNthCalledWith(1, 1, expect.any(Error));
    expect(onRetry).toHaveBeenNthCalledWith(2, 2, expect.any(Error));
  });

  it('should respect retryIf predicate', async () => {
    const networkError = new Error('Network error');
    (networkError as any).name = 'NetworkError';
    
    const validationError = new Error('Validation error');
    (validationError as any).name = 'ValidationError';

    const fn = vi
      .fn()
      .mockRejectedValueOnce(networkError)
      .mockRejectedValueOnce(validationError);

    const retryIf = vi.fn((error: Error) => error.name === 'NetworkError');

    const promise = executeWithRetry(
      fn,
      { attempts: 3, retryIf },
      { timeout: 5000 }
    );

    await vi.runAllTimersAsync();

    // Should retry after network error, then hit validation error and stop
    await expect(promise).rejects.toThrow('Validation error');
    expect(fn).toHaveBeenCalledTimes(2);
    expect(retryIf).toHaveBeenCalledTimes(2);
  });

  it('should handle timeout during retry', async () => {
    const fn = vi.fn(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10000));
      return 'should timeout';
    });

    const promise = executeWithRetry(
      fn,
      { attempts: 2 },
      { timeout: 1000 }
    );

    // First attempt times out
    await vi.advanceTimersByTimeAsync(1001);
    
    // Wait for backoff
    await vi.advanceTimersByTimeAsync(1000);
    
    // Second attempt times out
    await vi.advanceTimersByTimeAsync(1001);
    
    // Wait for backoff
    await vi.advanceTimersByTimeAsync(2000);
    
    // Third attempt times out
    await vi.advanceTimersByTimeAsync(1001);

    await expect(promise).rejects.toThrow(RetryExhaustedError);
    
    try {
      await promise;
    } catch (error) {
      if (error instanceof RetryExhaustedError) {
        expect(error.lastError).toBeInstanceOf(TimeoutError);
      }
    }
  });
});
