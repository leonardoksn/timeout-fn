/**
 * Backoff strategy utilities for retry logic
 */

import type { BackoffStrategy } from '../types';

/**
 * Maximum backoff duration in milliseconds (30 seconds)
 */
const MAX_BACKOFF_MS = 30000;

/**
 * Calculate the backoff delay for a given retry attempt
 *
 * @param attempt - The current retry attempt (1-indexed)
 * @param strategy - The backoff strategy to use
 * @returns Delay in milliseconds before next retry
 */
export function calculateBackoff(
  attempt: number,
  strategy: BackoffStrategy = 'linear'
): number {
  if (typeof strategy === 'function') {
    const delay = strategy(attempt);
    if (typeof delay !== 'number' || delay < 0 || !isFinite(delay)) {
      throw new Error(
        `Backoff function must return a positive finite number, got: ${delay}`
      );
    }
    return Math.min(delay, MAX_BACKOFF_MS);
  }

  switch (strategy) {
    case 'linear':
      // Linear: 1s, 2s, 3s, ...
      return Math.min(attempt * 1000, MAX_BACKOFF_MS);

    case 'exponential':
      // Exponential: 2s, 4s, 8s, 16s, 32s (capped at 30s)
      return Math.min(Math.pow(2, attempt) * 1000, MAX_BACKOFF_MS);

    default:
      throw new Error(`Unknown backoff strategy: ${strategy}`);
  }
}

/**
 * Wait/sleep for a specified number of milliseconds
 *
 * @param ms - Milliseconds to wait
 * @returns Promise that resolves after the delay
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
