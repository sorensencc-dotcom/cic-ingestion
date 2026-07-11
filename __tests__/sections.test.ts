/**
 * Phase 3 Section Tracking System - Test Suite
 * §0.1-A: Tests for SectionTracker Qdrant integration
 */

import SectionTracker from '../src/sections/SectionTracker';
import { Section, SearchResult, SectionMetadata } from '../src/sections/types';

describe('SectionTracker', () => {
  let tracker: SectionTracker;
  const vectorSize = 384;

  beforeEach(() => {
    tracker = new SectionTracker({
      url: 'http://localhost:6333',
      collectionName: 'sections',
      vectorSize,
    });
  });

  describe('initialization', () => {
    it('should initialize successfully', async () => {
      await tracker.initialize();
      const stats = await tracker.getStats();
      expect(stats.collectionName).toBe('sections');
      expect(stats.vectorSize).toBe(vectorSize);
    });

    it('should not reinitialize if already initialized', async () => {
      await tracker.initialize();
      await tracker.initialize(); // Should not throw
      const stats = await tracker.getStats();
      expect(stats.collectionName).toBe('sections');
    });
  });

  describe('indexSection', () => {
    it('should index a section with valid embedding and metadata', async () => {
      const metadata: SectionMetadata = {
        sourceId: 'source-1',
        sourceType: 'document',
        chunkIndex: 0,
        chunkTotal: 1,
        title: 'Test Section',
      };

      const embedding = Array(vectorSize).fill(0.1);
      const section = await tracker.indexSection(
        'This is test content.',
        embedding,
        metadata
      );

      expect(section).toBeDefined();
      expect(section.id).toBeDefined();
      expect(section.content).toBe('This is test content.');
      expect(section.embedding).toEqual(embedding);
      expect(section.metadata.sourceId).toBe('source-1');
      expect(section.metadata.timestamp).toBeDefined();
    });

    it('should reject empty content', async () => {
      const metadata: SectionMetadata = {
        sourceId: 'source-1',
        sourceType: 'document',
        chunkIndex: 0,
        chunkTotal: 1,
      };

      const embedding = Array(vectorSize).fill(0.1);

      await expect(
        tracker.indexSection('', embedding, metadata)
      ).rejects.toThrow('Section content cannot be empty');
    });

    it('should reject empty embedding', async () => {
      const metadata: SectionMetadata = {
        sourceId: 'source-1',
        sourceType: 'document',
        chunkIndex: 0,
        chunkTotal: 1,
      };

      await expect(
        tracker.indexSection('Content', [], metadata)
      ).rejects.toThrow('Section embedding cannot be empty');
    });

    it('should reject embedding with wrong size', async () => {
      const metadata: SectionMetadata = {
        sourceId: 'source-1',
        sourceType: 'document',
        chunkIndex: 0,
        chunkTotal: 1,
      };

      const wrongEmbedding = Array(100).fill(0.1);

      await expect(
        tracker.indexSection('Content', wrongEmbedding, metadata)
      ).rejects.toThrow('Embedding size mismatch');
    });

    it('should index multiple sections independently', async () => {
      const metadata1: SectionMetadata = {
        sourceId: 'source-1',
        sourceType: 'document',
        chunkIndex: 0,
        chunkTotal: 2,
      };

      const metadata2: SectionMetadata = {
        sourceId: 'source-2',
        sourceType: 'article',
        chunkIndex: 1,
        chunkTotal: 2,
      };

      const embedding1 = Array(vectorSize).fill(0.1);
      const embedding2 = Array(vectorSize).fill(0.2);

      const section1 = await tracker.indexSection(
        'First section',
        embedding1,
        metadata1
      );

      const section2 = await tracker.indexSection(
        'Second section',
        embedding2,
        metadata2
      );

      expect(section1.id).not.toBe(section2.id);
      expect(section1.metadata.sourceId).toBe('source-1');
      expect(section2.metadata.sourceId).toBe('source-2');
    });
  });

  describe('searchSections', () => {
    beforeEach(async () => {
      // Index test data
      const metadata1: SectionMetadata = {
        sourceId: 'source-1',
        sourceType: 'document',
        chunkIndex: 0,
        chunkTotal: 1,
      };

      const metadata2: SectionMetadata = {
        sourceId: 'source-2',
        sourceType: 'article',
        chunkIndex: 0,
        chunkTotal: 1,
      };

      const embedding1 = Array(vectorSize).fill(0.1);
      const embedding2 = Array(vectorSize).fill(0.2);
      const embedding3 = Array(vectorSize).fill(0.3);

      await tracker.indexSection('Document content', embedding1, metadata1);
      await tracker.indexSection('Article content', embedding2, metadata2);
      await tracker.indexSection('Another document', embedding3, metadata1);
    });

    it('should search and return results sorted by score', async () => {
      const queryEmbedding = Array(vectorSize).fill(0.1);
      const results = await tracker.searchSections(queryEmbedding, {
        limit: 10,
      });

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].score).toBeGreaterThanOrEqual(results[1]?.score ?? 0);
    });

    it('should respect limit parameter', async () => {
      const queryEmbedding = Array(vectorSize).fill(0.15);
      const results = await tracker.searchSections(queryEmbedding, {
        limit: 2,
      });

      expect(results.length).toBeLessThanOrEqual(2);
    });

    it('should filter by sourceId', async () => {
      const queryEmbedding = Array(vectorSize).fill(0.15);
      const results = await tracker.searchSections(queryEmbedding, {
        limit: 10,
        filter: { sourceId: 'source-1' },
      });

      results.forEach((result) => {
        expect(result.metadata.sourceId).toBe('source-1');
      });
    });

    it('should filter by sourceType', async () => {
      const queryEmbedding = Array(vectorSize).fill(0.2);
      const results = await tracker.searchSections(queryEmbedding, {
        limit: 10,
        filter: { sourceType: 'article' },
      });

      results.forEach((result) => {
        expect(result.metadata.sourceType).toBe('article');
      });
    });

    it('should respect minScore threshold', async () => {
      const queryEmbedding = Array(vectorSize).fill(0.1);
      const results = await tracker.searchSections(queryEmbedding, {
        limit: 10,
        minScore: 0.99, // Very high threshold
      });

      results.forEach((result) => {
        expect(result.score).toBeGreaterThanOrEqual(0.99);
      });
    });

    it('should reject empty query embedding', async () => {
      await expect(
        tracker.searchSections([], { limit: 10 })
      ).rejects.toThrow('Query embedding cannot be empty');
    });

    it('should reject query embedding with wrong size', async () => {
      const wrongEmbedding = Array(100).fill(0.1);
      await expect(
        tracker.searchSections(wrongEmbedding, { limit: 10 })
      ).rejects.toThrow('Query embedding size mismatch');
    });

    it('should return SearchResult with expected structure', async () => {
      const queryEmbedding = Array(vectorSize).fill(0.1);
      const results = await tracker.searchSections(queryEmbedding, {
        limit: 1,
      });

      expect(results.length).toBeGreaterThan(0);
      const result = results[0];
      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('content');
      expect(result).toHaveProperty('metadata');
      expect(result).toHaveProperty('score');
      expect(typeof result.score).toBe('number');
    });
  });

  describe('getSection', () => {
    it('should retrieve a section by ID', async () => {
      const metadata: SectionMetadata = {
        sourceId: 'source-1',
        sourceType: 'document',
        chunkIndex: 0,
        chunkTotal: 1,
      };

      const embedding = Array(vectorSize).fill(0.1);
      const indexed = await tracker.indexSection('Test content', embedding, metadata);

      const retrieved = await tracker.getSection(indexed.id);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.id).toBe(indexed.id);
      expect(retrieved?.content).toBe('Test content');
    });

    it('should return null for non-existent section', async () => {
      const retrieved = await tracker.getSection('non-existent-id');
      expect(retrieved).toBeNull();
    });
  });

  describe('getMetadata', () => {
    it('should retrieve metadata for a section', async () => {
      const metadata: SectionMetadata = {
        sourceId: 'source-1',
        sourceType: 'document',
        chunkIndex: 0,
        chunkTotal: 1,
        title: 'Test Title',
        url: 'https://example.com',
      };

      const embedding = Array(vectorSize).fill(0.1);
      const indexed = await tracker.indexSection(
        'Test content',
        embedding,
        metadata
      );

      const retrieved = await tracker.getMetadata(indexed.id);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.sourceId).toBe('source-1');
      expect(retrieved?.title).toBe('Test Title');
      expect(retrieved?.url).toBe('https://example.com');
    });

    it('should return null for non-existent section metadata', async () => {
      const retrieved = await tracker.getMetadata('non-existent-id');
      expect(retrieved).toBeNull();
    });

    it('should include auto-set timestamp in metadata', async () => {
      const metadata: SectionMetadata = {
        sourceId: 'source-1',
        sourceType: 'document',
        chunkIndex: 0,
        chunkTotal: 1,
      };

      const embedding = Array(vectorSize).fill(0.1);
      const beforeIndex = Date.now();
      const indexed = await tracker.indexSection(
        'Test content',
        embedding,
        metadata
      );
      const afterIndex = Date.now();

      const retrieved = await tracker.getMetadata(indexed.id);
      expect(retrieved?.timestamp).toBeDefined();
      expect(retrieved!.timestamp).toBeGreaterThanOrEqual(beforeIndex);
      expect(retrieved!.timestamp).toBeLessThanOrEqual(afterIndex);
    });
  });

  describe('deleteSection', () => {
    it('should delete an indexed section', async () => {
      const metadata: SectionMetadata = {
        sourceId: 'source-1',
        sourceType: 'document',
        chunkIndex: 0,
        chunkTotal: 1,
      };

      const embedding = Array(vectorSize).fill(0.1);
      const indexed = await tracker.indexSection(
        'Test content',
        embedding,
        metadata
      );

      const deleted = await tracker.deleteSection(indexed.id);
      expect(deleted).toBe(true);

      const retrieved = await tracker.getSection(indexed.id);
      expect(retrieved).toBeNull();
    });

    it('should return false when deleting non-existent section', async () => {
      const deleted = await tracker.deleteSection('non-existent-id');
      expect(deleted).toBe(false);
    });
  });

  describe('getStats', () => {
    it('should return statistics about indexed sections', async () => {
      const metadata: SectionMetadata = {
        sourceId: 'source-1',
        sourceType: 'document',
        chunkIndex: 0,
        chunkTotal: 1,
      };

      const embedding1 = Array(vectorSize).fill(0.1);
      const embedding2 = Array(vectorSize).fill(0.2);

      await tracker.indexSection('First section', embedding1, metadata);
      await tracker.indexSection('Second section', embedding2, metadata);

      const stats = await tracker.getStats();
      expect(stats.totalSections).toBe(2);
      expect(stats.vectorSize).toBe(vectorSize);
      expect(stats.collectionName).toBe('sections');
    });
  });
});
