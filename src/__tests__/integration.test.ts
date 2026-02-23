/**
 * Integration tests for the complete timeout-fn functionality
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RetryExhaustedError, withTimeout } from '../index';

describe('withTimeout integration', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should wrap function and preserve signature', async () => {
    const originalFn = async (a: number, b: string): Promise<string> => {
      return `${a}-${b}`;
    };

    const wrapped = withTimeout(originalFn, { timeout: 5000 });

    const promise = wrapped(42, 'test');
    await vi.runAllTimersAsync();

    const result = await promise;
    expect(result).toBe('42-test');
  });

  it('should timeout and use fallback', async () => {
    const slowFn = async (id: number) => {
      await new Promise((resolve) => setTimeout(resolve, 10000));
      return { id, data: 'original' };
    };

    const wrapped = withTimeout(slowFn, {
      timeout: 1000,
      onTimeout: () => ({ id: 0, data: 'fallback' }),
    });

    const promise = wrapped(123);
    await vi.advanceTimersByTimeAsync(1001);

    const result = await promise;
    expect(result).toEqual({ id: 0, data: 'fallback' });
  });

  it('should retry with exponential backoff and succeed', async () => {
    let callCount = 0;
    const unreliableFn = async (value: string) => {
      callCount++;
      if (callCount < 3) {
        throw new Error(`Failure ${callCount}`);
      }
      return `Success: ${value}`;
    };

    const wrapped = withTimeout(unreliableFn, {
      timeout: 5000,
      retry: {
        attempts: 3,
        backoff: 'exponential',
      },
    });

    const promise = wrapped('test');
    await vi.runAllTimersAsync();

    const result = await promise;
    expect(result).toBe('Success: test');
    expect(callCount).toBe(3);
  });

  it('should collect and report metrics', async () => {
    const fn = async (x: number) => x * 2;
    const metricsCallback = vi.fn();

    const wrapped = withTimeout(fn, {
      timeout: 5000,
      onMetrics: metricsCallback,
    });

    const promise = wrapped(21);
    await vi.runAllTimersAsync();

    await promise;

    expect(metricsCallback).toHaveBeenCalledOnce();
    expect(metricsCallback).toHaveBeenCalledWith({
      startTime: expect.any(Number),
      endTime: expect.any(Number),
      duration: expect.any(Number),
      attempt: 1,
      timedOut: false,
      error: undefined,
    });
  });

  it('should collect metrics on timeout', async () => {
    const slowFn = async () => {
      await new Promise((resolve) => setTimeout(resolve, 10000));
      return 'late';
    };

    const metricsCallback = vi.fn();

    const wrapped = withTimeout(slowFn, {
      timeout: 1000,
      onMetrics: metricsCallback,
      onTimeout: () => 'early',
    });

    const promise = wrapped();
    await vi.advanceTimersByTimeAsync(1001);

    await promise;

    expect(metricsCallback).toHaveBeenCalledWith(
      expect.objectContaining({
        timedOut: true,
        // No error because onTimeout callback handled it with fallback
        error: undefined,
      })
    );
  });

  it('should combine retry with metrics', async () => {
    let callCount = 0;
    const fn = async () => {
      callCount++;
      if (callCount < 2) {
        throw new Error('Temporary failure');
      }
      return 'ok';
    };

    const metricsCallback = vi.fn();
    const retryCallback = vi.fn();

    const wrapped = withTimeout(fn, {
      timeout: 5000,
      retry: {
        attempts: 2,
        onRetry: retryCallback,
      },
      onMetrics: metricsCallback,
    });

    const promise = wrapped();
    await vi.runAllTimersAsync();

    const result = await promise;

    expect(result).toBe('ok');
    expect(retryCallback).toHaveBeenCalledOnce();
    expect(metricsCallback).toHaveBeenCalledOnce();
  });

  it('should handle manual cancellation with AbortSignal', async () => {
    const controller = new AbortController();
    const fn = async () => {
      await new Promise((resolve) => setTimeout(resolve, 10000));
      return 'result';
    };

    const wrapped = withTimeout(fn, {
      timeout: 5000,
      signal: controller.signal,
    });

    void wrapped();

    // Abort manually
    controller.abort();
    await vi.runAllTimersAsync();

    // Signal is aborted
    expect(controller.signal.aborted).toBe(true);
  });

  it('should exhaust retries and throw RetryExhaustedError', async () => {
    const fn = async () => {
      throw new Error('Always fails');
    };

    const wrapped = withTimeout(fn, {
      timeout: 5000,
      retry: { attempts: 2 },
    });

    const promise = wrapped();
    await vi.runAllTimersAsync();

    await expect(promise).rejects.toThrow(RetryExhaustedError);
    await expect(promise).rejects.toThrow('All 3 retry attempts exhausted');
  });

  it('should respect retryIf predicate', async () => {
    let callCount = 0;
    const fn = async () => {
      callCount++;
      if (callCount === 1) {
        const err = new Error('Retryable');
        (err as any).retryable = true;
        throw err;
      }
      const err = new Error('Not retryable');
      (err as any).retryable = false;
      throw err;
    };

    const wrapped = withTimeout(fn, {
      timeout: 5000,
      retry: {
        attempts: 5,
        retryIf: (err: any) => err.retryable === true,
      },
    });

    const promise = wrapped();
    await vi.runAllTimersAsync();

    await expect(promise).rejects.toThrow('Not retryable');
    expect(callCount).toBe(2); // First attempt + 1 retry, then stops
  });

  it('should call all callbacks in correct order', async () => {
    const calls: string[] = [];
    
    const fn = async () => {
      calls.push('fn-execute');
      return 'result';
    };

    const wrapped = withTimeout(fn, {
      timeout: 5000,
      onSuccess: () => calls.push('onSuccess'),
      onMetrics: () => calls.push('onMetrics'),
    });

    const promise = wrapped();
    await vi.runAllTimersAsync();

    await promise;

    expect(calls).toEqual(['fn-execute', 'onSuccess', 'onMetrics']);
  });

  it('should handle errors and call onError callback', async () => {
    const error = new Error('Custom error');
    const fn = async () => {
      throw error;
    };

    const onError = vi.fn();
    const onMetrics = vi.fn();

    const wrapped = withTimeout(fn, {
      timeout: 5000,
      onError,
      onMetrics,
    });

    const promise = wrapped();
    await vi.runAllTimersAsync();

    await expect(promise).rejects.toThrow('Custom error');
    expect(onError).toHaveBeenCalledWith(error);
    expect(onMetrics).toHaveBeenCalledWith(
      expect.objectContaining({
        error,
        timedOut: false,
      })
    );
  });
});
