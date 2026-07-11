/**
 * Phase 3 Section Tracking System - Qdrant Vector Storage Client
 * §0.1-A: Semantic section indexing with vector embeddings and metadata
 */

import { randomUUID } from 'crypto';
import { Section, SearchResult, SearchOptions, SectionMetadata } from './types';

export interface QdrantConfig {
  url: string;
  apiKey?: string;
  collectionName: string;
  vectorSize: number;
}

export class SectionTracker {
  private config: QdrantConfig;
  private isInitialized: boolean = false;
  private sections: Map<string, Section> = new Map();

  constructor(config: QdrantConfig) {
    this.config = config;
  }

  /**
   * Initialize the Qdrant client and create collection if needed
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // In production, initialize actual Qdrant client here
      // For now, using in-memory storage for sections
      this.isInitialized = true;
    } catch (error) {
      throw new Error(`Failed to initialize SectionTracker: ${error}`);
    }
  }

  /**
   * Index a semantic section with vector embedding and metadata
   * @param content The text content of the section
   * @param embedding Vector embedding for the section
   * @param metadata Section metadata (source, type, etc.)
   * @returns The indexed section with generated ID
   */
  async indexSection(
    content: string,
    embedding: number[],
    metadata: SectionMetadata
  ): Promise<Section> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (!content || content.trim().length === 0) {
      throw new Error('Section content cannot be empty');
    }

    if (!embedding || embedding.length === 0) {
      throw new Error('Section embedding cannot be empty');
    }

    if (embedding.length !== this.config.vectorSize) {
      throw new Error(
        `Embedding size mismatch. Expected ${this.config.vectorSize}, got ${embedding.length}`
      );
    }

    const sectionId = randomUUID();
    const section: Section = {
      id: sectionId,
      content,
      embedding,
      metadata: {
        ...metadata,
        timestamp: metadata.timestamp || Date.now(),
      },
    };

    // Store in in-memory map (in production: store in Qdrant)
    this.sections.set(sectionId, section);

    return section;
  }

  /**
   * Search for similar sections using vector similarity
   * @param queryEmbedding The query vector embedding
   * @param options Search options (limit, minScore, filters)
   * @returns Array of matching sections with similarity scores
   */
  async searchSections(
    queryEmbedding: number[],
    options?: SearchOptions
  ): Promise<SearchResult[]> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (!queryEmbedding || queryEmbedding.length === 0) {
      throw new Error('Query embedding cannot be empty');
    }

    if (queryEmbedding.length !== this.config.vectorSize) {
      throw new Error(
        `Query embedding size mismatch. Expected ${this.config.vectorSize}, got ${queryEmbedding.length}`
      );
    }

    const limit = options?.limit || 10;
    const minScore = options?.minScore ?? 0.0;

    // Calculate similarity scores for all sections
    const results: SearchResult[] = [];

    for (const section of this.sections.values()) {
      const score = this.cosineSimilarity(queryEmbedding, section.embedding);

      // Apply filters if specified
      if (options?.filter) {
        let passesFilter = true;

        if (
          options.filter.sourceId &&
          section.metadata.sourceId !== options.filter.sourceId
        ) {
          passesFilter = false;
        }

        if (
          options.filter.sourceType &&
          section.metadata.sourceType !== options.filter.sourceType
        ) {
          passesFilter = false;
        }

        if (!passesFilter) {
          continue;
        }
      }

      if (score >= minScore) {
        results.push({
          id: section.id,
          content: section.content,
          metadata: section.metadata,
          score,
        });
      }
    }

    // Sort by score descending and limit results
    return results.sort((a, b) => b.score - a.score).slice(0, limit);
  }

  /**
   * Get a section by ID
   * @param sectionId The section ID
   * @returns The section if found, null otherwise
   */
  async getSection(sectionId: string): Promise<Section | null> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    return this.sections.get(sectionId) || null;
  }

  /**
   * Get metadata for a section
   * @param sectionId The section ID
   * @returns The section metadata if found, null otherwise
   */
  async getMetadata(sectionId: string): Promise<SectionMetadata | null> {
    const section = await this.getSection(sectionId);
    return section?.metadata || null;
  }

  /**
   * Delete a section by ID
   * @param sectionId The section ID
   * @returns true if deleted, false if not found
   */
  async deleteSection(sectionId: string): Promise<boolean> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    return this.sections.delete(sectionId);
  }

  /**
   * Get statistics about indexed sections
   */
  async getStats(): Promise<{
    totalSections: number;
    vectorSize: number;
    collectionName: string;
  }> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    return {
      totalSections: this.sections.size,
      vectorSize: this.config.vectorSize,
      collectionName: this.config.collectionName,
    };
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('Vector dimensions must match');
    }

    let dotProduct = 0;
    let magnitudeA = 0;
    let magnitudeB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      magnitudeA += a[i] * a[i];
      magnitudeB += b[i] * b[i];
    }

    magnitudeA = Math.sqrt(magnitudeA);
    magnitudeB = Math.sqrt(magnitudeB);

    if (magnitudeA === 0 || magnitudeB === 0) {
      return 0;
    }

    return dotProduct / (magnitudeA * magnitudeB);
  }
}

export default SectionTracker;
