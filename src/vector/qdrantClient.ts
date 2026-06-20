/**
 * qdrantClient.ts
 * CIC Ingestion — Qdrant Vector DB Client
 * v1.0.0 — 2026-06-14
 *
 * Deterministic, operator‑grade implementation for CIC Phase 26 (TorqueQuery).
 * No hidden retries. No silent fallbacks. Strict boundary validation.
 */

import assert from "node:assert";

export interface QdrantPoint {
  id: string;
  vector: number[];
  payload?: Record<string, unknown>;
}

export interface QdrantQueryResult {
  id: string;
  score: number;
  payload: Record<string, unknown> | null;
}

export class QdrantClient {
  #url: string;
  #apiKey?: string;
  #collection: string;
  #vectorSize: number;
  #headers: Record<string, string>;

  constructor(opts: {
    url: string;
    apiKey?: string;
    collection: string;
    vectorSize: number;
  }) {
    assert(opts.url, "QdrantClient: url is required");
    assert(opts.collection, "QdrantClient: collection is required");
    assert(
      Number.isInteger(opts.vectorSize) && opts.vectorSize > 0,
      "QdrantClient: vectorSize must be a positive integer"
    );

    this.#url = opts.url.replace(/\/$/, "");
    this.#apiKey = opts.apiKey;
    this.#collection = opts.collection;
    this.#vectorSize = opts.vectorSize;

    this.#headers = {
      "Content-Type": "application/json",
    };

    if (this.#apiKey) {
      this.#headers["api-key"] = this.#apiKey;
    }
  }

  // Method for the collection name, needed for testing or indexing
  collectionName(): string {
    return this.#collection;
  }

  // Getter for the vector size, needed for validation
  get vectorSize(): number {
    return this.#vectorSize;
  }

  //
  // ────────────────────────────────────────────────────────────────
  //   Internal HTTP helper
  // ────────────────────────────────────────────────────────────────
  //

  async #req(path: string, init: RequestInit): Promise<any> {
    const url = `${this.#url}${path}`;

    const res = await fetch(url, {
      ...init,
      headers: this.#headers,
    });

    const text = await res.text();
    let json: any = null;

    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      throw new Error(
        `QdrantClient: invalid JSON response from ${path}: ${text}`
      );
    }

    if (!res.ok) {
      throw new Error(
        `QdrantClient: HTTP ${res.status} ${res.statusText} — ${JSON.stringify(
          json
        )}`
      );
    }

    return json;
  }

  //
  // ────────────────────────────────────────────────────────────────
  //   Public API
  // ────────────────────────────────────────────────────────────────
  //

  async ensureCollection(): Promise<void> {
    const path = `/collections/${this.#collection}`;

    // Check if exists
    const exists = await fetch(`${this.#url}${path}`, {
      method: "GET",
      headers: this.#headers,
    });

    if (exists.status === 200) {
      return;
    }

    if (exists.status !== 404) {
      const body = await exists.text();
      throw new Error(
        `QdrantClient: unexpected response checking collection: ${exists.status} ${body}`
      );
    }

    // Create collection
    await this.#req(path, {
      method: "PUT",
      body: JSON.stringify({
        vectors: {
          size: this.#vectorSize,
          distance: "Cosine",
        },
      }),
    });
  }

  async createFieldIndex(fieldName: string, fieldType: "keyword" | "integer" | "float" | "geo" | "text"): Promise<void> {
    assert(fieldName, "createFieldIndex: fieldName is required");
    assert(fieldType, "createFieldIndex: fieldType is required");

    await this.#req(`/collections/${this.#collection}/index`, {
      method: "PUT",
      body: JSON.stringify({
        field_name: fieldName,
        field_schema: fieldType,
      }),
    });
  }

  async upsert(points: QdrantPoint[]): Promise<void> {
    assert(Array.isArray(points), "upsert: points must be an array");

    for (const p of points) {
      assert(typeof p.id === "string", "upsert: point.id must be string");
      assert(
        Array.isArray(p.vector) &&
          p.vector.length === this.#vectorSize &&
          p.vector.every((n) => typeof n === "number"),
        `upsert: point.vector must be number[${this.#vectorSize}]`
      );
    }

    await this.#req(`/collections/${this.#collection}/points`, {
      method: "PUT",
      body: JSON.stringify({ points }),
    });
  }

  async query(vector: number[], limit: number): Promise<QdrantQueryResult[]> {
    assert(
      Array.isArray(vector) &&
        vector.length === this.#vectorSize &&
        vector.every((n) => typeof n === "number"),
      `query: vector must be number[${this.#vectorSize}]`
    );

    assert(
      Number.isInteger(limit) && limit > 0,
      "query: limit must be a positive integer"
    );

    const res = await this.#req(
      `/collections/${this.#collection}/points/search`,
      {
        method: "POST",
        body: JSON.stringify({
          vector,
          limit,
        }),
      }
    );

    if (!Array.isArray(res.result)) return [];

    return res.result.map((r: any) => ({
      id: String(r.id),
      score: r.score,
      payload: r.payload ?? null,
    }));
  }

  async delete(ids: string[]): Promise<void> {
    assert(Array.isArray(ids), "delete: ids must be an array");

    await this.#req(`/collections/${this.#collection}/points/delete`, {
      method: "POST",
      body: JSON.stringify({ points: ids }),
    });
  }

  async health(): Promise<boolean> {
    try {
      const res = await fetch(`${this.#url}/healthz`, {
        method: "GET",
        headers: this.#headers,
      });
      // /healthz returns plain text "healthz check passed", not JSON
      return res.status === 200;
    } catch {
      return false;
    }
  }

  async stats(): Promise<{ points_count: number; indexing: string }> {
    const res = await this.#req(`/collections/${this.#collection}`, {
      method: "GET",
    });
    return {
      points_count: res?.result?.points_count ?? 0,
      indexing:
        typeof res?.result?.optimizer_status === "string"
          ? res.result.optimizer_status
          : res?.result?.status ?? "unknown",
    };
  }
}

export default QdrantClient;
