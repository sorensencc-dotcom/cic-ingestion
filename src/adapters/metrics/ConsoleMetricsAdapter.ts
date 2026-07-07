import { BaseAdapter, AdapterConfig, AdapterInput, AdapterOutput } from "../BaseAdapter";
import { TorqueQueryClient } from "../../../src/services/torquequery/TorqueQueryClient";

export interface ConsoleMetricsConfig extends AdapterConfig {
  torqueQuery: TorqueQueryClient;
}

export class ConsoleMetricsAdapter extends BaseAdapter {
  private torqueQuery: TorqueQueryClient;

  constructor(config: ConsoleMetricsConfig) {
    super(config);
    this.torqueQuery = config.torqueQuery;
  }

  normalize(_input: AdapterInput): AdapterInput {
    return _input;
  }

  validate(output: AdapterOutput): AdapterOutput {
    return output;
  }

  async run(input: AdapterInput): Promise<AdapterOutput> {
    const output: AdapterOutput = {
      success: true,
      data: {},
      timestamp: Date.now(),
      metadata: { source: "console-metrics" },
    };

    try {
      const metrics = await this.torqueQuery.queryMetrics();
      output.data = { ...output.data, ...metrics };
    } catch (err) {
      console.error("[ConsoleMetricsAdapter] Failed to fetch TorqueQuery metrics:", err);
    }

    return output;
  }
}
