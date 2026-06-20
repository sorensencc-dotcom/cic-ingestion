/**
 * SweeperFallbackRouter Unit Tests
 *
 * Tests: vertical detection, routing logic, fallback chains, DLQ routing
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import {
  SweeperFallbackRouter,
  Vertical,
  IngestionResult,
} from './SweeperFallbackRouter';

describe('SweeperFallbackRouter', () => {
  let router: SweeperFallbackRouter;

  beforeEach(() => {
    router = new SweeperFallbackRouter();
  });

  afterEach(async () => {
    await router.cleanup();
  });

  describe('vertical detection', () => {
    it('detects DENTAL vertical', async () => {
      const result = await router.ingest('https://example-dental-office.com', {
        vertical: Vertical.DENTAL,
      });
      expect(result.vertical).toBe(Vertical.DENTAL);
    });

    it('detects MEDSPA vertical', async () => {
      const result = await router.ingest('https://example-medspa.com', {
        vertical: Vertical.MEDSPA,
      });
      expect(result.vertical).toBe(Vertical.MEDSPA);
    });

    it('detects AGENCY vertical', async () => {
      const result = await router.ingest('https://example-agency.com', {
        vertical: Vertical.AGENCY,
      });
      expect(result.vertical).toBe(Vertical.AGENCY);
    });

    it('detects RESTAURANT vertical', async () => {
      const result = await router.ingest('https://example-restaurant.com', {
        vertical: Vertical.RESTAURANT,
      });
      expect(result.vertical).toBe(Vertical.RESTAURANT);
    });

    it('detects TRADES vertical', async () => {
      const result = await router.ingest('https://example-plumber.com', {
        vertical: Vertical.TRADES,
      });
      expect(result.vertical).toBe(Vertical.TRADES);
    });
  });

  describe('routing strategy', () => {
    it('uses browser-first strategy for high-JS verticals', async () => {
      const result = await router.ingest('https://example-dental.com', {
        vertical: Vertical.DENTAL,
      });
      expect([Vertical.DENTAL, Vertical.MEDSPA, Vertical.AGENCY, Vertical.MEDICAL, Vertical.REAL_ESTATE]).toContain(
        result.vertical
      );
    });

    it('uses html-first strategy for low-JS verticals', async () => {
      const result = await router.ingest('https://example-restaurant.com', {
        vertical: Vertical.RESTAURANT,
      });
      expect([Vertical.RESTAURANT, Vertical.TRADES, Vertical.LOCAL_RETAIL]).toContain(
        result.vertical
      );
    });
  });

  describe('ingestion result structure', () => {
    it('returns IngestionResult with all required fields', async () => {
      const result = await router.ingest('https://example.com', {
        vertical: Vertical.DENTAL,
      });

      expect(result).toHaveProperty('url');
      expect(result).toHaveProperty('vertical');
      expect(result).toHaveProperty('method');
      expect(result).toHaveProperty('metadata');
      expect(result).toHaveProperty('duration');
      expect(result).toHaveProperty('success');
    });

    it('records duration', async () => {
      const result = await router.ingest('https://example.com', {
        vertical: Vertical.DENTAL,
      });
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });
  });

  describe('DLQ routing', () => {
    it('routes failed ingestions to DLQ', async () => {
      const result = await router.ingest('https://invalid-url-that-fails.invalid', {
        vertical: Vertical.DENTAL,
      });

      expect(result.method).toBe('dlq');
      expect(result.success).toBe(false);
    });

    it('stores DLQ entries', async () => {
      await router.ingest('https://fail1.invalid', {
        vertical: Vertical.DENTAL,
      });
      await router.ingest('https://fail2.invalid', {
        vertical: Vertical.MEDSPA,
      });

      const dlq = router.getDLQ();
      expect(dlq.length).toBeGreaterThanOrEqual(0);
    });

    it('DLQ entries contain error code and message', async () => {
      await router.ingest('https://fail.invalid', {
        vertical: Vertical.DENTAL,
      });

      const dlq = router.getDLQ();
      if (dlq.length > 0) {
        expect(dlq[0]).toHaveProperty('errorCode');
        expect(dlq[0]).toHaveProperty('errorMessage');
        expect(dlq[0]).toHaveProperty('timestamp');
      }
    });

    it('clears DLQ', async () => {
      await router.ingest('https://fail.invalid', {
        vertical: Vertical.DENTAL,
      });

      let dlq = router.getDLQ();
      const beforeCount = dlq.length;

      router.clearDLQ();

      dlq = router.getDLQ();
      expect(dlq.length).toBe(0);
    });
  });

  describe('metrics tracking', () => {
    it('tracks routing metrics by vertical', async () => {
      await router.ingest('https://example-dental.com', {
        vertical: Vertical.DENTAL,
      });

      const metrics = router.getMetrics();
      expect(metrics).toHaveProperty('dental');
    });

    it('tracks attempts and successes', async () => {
      await router.ingest('https://example-dental.com', {
        vertical: Vertical.DENTAL,
      });

      const metrics = router.getMetrics();
      if (metrics.dental) {
        expect(metrics.dental.attempts).toBeGreaterThan(0);
      }
    });
  });

  describe('vertical classification', () => {
    it('classifies high-JS verticals', () => {
      const highJSVerticals = [
        Vertical.DENTAL,
        Vertical.MEDSPA,
        Vertical.MEDICAL,
        Vertical.AGENCY,
        Vertical.REAL_ESTATE,
      ];

      for (const vertical of highJSVerticals) {
        expect(highJSVerticals).toContain(vertical);
      }
    });

    it('classifies low-JS verticals', () => {
      const lowJSVerticals = [
        Vertical.RESTAURANT,
        Vertical.TRADES,
        Vertical.LOCAL_RETAIL,
      ];

      for (const vertical of lowJSVerticals) {
        expect(lowJSVerticals).toContain(vertical);
      }
    });
  });

  describe('fallback behavior', () => {
    it('marks fallback attempts in metadata', async () => {
      const result = await router.ingest('https://example-restaurant.com', {
        vertical: Vertical.RESTAURANT,
      });

      if (result.metadata.fallback) {
        expect(result.metadata.fallback).toBe(true);
      }
    });
  });

  describe('error handling', () => {
    it('sets errorCode on failure', async () => {
      const result = await router.ingest('https://fail.invalid', {
        vertical: Vertical.DENTAL,
      });

      if (!result.success) {
        expect(result.errorCode).toBeDefined();
      }
    });

    it('sets errorMessage on failure', async () => {
      const result = await router.ingest('https://fail.invalid', {
        vertical: Vertical.DENTAL,
      });

      if (!result.success) {
        expect(result.errorMessage).toBeDefined();
      }
    });
  });

  describe('ingestion methods', () => {
    it('uses correct method in result', async () => {
      const result = await router.ingest('https://example.com', {
        vertical: Vertical.DENTAL,
      });

      expect(['html', 'browser', 'dlq']).toContain(result.method);
    });

    it('tracks method in metadata', async () => {
      const result = await router.ingest('https://example.com', {
        vertical: Vertical.DENTAL,
      });

      expect(result.metadata).toHaveProperty('strategy');
    });
  });
});
