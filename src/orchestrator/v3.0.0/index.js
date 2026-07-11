/**
 * CIC Orchestrator v3.0.0
 * Entry point for the orchestrator subsystem.
 *
 * Exposes:
 *  - DAG engine
 *  - scheduler
 *  - module registry
 *  - MCP event bus
 *  - replay engine
 */

import * as dag from "./dag/index.js";
import * as scheduler from "./scheduler/index.js";
import * as registry from "./registry/index.js";
import * as mcp from "./mcp/index.js";
import * as replay from "./replay/index.js";

export const version = "3.0.0";

export {
  dag,
  scheduler,
  registry,
  mcp,
  replay
};
