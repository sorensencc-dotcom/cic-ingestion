// filename: extractors/registry.js
// date: 2026-05-16
// version: 1.0.0

/**
 * CIC Extractor Registry
 *
 * Maps extractor keys → IExtractor-compatible module namespaces.
 * Distinct from the Analyzer Registry (analyzers/registry.js):
 *   - Analyzer Registry: raw IExtractor modules (direct Gemini calls)
 *   - Extractor Registry: wrapped extractors that adapt output to corpus payload shape
 *
 * To add a future extractor:
 *   1. Import the wrapper module: import * as MyExtractor from '../analyzers/MyExtractor.js'
 *   2. Add its key(s) to EXTRACTORS below.
 *   3. Export the resolver from this file.
 */

import * as ImageAnalyzerV2Extractor from '../analyzers/ImageAnalyzerV2Extractor.js';

/**
 * Frozen extractor registry. Keys are the string identifiers used by the
 * sidecar pipeline and corpus builder to resolve extractors by type.
 *
 * Both "image" and "image:v2" resolve to the same wrapper — the wrapper
 * internally delegates to ImageAnalyzerV2.
 *
 * @type {Readonly<Record<string, object>>}
 */
export const EXTRACTORS = Object.freeze({
  'image':    ImageAnalyzerV2Extractor,
  'image:v2': ImageAnalyzerV2Extractor,
});

/**
 * Resolves an extractor wrapper by key.
 *
 * @param {string} name - e.g. "image" or "image:v2"
 * @returns {object|null} - IExtractor-compatible wrapper module, or null if not found
 */
export function getExtractor(name) {
  return EXTRACTORS[name] ?? null;
}
