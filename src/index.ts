/**
 * timeout-fn - TypeScript library for adding timeout to async functions
 * with retry, cancellation, and metrics support
 */

import { MetricsCollector } from './metrics';
import { executeWithRetry } from './retry';
import { executeWithTimeout } from './timeout';
import type {
    AsyncFunction,
    TimeoutWrapper,
    WithTimeoutOptions,
} from './types';

// Re-export types and errors for convenient imports
export * from './errors';
export * from './types';

/**
 * Wrap an async function with timeout, retry, and metrics capabilities
 *
 * @param fn - The async function to wrap
 * @param options - Configuration options for timeout, retry, and metrics
 * @returns A wrapped function with the same signature that adds timeout/retry behavior
 *
 * @example
 * Basic timeout:
 * ```ts
 * const safeFetch = withTimeout(fetch, { timeout: 5000 });
 * const response = await safeFetch('https://api.example.com');
 * ```
 *
 * @example
 * With fallback on timeout:
 * ```ts
 * const fetchWithFallback = withTimeout(fetchData, {
 *   timeout: 3000,
 *   onTimeout: () => ({ data: 'cached' })
 * });
 * ```
 *
 * @example
 * With retry and exponential backoff:
 * ```ts
 * const robustFetch = withTimeout(fetch, {
 *   timeout: 5000,
 *   retry: {
 *     attempts: 3,
 *     backoff: 'exponential',
 *     retryIf: (err) => err.name === 'NetworkError'
 *   }
 * });
 * ```
 *
 * @example
 * With metrics and manual cancellation:
 * ```ts
 * const controller = new AbortController();
 * const monitoredFetch = withTimeout(fetch, {
 *   timeout: 10000,
 *   signal: controller.signal,
 *   onMetrics: (metrics) => {
 *     console.log(`Took ${metrics.duration}ms, attempt ${metrics.attempt}`);
 *   }
 * });
 * ```
 */
export function withTimeout<F extends AsyncFunction>(
  fn: F,
  options: WithTimeoutOptions<Awaited<ReturnType<F>>>
): TimeoutWrapper<F> {
  const { retry, onMetrics, ...timeoutOptions } = options;

  return ((...args: Parameters<F>) => {
    const metricsCollector = new MetricsCollector();

    const executeFunction = async (): Promise<Awaited<ReturnType<F>>> => {
      let didTimeout = false;
      try {
        let result: Awaited<ReturnType<F>>;

        if (retry) {
          // Execute with retry logic
          const executionResult = await executeWithRetry(
            () => fn(...args),
            retry,
            timeoutOptions
          );
          result = executionResult.result;
          didTimeout = executionResult.didTimeout;
        } else {
          // Execute with timeout only
          const executionResult = await executeWithTimeout(() => fn(...args), timeoutOptions);
          result = executionResult.result;
          didTimeout = executionResult.didTimeout;
        }

        metricsCollector.complete(undefined, didTimeout);
        return result;
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        metricsCollector.complete(err, didTimeout);
        throw err;
      } finally {
        // Report metrics if callback provided
        if (onMetrics) {
          onMetrics(metricsCollector.collect());
        }
      }
    };

    return executeFunction();
  }) as TimeoutWrapper<F>;
}
