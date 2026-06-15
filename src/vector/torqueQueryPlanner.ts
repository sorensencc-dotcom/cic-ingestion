import QdrantClient, { QdrantQueryResult } from "./qdrantClient.js";

export interface TorqueCollectionTarget {
  name: "chunks" | "context" | "skills";
  client: QdrantClient;
}

export interface TorqueQueryPlan {
  vectorPrimary: number[];
  vectorSecondary?: number[];
  limit: number;
  filter?: Record<string, unknown>;
  collections: TorqueCollectionTarget[];
  facets?: string[];
}

export interface TorqueQueryHit {
  id: string;
  score: number;
  payload: Record<string, unknown> | null;
  collection: string;
}

export interface TorqueQueryResponse {
  hits: TorqueQueryHit[];
  facets: Record<string, Record<string, number>>;
  debug?: any;
}

export class TorqueQueryPlanner {
  #targets: Record<string, TorqueCollectionTarget>;

  constructor(targets: Record<string, TorqueCollectionTarget>) {
    this.#targets = targets;
  }

  getTargets() {
    return this.#targets;
  }

  async execute(plan: TorqueQueryPlan): Promise<TorqueQueryResponse> {
    const perCollectionLimit = plan.limit;

    const resultsByCollection: Record<string, QdrantQueryResult[]> = {};

    const debug: any = {
      collectionsQueried: [],
      primaryResults: {},
      secondaryResults: {},
      rrfScores: {},
      mmrDecisions: [],
    };

    for (const target of plan.collections) {
      debug.collectionsQueried.push(target.name);

      const primary = await target.client.query(
        plan.vectorPrimary,
        perCollectionLimit
      );
      debug.primaryResults[target.name] = primary;

      let secondary: QdrantQueryResult[] = [];
      if (plan.vectorSecondary) {
        secondary = await target.client.query(
          plan.vectorSecondary,
          perCollectionLimit
        );
        debug.secondaryResults[target.name] = secondary;
      }

      const fused = this.#rrfFuse(primary, secondary, perCollectionLimit, debug);
      resultsByCollection[target.name] = fused;
    }

    const fusedAll = this.#fanIn(resultsByCollection, plan.limit);
    const diversified = this.#mmrDiversify(fusedAll, 0.7, debug);

    const hits: TorqueQueryHit[] = diversified.map((r) => ({
      id: r.id,
      score: r.score,
      payload: r.payload,
      collection: (r.payload as any)?.collection ?? "unknown",
    }));

    const facets = plan.facets
      ? this.#computeFacets(hits, plan.facets)
      : {};

    return { hits, facets, debug };
  }

  #fanIn(
    byCollection: Record<string, QdrantQueryResult[]>,
    limit: number
  ): QdrantQueryResult[] {
    const all: QdrantQueryResult[] = [];
    for (const [collection, list] of Object.entries(byCollection)) {
      for (const r of list) {
        all.push({
          ...r,
          payload: { ...(r.payload ?? {}), collection },
        });
      }
    }
    return all.sort((a, b) => b.score - a.score).slice(0, limit);
  }

  #rrfFuse(
    a: QdrantQueryResult[],
    b: QdrantQueryResult[],
    limit: number,
    debug?: any
  ): QdrantQueryResult[] {
    const k = 60;
    const scores = new Map<string, number>();
    const payloads = new Map<string, any>();

    const add = (list: QdrantQueryResult[]) => {
      list.forEach((r, idx) => {
        const key = r.id;
        const prev = scores.get(key) || 0;
        scores.set(key, prev + 1 / (k + idx));
        payloads.set(key, r.payload);
      });
    };

    add(a);
    add(b);

    const fused = Array.from(scores.entries())
      .map(([id, score]) => ({
        id,
        score,
        payload: payloads.get(id) ?? null,
      }))
      .sort((x, y) => y.score - x.score)
      .slice(0, limit);

    if (debug && debug.rrfScores) {
      for (const item of fused) {
        debug.rrfScores[item.id] = item.score;
      }
    }

    return fused;
  }

  #mmrDiversify(
    results: QdrantQueryResult[],
    lambda: number,
    debug?: any
  ): QdrantQueryResult[] {
    if (results.length <= 1) return results;

    const selected: QdrantQueryResult[] = [];
    const remaining = [...results];

    while (remaining.length > 0 && selected.length < results.length) {
      let bestIdx = 0;
      let bestScore = -Infinity;
      let bestDetails: any = null;

      for (let i = 0; i < remaining.length; i++) {
        const candidate = remaining[i];
        const relevance = candidate.score;
        const redundancy = selected.length
          ? Math.max(...selected.map((s) => this.#similarity(s, candidate)))
          : 0;

        const mmrScore = lambda * relevance - (1 - lambda) * redundancy;
        if (mmrScore > bestScore) {
          bestScore = mmrScore;
          bestIdx = i;
          if (debug) {
            bestDetails = {
              candidate: candidate.id,
              relevance,
              redundancy,
              mmrScore,
            };
          }
        }
      }

      if (debug && debug.mmrDecisions && bestDetails) {
        debug.mmrDecisions.push(bestDetails);
      }

      selected.push(remaining[bestIdx]);
      remaining.splice(bestIdx, 1);
    }

    return selected;
  }

  #similarity(a: QdrantQueryResult, b: QdrantQueryResult): number {
    return a.id === b.id ? 1 : 0;
  }

  #computeFacets(
    hits: TorqueQueryHit[],
    facetKeys: string[]
  ): Record<string, Record<string, number>> {
    const facets: Record<string, Record<string, number>> = {};

    for (const key of facetKeys) {
      facets[key] = {};
    }

    for (const hit of hits) {
      const payload = hit.payload || {};
      for (const key of facetKeys) {
        const value = payload[key];
        if (value == null) continue;

        if (Array.isArray(value)) {
          for (const v of value) {
            const s = String(v);
            facets[key][s] = (facets[key][s] || 0) + 1;
          }
        } else {
          const s = String(value);
          facets[key][s] = (facets[key][s] || 0) + 1;
        }
      }
    }

    return facets;
  }
}

export default TorqueQueryPlanner;
