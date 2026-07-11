/**
 * CIC v3.0 — Shared Types
 * File: cic/core/types.js | Version: 1.0.0 | Date: 2026-05-15
 */

/**
 * @typedef {Object} CicContext
 * @property {import('../ingestion/v1.0.0/queue/types.js').IngestionJob[]} jobs
 * @property {Object} registry
 * @property {Object} bus
 */

/**
 * @typedef {Object} HarvesterPayload
 * @property {string} id
 * @property {"web"|"file"|"sidecar"} type
 * @property {string} content
 * @property {Object} metadata
 * @property {number} metadata.harvestedAt
 */

/**
 * @typedef {Object} DagNode
 * @property {string} id
 * @property {string} type
 * @property {Object} config
 */

/**
 * @typedef {Object} DagEdge
 * @property {string} from
 * @property {string} to
 */

/**
 * @typedef {Object} Dag
 * @property {string} id
 * @property {DagNode[]} nodes
 * @property {DagEdge[]} edges
 * @property {number} createdAt
 */

/**
 * @typedef {Object} AgentContract
 * @property {string} name
 * @property {string} version
 * @property {function(CicContext): Promise<Object>} execute
 */

/**
 * @typedef {Object} PipelineContract
 * @property {string} name
 * @property {string} version
 * @property {function(Object): Promise<Object>} run
 */
