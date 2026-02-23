/**
 * Retry logic for executing functions with automatic retry on failure
 */

import { RetryExhaustedError } from './errors';
import { executeWithTimeout } from './timeout';
import type { RetryOptions, TimeoutOptions } from './types';
import { calculateBackoff, sleep } from './utils/backoff';

/**
 * Execute a function with retry logic and timeout
 *
 * @param fn - The async function to execute
 * @param retryOptions - Retry configuration
 * @param timeoutOptions - Timeout configuration
 * @returns Promise that resolves with the function result
 * @throws {RetryExhaustedError} When all retry attempts are exhausted
 *
 * @example
 * ```ts
 * const result = await executeWithRetry(
 *   () => fetch('https://api.example.com'),
 *   { attempts: 3, backoff: 'exponential' },
 *   { timeout: 5000 }
 * );
 * ```
 */
export async function executeWithRetry<T>(
  fn: () => Promise<T>,
  retryOptions: RetryOptions,
  timeoutOptions: TimeoutOptions<T>
): Promise<{ result: T; didTimeout: boolean }> {
  const {
    attempts,
    backoff = 'linear',
    retryIf = () => true,
    onRetry,
  } = retryOptions;

  let lastError: Error | undefined;
  let currentAttempt = 0;

  // Total attempts = initial attempt + retry attempts
  const totalAttempts = attempts + 1;

  while (currentAttempt < totalAttempts) {
    currentAttempt++;

    try {
      // Execute with timeout
      const executionResult = await executeWithTimeout(fn, timeoutOptions);
      return executionResult;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      lastError = err;

      // Check if we should retry
      const shouldRetry = currentAttempt < totalAttempts && retryIf(err);

      if (!shouldRetry) {
        // No more retries or error doesn't qualify for retry
        if (currentAttempt >= totalAttempts) {
          throw new RetryExhaustedError(currentAttempt, err);
        }
        // Error doesn't qualify for retry, throw original error
        throw err;
      }

      // Call retry callback if provided
      if (onRetry) {
        onRetry(currentAttempt, err);
      }

      // Calculate and wait for backoff delay before next attempt
      const delay = calculateBackoff(currentAttempt, backoff);
      await sleep(delay);
    }
  }

  // Should never reach here, but TypeScript needs it
  throw new RetryExhaustedError(
    currentAttempt,
    lastError || new Error('Unknown error')
  );
}
