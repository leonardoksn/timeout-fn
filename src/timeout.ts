/**
 * Core timeout logic for wrapping async functions
 */

import { TimeoutError } from './errors';
import type { TimeoutOptions } from './types';
import {
    cleanupLinkedAbortController,
    createLinkedAbortController,
} from './utils/abort';

/**
 * Execute a function with a timeout
 *
 * @param fn - The async function to execute
 * @param options - Timeout configuration options
 * @returns Promise that resolves with the function result or rejects on timeout
 *
 * @example
 * ```ts
 * const result = await executeWithTimeout(
 *   () => fetch('https://api.example.com'),
 *   { timeout: 5000 }
 * );
 * ```
 */
export async function executeWithTimeout<T>(
  fn: () => Promise<T>,
  options: TimeoutOptions<T>
): Promise<{ result: T; didTimeout: boolean }> {
  const { timeout, onTimeout, onSuccess, onError, signal } = options;

  // Create internal timeout controller
  const timeoutController = new AbortController();
  
  // Combine external signal (if any) with internal timeout signal
  const combinedController = createLinkedAbortController([
    signal,
    timeoutController.signal,
  ]);

  let timeoutId: NodeJS.Timeout | undefined;
  let didTimeout = false;

  try {
    // Race between the actual function and timeout
    const result = await Promise.race<T>([
      fn(),
      new Promise<T>((_, reject) => {
        timeoutId = setTimeout(() => {
          didTimeout = true;
          const error = new TimeoutError(timeout);
          timeoutController.abort(error);
          reject(error);
        }, timeout);
      }),
    ]);

    // Success callback
    if (onSuccess) {
      onSuccess(result);
    }

    return { result, didTimeout: false };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));

    // Check if this was a timeout error
    if (didTimeout && err instanceof TimeoutError) {
      if (onTimeout) {
        // Call timeout callback and return its result
        const fallbackResult = await onTimeout(err);
        return { result: fallbackResult, didTimeout: true };
      }
      // No timeout handler, re-throw
      throw err;
    }

    // Regular error (not timeout)
    if (onError) {
      onError(err);
    }

    throw err;
  } finally {
    // Cleanup: clear timeout and remove event listeners
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }
    cleanupLinkedAbortController(combinedController);
  }
}
