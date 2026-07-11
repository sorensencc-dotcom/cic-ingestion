/**
 * CIC Orchestrator v3.0.0 — DAG Runner
 */

export async function runDag(dag, context) {
  const results = {};

  for (const node of dag.nodes) {
    const fn = context.registry[node.type];
    if (!fn) throw new Error(`ORCH_MISSING_NODE_TYPE: ${node.type}`);

    results[node.id] = await fn(node.config, context);
  }

  return results;
}
