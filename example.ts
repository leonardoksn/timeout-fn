/**
 * Example usage of timeout-fn library
 */

import { TimeoutError, withTimeout } from './src/index.js';

(async () => {
  // Example 1: Basic timeout
  console.log('Example 1: Basic timeout');
  const slowFunction = async (delay: number) => {
    await new Promise(resolve => setTimeout(resolve, delay));
    return 'Success!';
  };

  const safeFn = withTimeout(slowFunction, { timeout: 1000 });

  try {
    const result = await safeFn(500); // Should succeed
    console.log('✓ Result:', result);
  } catch (error) {
    console.error('✗ Error:', error);
  }

  try {
    await safeFn(2000); // Should timeout
  } catch (error) {
    if (error instanceof TimeoutError) {
      console.log('✓ Timeout caught correctly:', error.message);
    }
  }

  // Example 2: With fallback
  console.log('\nExample 2: With fallback on timeout');
  const fetchWithFallback = withTimeout(slowFunction, {
    timeout: 500,
    onTimeout: () => 'Fallback value',
  });

  const result2 = await fetchWithFallback(1000); // Will timeout but return fallback
  console.log('✓ Result with fallback:', result2);

  // Example 3: With retry
  console.log('\nExample 3: With retry');
  let attemptCount = 0;
  const unreliableFunction = async () => {
    attemptCount++;
    if (attemptCount < 3) {
      throw new Error(`Attempt ${attemptCount} failed`);
    }
    return 'Success after retries!';
  };

  const robustFn = withTimeout(unreliableFunction, {
    timeout: 1000,
    retry: {
      attempts: 3,
      backoff: 'exponential',
      onRetry: (attempt, error) => {
        console.log(`  Retry attempt ${attempt}: ${error.message}`);
      },
    },
  });

  const result3 = await robustFn();
  console.log('✓ Result after retries:', result3);

  // Example 4: With metrics
  console.log('\nExample 4: With metrics');
  const monitoredFn = withTimeout(slowFunction, {
    timeout: 2000,
    onMetrics: (metrics) => {
      console.log('✓ Metrics:', {
        duration: `${metrics.duration}ms`,
        timedOut: metrics.timedOut,
        attempt: metrics.attempt,
      });
    },
  });

  await monitoredFn(100);

  console.log('\n✅ All examples completed!');
})();
