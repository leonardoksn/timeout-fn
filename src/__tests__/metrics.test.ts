/**
 * Tests for metrics collection
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TimeoutError } from '../errors';
import { MetricsCollector } from '../metrics';

describe('MetricsCollector', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should collect metrics for successful execution', () => {
    const startTime = Date.now();
    const collector = new MetricsCollector(1);

    vi.advanceTimersByTime(250);
    collector.complete();

    const metrics = collector.collect();

    expect(metrics.startTime).toBe(startTime);
    expect(metrics.duration).toBe(250);
    expect(metrics.attempt).toBe(1);
    expect(metrics.timedOut).toBe(false);
    expect(metrics.error).toBeUndefined();
  });

  it('should collect metrics for failed execution', () => {
    const collector = new MetricsCollector(2);
    const error = new Error('test error');

    vi.advanceTimersByTime(100);
    collector.complete(error);

    const metrics = collector.collect();

    expect(metrics.duration).toBe(100);
    expect(metrics.attempt).toBe(2);
    expect(metrics.timedOut).toBe(false);
    expect(metrics.error).toBe(error);
  });

  it('should detect timeout errors', () => {
    const collector = new MetricsCollector(1);
    const timeoutError = new TimeoutError(5000);

    vi.advanceTimersByTime(5001);
    collector.complete(timeoutError);

    const metrics = collector.collect();

    expect(metrics.timedOut).toBe(true);
    expect(metrics.error).toBe(timeoutError);
    expect(metrics.duration).toBeGreaterThanOrEqual(5000);
  });

  it('should allow updating attempt number', () => {
    const collector = new MetricsCollector(1);
    
    collector.setAttempt(3);
    collector.complete();

    const metrics = collector.collect();
    expect(metrics.attempt).toBe(3);
  });

  it('should calculate duration correctly when collected before complete', () => {
    const startTime = Date.now();
    const collector = new MetricsCollector(1);

    vi.advanceTimersByTime(500);

    // Collect without calling complete
    const metrics = collector.collect();

    expect(metrics.startTime).toBe(startTime);
    expect(metrics.duration).toBeGreaterThanOrEqual(500);
    expect(metrics.timedOut).toBe(false);
  });
});
