/**
 * AbortController utilities for combining multiple abort signals
 */

/**
 * Creates an AbortController that aborts when any of the provided signals abort
 *
 * @param signals - Array of AbortSignals to combine
 * @returns A new AbortController that is linked to all input signals
 *
 * @example
 * ```ts
 * const manualController = new AbortController();
 * const timeoutController = new AbortController();
 * const combined = createLinkedAbortController([
 *   manualController.signal,
 *   timeoutController.signal
 * ]);
 *
 * // Aborting either will abort the combined controller
 * manualController.abort();
 * console.log(combined.signal.aborted); // true
 * ```
 */
export function createLinkedAbortController(
  signals: (AbortSignal | undefined)[]
): AbortController {
  const controller = new AbortController();

  // Filter out undefined signals
  const validSignals = signals.filter(
    (signal): signal is AbortSignal => signal !== undefined
  );

  // If any signal is already aborted, abort immediately
  for (const signal of validSignals) {
    if (signal.aborted) {
      controller.abort(signal.reason);
      return controller;
    }
  }

  // Create abort handler that will abort the controller
  const abortHandler = (event: Event) => {
    const target = event.target as AbortSignal;
    controller.abort(target.reason);
  };

  // Listen to all signals
  for (const signal of validSignals) {
    signal.addEventListener('abort', abortHandler, { once: true });
  }

  // Store cleanup function to remove listeners
  const cleanup = () => {
    for (const signal of validSignals) {
      signal.removeEventListener('abort', abortHandler);
    }
  };

  // Attach cleanup to the controller for later use if needed
  (controller as any)._cleanup = cleanup;

  return controller;
}

/**
 * Cleanup listeners from a linked AbortController created by createLinkedAbortController
 *
 * @param controller - The controller to cleanup
 */
export function cleanupLinkedAbortController(controller: AbortController): void {
  const cleanup = (controller as any)._cleanup;
  if (typeof cleanup === 'function') {
    cleanup();
  }
}
