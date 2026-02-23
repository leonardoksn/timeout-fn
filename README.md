# timeout-fn

[![npm version](https://img.shields.io/npm/v/timeout-fn.svg)](https://www.npmjs.com/package/timeout-fn)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> TypeScript library for adding timeout to async functions with retry, cancellation, and metrics support

## Features

✨ **Simple API** - Wrap any async function with timeout behavior  
🔄 **Automatic Retry** - Built-in retry logic with exponential/linear backoff  
🚫 **Cancellation** - Manual cancellation via AbortController  
📊 **Metrics** - Track execution time, attempts, and failures  
🎯 **Type Safe** - Full TypeScript support with preserved function signatures  
🪶 **Zero Dependencies** - Lightweight and tree-shakeable  
📦 **Dual Package** - Supports both ESM and CommonJS

## Installation

```bash
npm install timeout-fn
```

```bash
yarn add timeout-fn
```

```bash
pnpm add timeout-fn
```

## Quick Start

```typescript
import { withTimeout } from 'timeout-fn';

// Wrap any async function
const safeFetch = withTimeout(fetch, { timeout: 5000 });

// Use it like the original function
const response = await safeFetch('https://api.example.com/data');
```

## Usage

### Basic Timeout

```typescript
import { withTimeout } from 'timeout-fn';

async function fetchUserData(userId: string) {
  const response = await fetch(`/api/users/${userId}`);
  return response.json();
}

// Add 3-second timeout
const safeFetchUser = withTimeout(fetchUserData, { timeout: 3000 });

try {
  const user = await safeFetchUser('123');
  console.log(user);
} catch (error) {
  if (error.name === 'TimeoutError') {
    console.log('Request timed out!');
  }
}
```

### Timeout with Fallback

```typescript
const fetchWithFallback = withTimeout(fetchUserData, {
  timeout: 3000,
  onTimeout: (error) => {
    console.log('Using cached data due to timeout');
    return { id: '123', name: 'Cached User' };
  }
});

// Will return fallback value on timeout instead of throwing
const user = await fetchWithFallback('123');
```

### Automatic Retry

```typescript
const robustFetch = withTimeout(fetchUserData, {
  timeout: 5000,
  retry: {
    attempts: 3,
    backoff: 'exponential', // or 'linear' or custom function
  }
});

// Will retry up to 3 times with exponential backoff
const user = await robustFetch('123');
```

### Conditional Retry

```typescript
const smartFetch = withTimeout(fetchUserData, {
  timeout: 5000,
  retry: {
    attempts: 3,
    backoff: 'exponential',
    // Only retry on network errors, not on 4xx errors
    retryIf: (error) => {
      return error.name === 'NetworkError' || error.name === 'TimeoutError';
    },
    onRetry: (attempt, error) => {
      console.log(`Retry attempt ${attempt} after error:`, error.message);
    }
  }
});
```

### Custom Backoff Strategy

```typescript
const customBackoff = withTimeout(fetchUserData, {
  timeout: 5000,
  retry: {
    attempts: 5,
    // Custom backoff: 100ms, 200ms, 400ms, 800ms, 1600ms
    backoff: (attempt) => Math.pow(2, attempt - 1) * 100,
  }
});
```

### Manual Cancellation

```typescript
const controller = new AbortController();

const cancellableFetch = withTimeout(fetchUserData, {
  timeout: 10000,
  signal: controller.signal,
});

// Start the request
const promise = cancellableFetch('123');

// Cancel it manually if needed
setTimeout(() => controller.abort(), 2000);

try {
  const user = await promise;
} catch (error) {
  console.log('Request was cancelled');
}
```

### Execution Metrics

```typescript
const monitoredFetch = withTimeout(fetchUserData, {
  timeout: 5000,
  retry: { attempts: 3 },
  onMetrics: (metrics) => {
    console.log({
      duration: metrics.duration,
      attempt: metrics.attempt,
      timedOut: metrics.timedOut,
      success: !metrics.error
    });
    
    // Send to your monitoring service
    analytics.track('api_call', metrics);
  }
});
```

### Success and Error Callbacks

```typescript
const verboseFetch = withTimeout(fetchUserData, {
  timeout: 5000,
  onSuccess: (result) => {
    console.log('✅ Request succeeded:', result);
  },
  onError: (error) => {
    console.error('❌ Request failed:', error);
  },
  onTimeout: (error) => {
    console.warn('⏱️ Request timed out');
    return null; // fallback value
  }
});
```

### Complete Example

```typescript
import { withTimeout, TimeoutError, RetryExhaustedError } from 'timeout-fn';

// Configure a robust API client
const apiCall = withTimeout(
  async (endpoint: string, options?: RequestInit) => {
    const response = await fetch(`https://api.example.com${endpoint}`, options);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return response.json();
  },
  {
    timeout: 10000,
    retry: {
      attempts: 3,
      backoff: 'exponential',
      retryIf: (error) => {
        // Retry on timeout or network errors, but not on 4xx client errors
        if (error.name === 'TimeoutError') return true;
        if (error.message.startsWith('HTTP 4')) return false;
        return true;
      },
      onRetry: (attempt, error) => {
        logger.warn(`Retry attempt ${attempt}:`, error.message);
      }
    },
    onSuccess: (data) => {
      logger.info('API call succeeded');
    },
    onError: (error) => {
      logger.error('API call failed:', error);
    },
    onMetrics: (metrics) => {
      analytics.track('api_call', {
        duration: metrics.duration,
        attempts: metrics.attempt,
        success: !metrics.error,
        timedOut: metrics.timedOut
      });
    }
  }
);

// Use it
try {
  const data = await apiCall('/users/123');
  console.log(data);
} catch (error) {
  if (error instanceof TimeoutError) {
    console.error('Request timed out after all retries');
  } else if (error instanceof RetryExhaustedError) {
    console.error('All retry attempts failed');
  } else {
    console.error('Request failed:', error);
  }
}
```

## API Reference

### `withTimeout<F>(fn: F, options: WithTimeoutOptions): TimeoutWrapper<F>`

Wraps an async function with timeout, retry, and monitoring capabilities.

#### Options

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `timeout` | `number` | ✅ | Timeout duration in milliseconds |
| `onTimeout` | `(error: TimeoutError) => T \| Promise<T>` | ❌ | Callback when timeout occurs. Can return fallback value. |
| `onSuccess` | `(result: T) => void` | ❌ | Callback when function succeeds |
| `onError` | `(error: Error) => void` | ❌ | Callback when function throws (not timeout) |
| `signal` | `AbortSignal` | ❌ | External abort signal for manual cancellation |
| `retry` | `RetryOptions` | ❌ | Retry configuration |
| `onMetrics` | `(metrics: ExecutionMetrics) => void` | ❌ | Callback to receive execution metrics |

#### RetryOptions

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `attempts` | `number` | - | Maximum retry attempts (not including initial) |
| `backoff` | `'linear' \| 'exponential' \| (attempt: number) => number` | `'linear'` | Backoff strategy |
| `retryIf` | `(error: Error) => boolean` | `() => true` | Predicate to determine if error should trigger retry |
| `onRetry` | `(attempt: number, error: Error) => void` | - | Callback before each retry |

#### ExecutionMetrics

```typescript
interface ExecutionMetrics {
  startTime: number;      // Timestamp when execution started
  endTime: number;        // Timestamp when execution ended
  duration: number;       // Total duration in milliseconds
  attempt: number;        // Which attempt this was (1-indexed)
  timedOut: boolean;      // Whether execution timed out
  error?: Error;          // Error that occurred, if any
}
```

### Errors

#### `TimeoutError`

Thrown when a function execution exceeds the timeout duration.

```typescript
class TimeoutError extends Error {
  timeout: number;  // The timeout that was exceeded
}
```

#### `RetryExhaustedError`

Thrown when all retry attempts have been exhausted.

```typescript
class RetryExhaustedError extends Error {
  attempts: number;   // Number of attempts made
  lastError: Error;   // The last error before giving up
}
```

## How It Works

### Timeout Mechanism

Uses `Promise.race()` to race the original promise against a timeout promise. When timeout occurs, an `AbortController` is triggered to signal cancellation.

### Retry Logic

On failure, the library:
1. Checks if error qualifies for retry using `retryIf` predicate
2. Calculates backoff delay using the specified strategy
3. Waits for the backoff period
4. Retries the function
5. Repeats until success or max attempts reached

### Backoff Strategies

- **Linear**: `attempt × 1000ms` (1s, 2s, 3s, ...)
- **Exponential**: `2^attempt × 1000ms` (2s, 4s, 8s, ..., max 30s)
- **Custom**: Provide your own function `(attempt: number) => number`

## TypeScript Support

This library is written in TypeScript and provides full type safety:

```typescript
// Function signature is preserved
async function fetchUser(id: string): Promise<User> { ... }

const wrapped = withTimeout(fetchUser, { timeout: 5000 });

// TypeScript knows the signature
const user: User = await wrapped('123'); // ✅ Correct
const user: User = await wrapped(123);   // ❌ Type error
```

## Requirements

- Node.js >= 16.0.0
- TypeScript >= 5.0 (for TypeScript users)

## License

MIT © [Your Name]

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Related Projects

- [p-timeout](https://github.com/sindresorhus/p-timeout) - Timeout a promise
- [promise-retry](https://github.com/IndigoUnited/node-promise-retry) - Retry promises
- [abort-controller](https://github.com/mysticatea/abort-controller) - AbortController polyfill
