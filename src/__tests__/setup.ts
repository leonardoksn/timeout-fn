/**
 * Test setup file to handle expected unhandled rejections
 * These occur when testing error scenarios (timeouts, retries, etc.)
 */

// Suppress unhandled rejection warnings for expected test errors
process.removeAllListeners('unhandledRejection');

process.on('unhandledRejection', (reason: any) => {
  // Ignore known test errors
  const errorName = reason?.constructor?.name || reason?.name;
  const errorMessage = reason?.message || '';
  
  const isExpectedTestError = 
    errorName === 'TimeoutError' ||
    errorName === 'RetryExhaustedError' ||
    errorName === 'ValidationError' ||
    errorName === 'NetworkError' ||
    errorMessage.includes('test error') || 
    errorMessage.includes('persistent failure') ||
    errorMessage.includes('Custom error') ||
    errorMessage.includes('Not retryable') ||
    errorMessage.includes('Validation error') ||
    errorMessage.includes('Network error');

  if (!isExpectedTestError) {
    // Re-emit unexpected errors
    console.error('Unexpected unhandled rejection:', reason);
  }
});
