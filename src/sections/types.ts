/**
 * Phase 3 Section Tracking System - Type Definitions
 * §0.1-A: Semantic section storage and vector indexing
 */

export interface SectionMetadata {
  sourceId: string;
  sourceType: string;
  timestamp?: number;
  chunkIndex: number;
  chunkTotal: number;
  title?: string;
  url?: string;
  language?: string;
  [key: string]: unknown;
}

export interface Section {
  id: string;
  content: string;
  embedding: number[];
  metadata: SectionMetadata;
}

export interface SearchResult {
  id: string;
  content: string;
  metadata: SectionMetadata;
  score: number;
}

export interface SearchOptions {
  limit?: number;
  minScore?: number;
  filter?: {
    sourceId?: string;
    sourceType?: string;
    [key: string]: unknown;
  };
}
