/**
 * Type definitions for timeout-fn library
 */

/**
 * Any async function type
 */
export type AsyncFunction = (...args: any[]) => Promise<any>;

/**
 * Backoff strategy for retry attempts
 */
export type BackoffStrategy = 'linear' | 'exponential' | ((attempt: number) => number);

/**
 * Configuration options for timeout behavior
 */
export interface TimeoutOptions<T = any> {
  /**
   * Timeout duration in milliseconds
   */
  timeout: number;

  /**
   * Callback invoked when timeout occurs. Can return a fallback value.
   * If not provided, a TimeoutError will be thrown.
   */
  onTimeout?: (error: Error) => T | Promise<T>;

  /**
   * Callback invoked when the function completes successfully
   */
  onSuccess?: (result: T) => void;

  /**
   * Callback invoked when the function throws an error (not timeout)
   */
  onError?: (error: Error) => void;

  /**
   * External AbortSignal for manual cancellation
   */
  signal?: AbortSignal;
}

/**
 * Configuration options for retry behavior
 */
export interface RetryOptions {
  /**
   * Maximum number of retry attempts (not including initial attempt)
   */
  attempts: number;

  /**
   * Backoff strategy between retries
   * - 'linear': attempt * 1000ms
   * - 'exponential': 2^attempt * 1000ms (capped at 30s)
   * - function: custom backoff calculator
   * @default 'linear'
   */
  backoff?: BackoffStrategy;

  /**
   * Predicate to determine if error should trigger a retry
   * @default () => true (retry all errors)
   */
  retryIf?: (error: Error) => boolean;

  /**
   * Callback invoked before each retry attempt
   */
  onRetry?: (attempt: number, error: Error) => void;
}

/**
 * Execution metrics collected during function execution
 */
export interface ExecutionMetrics {
  /**
   * Timestamp when execution started (ms since epoch)
   */
  startTime: number;

  /**
   * Timestamp when execution ended (ms since epoch)
   */
  endTime: number;

  /**
   * Total execution duration in milliseconds
   */
  duration: number;

  /**
   * Which attempt this was (1-indexed, includes retries)
   */
  attempt: number;

  /**
   * Whether execution was terminated by timeout
   */
  timedOut: boolean;

  /**
   * Error that occurred, if any
   */
  error?: Error;
}

/**
 * Callback type for receiving execution metrics
 */
export type MetricsCallback = (metrics: ExecutionMetrics) => void;

/**
 * Wrapper function type that preserves original function signature
 * but returns Promise<Awaited<ReturnType<F>>>
 */
export type TimeoutWrapper<F extends AsyncFunction> = (
  ...args: Parameters<F>
) => Promise<Awaited<ReturnType<F>>>;

/**
 * Combined options for withTimeout function
 */
export interface WithTimeoutOptions<T = any> extends TimeoutOptions<T> {
  /**
   * Retry configuration
   */
  retry?: RetryOptions;

  /**
   * Callback to receive execution metrics
   */
  onMetrics?: MetricsCallback;
}
