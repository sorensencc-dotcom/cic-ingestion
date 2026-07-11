/**
 * CIC Orchestrator v3.0.0 — DAG Mutation
 */

export function mutateDag(dag, mutation) {
  const next = { ...dag };

  if (mutation.addNode) {
    next.nodes = [...dag.nodes, mutation.addNode];
  }

  if (mutation.removeNodeId) {
    next.nodes = dag.nodes.filter(n => n.id !== mutation.removeNodeId);
  }

  if (mutation.addEdge) {
    next.edges = [...dag.edges, mutation.addEdge];
  }

  return next;
}
