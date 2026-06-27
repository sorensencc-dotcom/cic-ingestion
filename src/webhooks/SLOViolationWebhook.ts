import axios, { AxiosInstance } from "axios";
import { DriftSignal } from "../detectors/VerticalDriftDetector";
import { HydrationFailure } from "../detectors/SpaHydrationDetector";

export type SLOEventType =
  | "VERTICAL_DRIFT"
  | "SPA_HYDRATION_FAILURE"
  | "CONFIDENCE_DROP"
  | "TIMEOUT"
  | "RETRY_EXHAUSTION"
  | "QUOTA_EXCEEDED";

export interface SLOEvent {
  type: SLOEventType;
  adapter: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  timestamp: number;
  details: any;
  source?: string;
}

export interface SLOWebhookConfig {
  torqueQueryUrl?: string;
  chatAgentUrl?: string;
  slackWebhookUrl?: string;
  teamsWebhookUrl?: string;
  timeout?: number;
  retries?: number;
}

export class SLOViolationWebhook {
  private client: AxiosInstance;
  private config: SLOWebhookConfig;
  private eventQueue: SLOEvent[] = [];
  private isProcessing = false;

  constructor(config: SLOWebhookConfig = {}) {
    this.config = {
      timeout: 5000,
      retries: 3,
      ...config,
    };

    this.client = axios.create({
      timeout: this.config.timeout,
    });
  }

  async emitDrift(signal: DriftSignal, adapter: string): Promise<void> {
    const event: SLOEvent = {
      type: "VERTICAL_DRIFT",
      adapter,
      severity: signal.severity,
      timestamp: signal.timestamp,
      details: signal.details,
      source: "VerticalDriftDetector",
    };

    await this.emit(event);
  }

  async emitHydrationFailure(
    failure: HydrationFailure,
    adapter: string
  ): Promise<void> {
    const event: SLOEvent = {
      type: "SPA_HYDRATION_FAILURE",
      adapter,
      severity: failure.severity,
      timestamp: Date.now(),
      details: failure.details || failure.reason,
      source: "SpaHydrationDetector",
    };

    await this.emit(event);
  }

  async emit(event: SLOEvent): Promise<void> {
    this.eventQueue.push(event);

    if (!this.isProcessing) {
      this.processQueue();
    }
  }

  async emitMany(events: SLOEvent[]): Promise<void> {
    this.eventQueue.push(...events);

    if (!this.isProcessing) {
      this.processQueue();
    }
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;

    while (this.eventQueue.length > 0) {
      const event = this.eventQueue.shift()!;

      try {
        await this.dispatch(event);
      } catch (error) {
        console.error(`Failed to dispatch event: ${event.type}`, error);
      }
    }

    this.isProcessing = false;
  }

  private async dispatch(event: SLOEvent): Promise<void> {
    const promises = [];

    if (this.config.torqueQueryUrl) {
      promises.push(this.sendToTorqueQuery(event));
    }

    if (this.config.chatAgentUrl) {
      promises.push(this.sendToChatAgent(event));
    }

    if (
      event.severity === "HIGH" ||
      event.severity === "CRITICAL"
    ) {
      if (this.config.slackWebhookUrl) {
        promises.push(this.sendToSlack(event));
      }

      if (this.config.teamsWebhookUrl) {
        promises.push(this.sendToTeams(event));
      }
    }

    await Promise.allSettled(promises);
  }

  private async sendToTorqueQuery(event: SLOEvent): Promise<void> {
    await this.withRetry(() =>
      this.client.post(`${this.config.torqueQueryUrl}/slo/violation`, event)
    );
  }

  private async sendToChatAgent(event: SLOEvent): Promise<void> {
    await this.withRetry(() =>
      this.client.post(
        `${this.config.chatAgentUrl}/events/slo-violation`,
        event
      )
    );
  }

  private async sendToSlack(event: SLOEvent): Promise<void> {
    const payload = {
      text: `SLO Violation: ${event.type} on adapter ${event.adapter}`,
      attachments: [
        {
          color: this.getSeverityColor(event.severity),
          fields: [
            { title: "Type", value: event.type, short: true },
            { title: "Adapter", value: event.adapter, short: true },
            { title: "Severity", value: event.severity, short: true },
            {
              title: "Timestamp",
              value: new Date(event.timestamp).toISOString(),
              short: true,
            },
            {
              title: "Details",
              value: JSON.stringify(event.details, null, 2),
              short: false,
            },
          ],
        },
      ],
    };

    await this.withRetry(() =>
      this.client.post(this.config.slackWebhookUrl!, payload)
    );
  }

  private async sendToTeams(event: SLOEvent): Promise<void> {
    const payload = {
      "@type": "MessageCard",
      "@context": "https://schema.org/extensions",
      summary: `SLO Violation: ${event.type}`,
      themeColor: this.getSeverityColor(event.severity),
      sections: [
        {
          activityTitle: `SLO Violation: ${event.type}`,
          facts: [
            { name: "Adapter", value: event.adapter },
            { name: "Severity", value: event.severity },
            {
              name: "Timestamp",
              value: new Date(event.timestamp).toISOString(),
            },
            {
              name: "Details",
              value: JSON.stringify(event.details, null, 2),
            },
          ],
        },
      ],
    };

    await this.withRetry(() =>
      this.client.post(this.config.teamsWebhookUrl!, payload)
    );
  }

  private getSeverityColor(severity: string): string {
    switch (severity) {
      case "CRITICAL":
        return "#FF0000";
      case "HIGH":
        return "#FF9900";
      case "MEDIUM":
        return "#FFFF00";
      case "LOW":
        return "#00FF00";
      default:
        return "#CCCCCC";
    }
  }

  private async withRetry<T>(
    fn: () => Promise<T>,
    maxRetries = this.config.retries
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let i = 0; i < (maxRetries || 3); i++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;
        await this.delay(Math.pow(2, i) * 100);
      }
    }

    throw lastError;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
