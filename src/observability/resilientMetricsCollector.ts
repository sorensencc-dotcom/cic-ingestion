import { HardeningRegistry } from "../resilience/hardeningOrchestrator";
import { CircuitBreakerRegistry } from "../resilience/circuitBreaker";
import { RateLimiterRegistry } from "../resilience/rateLimiter";

export interface ResilientMetricsSnapshot {
  timestamp: number;
  providers: Record<string, ProviderMetrics>;
  summary: {
    totalRequests: number;
    totalErrors: number;
    avgLatencyMs: number;
    circuitBreakerOpenCount: number;
    rateLimitedCount: number;
  };
}

export interface ProviderMetrics {
  name: string;
  state: "healthy" | "degraded" | "failing";
  circuitBreaker: {
    state: string;
    consecutiveFailures: number;
    failureRate: number;
  };
  rateLimiter: {
    tokensAvailable: number;
    rejectionRate: number;
    requestsPerSecond: number;
  };
  fallback: {
    hasProviders: boolean;
    providerStates: Record<string, string>;
    totalAttempts: number;
    successProvider?: string;
  };
  performance: {
    totalRequests: number;
    successCount: number;
    failureCount: number;
    avgLatencyMs: number;
  };
}

/**
 * Collect metrics from all hardening orchestrators.
 * Export to observability stack (Prometheus, DataDog, etc).
 */
export class ResilientMetricsCollector {
  private hardeningRegistry: HardeningRegistry;
  private circuitBreakerRegistry: CircuitBreakerRegistry;
  private rateLimiterRegistry: RateLimiterRegistry;
  private providerLatencies: Map<string, number[]> = new Map();

  constructor(
    hardeningRegistry: HardeningRegistry,
    circuitBreakerRegistry: CircuitBreakerRegistry,
    rateLimiterRegistry: RateLimiterRegistry
  ) {
    this.hardeningRegistry = hardeningRegistry;
    this.circuitBreakerRegistry = circuitBreakerRegistry;
    this.rateLimiterRegistry = rateLimiterRegistry;
  }

  /**
   * Record latency for a provider (called after each request).
   */
  recordLatency(providerName: string, latencyMs: number): void {
    if (!this.providerLatencies.has(providerName)) {
      this.providerLatencies.set(providerName, []);
    }
    const latencies = this.providerLatencies.get(providerName)!;
    latencies.push(latencyMs);
    // Keep last 1000 latencies
    if (latencies.length > 1000) {
      latencies.shift();
    }
  }

  /**
   * Get current metrics snapshot.
   */
  getSnapshot(): ResilientMetricsSnapshot {
    const hardeningMetrics = this.hardeningRegistry.getAllMetrics();
    const providerMetrics: Record<string, ProviderMetrics> = {};

    let totalRequests = 0;
    let totalErrors = 0;
    let cbOpenCount = 0;
    let rlRejectedCount = 0;
    const latencies: number[] = [];

    // Add orchestrator metrics
    for (const [providerName, metrics] of Object.entries(hardeningMetrics)) {
      const cbState = metrics.circuitBreaker.state;
      const cbMetrics = metrics.circuitBreaker;
      const rlMetrics = metrics.rateLimiter;
      const failureRate = cbMetrics.failureRate;

      let state: "healthy" | "degraded" | "failing" = "healthy";
      if (cbState === "OPEN") {
        state = "failing";
        cbOpenCount++;
      } else if (failureRate > 0.1 || rlMetrics.rejection_rate > 0.05) {
        state = "degraded";
      }

      totalRequests += cbMetrics.totalRequests;
      totalErrors += cbMetrics.failureCount;
      rlRejectedCount += rlMetrics.rejected;

      const providerLatencies = this.providerLatencies.get(providerName) || [];
      const avgLatency =
        providerLatencies.length > 0
          ? providerLatencies.reduce((a, b) => a + b, 0) / providerLatencies.length
          : 0;
      if (providerLatencies.length > 0) {
        latencies.push(...providerLatencies);
      }

      const fbMetrics = metrics.fallback;
      const hasProviders = Object.keys(fbMetrics.providerStates || {}).length > 0;

      providerMetrics[providerName] = {
        name: providerName,
        state,
        circuitBreaker: {
          state: cbState,
          consecutiveFailures: cbMetrics.consecutiveFailures,
          failureRate: cbMetrics.failureRate,
        },
        rateLimiter: {
          tokensAvailable: rlMetrics.tokensAvailable,
          rejectionRate: rlMetrics.rejection_rate,
          requestsPerSecond: rlMetrics.requestsPerSecond,
        },
        fallback: {
          hasProviders,
          providerStates: fbMetrics.providerStates || {},
          totalAttempts: fbMetrics.totalAttempts || 0,
          successProvider: fbMetrics.successProvider,
        },
        performance: {
          totalRequests: cbMetrics.totalRequests,
          successCount: cbMetrics.successCount,
          failureCount: cbMetrics.failureCount,
          avgLatencyMs: avgLatency,
        },
      };
    }

    // Add tracked latencies that don't have orchestrators
    for (const [providerName, latencyList] of this.providerLatencies.entries()) {
      if (!providerMetrics[providerName]) {
        const avgLatency =
          latencyList.length > 0
            ? latencyList.reduce((a, b) => a + b, 0) / latencyList.length
            : 0;
        if (latencyList.length > 0) {
          latencies.push(...latencyList);
        }

        providerMetrics[providerName] = {
          name: providerName,
          state: "healthy",
          circuitBreaker: {
            state: "CLOSED",
            consecutiveFailures: 0,
            failureRate: 0,
          },
          rateLimiter: {
            tokensAvailable: 0,
            rejectionRate: 0,
            requestsPerSecond: 0,
          },
          fallback: {
            hasProviders: false,
            providerStates: {},
            totalAttempts: 0,
          },
          performance: {
            totalRequests: 0,
            successCount: 0,
            failureCount: 0,
            avgLatencyMs: avgLatency,
          },
        };
      }
    }

    const avgLatencyMs =
      latencies.length > 0 ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0;

    return {
      timestamp: Date.now(),
      providers: providerMetrics,
      summary: {
        totalRequests,
        totalErrors,
        avgLatencyMs,
        circuitBreakerOpenCount: cbOpenCount,
        rateLimitedCount: rlRejectedCount,
      },
    };
  }

  /**
   * Export metrics in Prometheus format.
   */
  getPrometheusMetrics(): string {
    const snapshot = this.getSnapshot();
    const lines: string[] = [];

    lines.push(
      "# HELP resilience_circuit_breaker_state Circuit breaker state (0=CLOSED, 1=OPEN, 2=HALF_OPEN)"
    );
    lines.push("# TYPE resilience_circuit_breaker_state gauge");
    for (const [name, metrics] of Object.entries(snapshot.providers)) {
      const stateValue =
        ({ CLOSED: 0, OPEN: 1, HALF_OPEN: 2 } as Record<string, number>)[
          metrics.circuitBreaker.state
        ] || 0;
      lines.push(`resilience_circuit_breaker_state{provider="${name}"} ${stateValue}`);
    }
    lines.push("");

    lines.push("# HELP resilience_failure_rate Provider failure rate");
    lines.push("# TYPE resilience_failure_rate gauge");
    for (const [name, metrics] of Object.entries(snapshot.providers)) {
      lines.push(
        `resilience_failure_rate{provider="${name}"} ${metrics.circuitBreaker.failureRate}`
      );
    }
    lines.push("");

    lines.push("# HELP resilience_rate_limit_rejection_rate Rate limiter rejection rate");
    lines.push("# TYPE resilience_rate_limit_rejection_rate gauge");
    for (const [name, metrics] of Object.entries(snapshot.providers)) {
      lines.push(
        `resilience_rate_limit_rejection_rate{provider="${name}"} ${metrics.rateLimiter.rejectionRate}`
      );
    }
    lines.push("");

    lines.push("# HELP resilience_avg_latency_ms Average latency in milliseconds");
    lines.push("# TYPE resilience_avg_latency_ms gauge");
    for (const [name, metrics] of Object.entries(snapshot.providers)) {
      lines.push(
        `resilience_avg_latency_ms{provider="${name}"} ${metrics.performance.avgLatencyMs}`
      );
    }
    lines.push("");

    lines.push(
      "# HELP resilience_fallback_provider_state Fallback provider state (0=CLOSED, 1=OPEN, 2=HALF_OPEN)"
    );
    lines.push("# TYPE resilience_fallback_provider_state gauge");
    for (const [name, metrics] of Object.entries(snapshot.providers)) {
      if (metrics.fallback.hasProviders) {
        for (const [fbProviderName, fbState] of Object.entries(metrics.fallback.providerStates)) {
          const stateValue =
            ({ CLOSED: 0, OPEN: 1, HALF_OPEN: 2 } as Record<string, number>)[fbState] || 0;
          lines.push(
            `resilience_fallback_provider_state{provider="${name}",fallback_provider="${fbProviderName}"} ${stateValue}`
          );
        }
      }
    }
    lines.push("");

    lines.push("# HELP resilience_fallback_total_attempts Total fallback attempts per provider");
    lines.push("# TYPE resilience_fallback_total_attempts gauge");
    for (const [name, metrics] of Object.entries(snapshot.providers)) {
      lines.push(
        `resilience_fallback_total_attempts{provider="${name}"} ${metrics.fallback.totalAttempts}`
      );
    }
    lines.push("");

    lines.push("# HELP resilience_summary_total_requests Total requests across all providers");
    lines.push("# TYPE resilience_summary_total_requests gauge");
    lines.push(`resilience_summary_total_requests ${snapshot.summary.totalRequests}`);
    lines.push("");

    lines.push("# HELP resilience_summary_total_errors Total errors across all providers");
    lines.push("# TYPE resilience_summary_total_errors gauge");
    lines.push(`resilience_summary_total_errors ${snapshot.summary.totalErrors}`);

    return lines.join("\n");
  }

  /**
   * Check health status.
   */
  isHealthy(): boolean {
    const snapshot = this.getSnapshot();
    // Healthy if: no circuit breakers OPEN, overall failure rate <5%
    return (
      snapshot.summary.circuitBreakerOpenCount === 0 &&
      snapshot.summary.totalRequests > 0 &&
      snapshot.summary.totalErrors / snapshot.summary.totalRequests < 0.05
    );
  }

  /**
   * Get health status with details.
   */
  getHealthStatus(): { healthy: boolean; issues: string[] } {
    const snapshot = this.getSnapshot();
    const issues: string[] = [];

    for (const [name, metrics] of Object.entries(snapshot.providers)) {
      if (metrics.state === "failing") {
        issues.push(`Provider ${name} is FAILING (circuit breaker OPEN)`);
      } else if (metrics.state === "degraded") {
        issues.push(
          `Provider ${name} is DEGRADED (failure rate: ${(metrics.circuitBreaker.failureRate * 100).toFixed(1)}%)`
        );
      }
    }

    return {
      healthy: issues.length === 0,
      issues,
    };
  }

  /**
   * Reset all metrics.
   */
  reset(): void {
    this.providerLatencies.clear();
  }
}
