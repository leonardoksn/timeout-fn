/**
 * Custom error classes for timeout-fn library
 */

/**
 * Error thrown when a function execution exceeds the timeout duration
 */
export class TimeoutError extends Error {
  /**
   * The timeout duration that was exceeded (in milliseconds)
   */
  public readonly timeout: number;

  constructor(timeout: number) {
    super(`Operation timed out after ${timeout}ms`);
    this.name = 'TimeoutError';
    this.timeout = timeout;

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, TimeoutError);
    }
  }
}

/**
 * Error thrown when all retry attempts have been exhausted
 */
export class RetryExhaustedError extends Error {
  /**
   * Number of attempts that were made
   */
  public readonly attempts: number;

  /**
   * The last error that occurred before giving up
   */
  public readonly lastError: Error;

  constructor(attempts: number, lastError: Error) {
    super(`All ${attempts} retry attempts exhausted. Last error: ${lastError.message}`);
    this.name = 'RetryExhaustedError';
    this.attempts = attempts;
    this.lastError = lastError;

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, RetryExhaustedError);
    }
  }
}
