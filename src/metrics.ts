/**
 * Metrics collection for tracking function execution
 */

import { TimeoutError } from './errors';
import type { ExecutionMetrics } from './types';

/**
 * Collector for execution metrics
 */
export class MetricsCollector {
  private startTime: number;
  private endTime: number = 0;
  private attempt: number;
  private timedOut: boolean = false;
  private error?: Error;

  constructor(attempt: number = 1) {
    this.startTime = Date.now();
    this.attempt = attempt;
  }

  /**
   * Mark execution as completed with optional error
   */
  complete(error?: Error, didTimeout?: boolean): void {
    this.endTime = Date.now();
    this.error = error;
    // If didTimeout is explicitly provided, use it; otherwise detect from error
    this.timedOut = didTimeout !== undefined ? didTimeout : error instanceof TimeoutError;
  }

  /**
   * Update the current attempt number
   */
  setAttempt(attempt: number): void {
    this.attempt = attempt;
  }

  /**
   * Collect and return execution metrics
   */
  collect(): ExecutionMetrics {
    const endTime = this.endTime || Date.now();
    return {
      startTime: this.startTime,
      endTime,
      duration: endTime - this.startTime,
      attempt: this.attempt,
      timedOut: this.timedOut,
      error: this.error,
    };
  }
}
