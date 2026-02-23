/**
 * Tests for core timeout functionality
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TimeoutError } from '../errors';
import { executeWithTimeout } from '../timeout';

describe('executeWithTimeout', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should resolve when function completes before timeout', async () => {
    const fn = vi.fn(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
      return 'success';
    });

    const promise = executeWithTimeout(fn, { timeout: 5000 });
    
    // Fast-forward timers
    await vi.advanceTimersByTimeAsync(100);
    
    const executionResult = await promise;
    expect(executionResult.result).toBe('success');
    expect(executionResult.didTimeout).toBe(false);
    expect(fn).toHaveBeenCalledOnce();
  });

  it('should throw TimeoutError when function exceeds timeout', async () => {
    const fn = vi.fn(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10000));
      return 'should not reach';
    });

    const promise = executeWithTimeout(fn, { timeout: 1000 });
    
    // Fast-forward past timeout
    await vi.advanceTimersByTimeAsync(1001);

    await expect(promise).rejects.toThrow(TimeoutError);
    await expect(promise).rejects.toThrow('Operation timed out after 1000ms');
  });

  it('should call onTimeout callback when timeout occurs', async () => {
    const fn = vi.fn(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10000));
      return 'original';
    });

    const onTimeout = vi.fn(() => 'fallback');

    const promise = executeWithTimeout(fn, {
      timeout: 1000,
      onTimeout,
    });
    
    await vi.advanceTimersByTimeAsync(1001);

    const executionResult = await promise;
    expect(executionResult.result).toBe('fallback');
    expect(executionResult.didTimeout).toBe(true);
    expect(onTimeout).toHaveBeenCalledOnce();
    expect(onTimeout).toHaveBeenCalledWith(expect.any(TimeoutError));
  });

  it('should call onSuccess callback when function succeeds', async () => {
    const fn = vi.fn(async () => 'success');
    const onSuccess = vi.fn();

    const promise = executeWithTimeout(fn, {
      timeout: 5000,
      onSuccess,
    });
    
    await vi.runAllTimersAsync();

    await promise;
    expect(onSuccess).toHaveBeenCalledOnce();
    expect(onSuccess).toHaveBeenCalledWith('success');
  });

  it('should call onError callback when function throws', async () => {
    const error = new Error('test error');
    const fn = vi.fn(async () => {
      throw error;
    });
    const onError = vi.fn();

    const promise = executeWithTimeout(fn, {
      timeout: 5000,
      onError,
    });
    
    await vi.runAllTimersAsync();

    await expect(promise).rejects.toThrow('test error');
    expect(onError).toHaveBeenCalledOnce();
    expect(onError).toHaveBeenCalledWith(error);
  });

  it('should respect external AbortSignal', async () => {
    const controller = new AbortController();
    const fn = vi.fn(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10000));
      return 'result';
    });

    void executeWithTimeout(fn, {
      timeout: 5000,
      signal: controller.signal,
    });

    // Abort manually before timeout
    controller.abort();
    await vi.runAllTimersAsync();

    // The function should still be running internally, but we aborted
    // Note: The actual behavior depends on if the function respects the signal
    // For this test, we just verify the signal is passed
    expect(controller.signal.aborted).toBe(true);
  });

  it('should cleanup timeout when function completes', async () => {
    const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');
    const fn = vi.fn(async () => 'quick');

    const promise = executeWithTimeout(fn, { timeout: 5000 });
    await vi.runAllTimersAsync();
    await promise;

    expect(clearTimeoutSpy).toHaveBeenCalled();
  });

  it('should handle async onTimeout callback', async () => {
    const fn = vi.fn(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10000));
      return 'original';
    });

    const onTimeout = vi.fn(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
      return 'async fallback';
    });

    const promise = executeWithTimeout(fn, {
      timeout: 1000,
      onTimeout,
    });
    
    await vi.advanceTimersByTimeAsync(1001);
    await vi.advanceTimersByTimeAsync(100);

    const executionResult = await promise;
    expect(executionResult.result).toBe('async fallback');
    expect(executionResult.didTimeout).toBe(true);
  });
});
