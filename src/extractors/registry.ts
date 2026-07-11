import { IExtractor } from "./IExtractor";
import { ReverseImageSearchExtractor } from "./ReverseImageSearchExtractor";

export type ExtractorType = "image" | "text" | "document" | "metadata";

/**
 * ExtractorRegistry: Central registry for all available extractors.
 * Supports pluggable extractor discovery and configuration.
 */
export class ExtractorRegistry {
  private extractors: Map<ExtractorType, new (...args: any[]) => IExtractor>;
  private instances: Map<string, IExtractor>;

  constructor() {
    this.extractors = new Map();
    this.instances = new Map();
    this._registerDefaults();
  }

  /**
   * Register default extractors.
   */
  private _registerDefaults(): void {
    this.register("image", ReverseImageSearchExtractor);
  }

  /**
   * Register a new extractor type.
   * @param name - Extractor identifier
   * @param extractorClass - Extractor class constructor
   */
  register(
    name: ExtractorType,
    extractorClass: new (...args: any[]) => IExtractor
  ): void {
    this.extractors.set(name, extractorClass);
  }

  /**
   * Get or create an extractor instance.
   * @param name - Extractor identifier
   * @param config - Optional configuration for the extractor
   * @returns Extractor instance
   * @throws Error if extractor not found
   */
  getExtractor(name: string, config?: any): IExtractor {
    // Check if already instantiated
    const cacheKey = `${name}:${JSON.stringify(config || {})}`;
    if (this.instances.has(cacheKey)) {
      return this.instances.get(cacheKey)!;
    }

    // Look up extractor class
    const extractorClass = this.extractors.get(name as ExtractorType);
    if (!extractorClass) {
      throw new Error(
        `Extractor '${name}' not found. Available: ${Array.from(this.extractors.keys()).join(", ")}`
      );
    }

    // Instantiate with config
    const instance = config
      ? new extractorClass(config)
      : new extractorClass();

    // Cache instance
    this.instances.set(cacheKey, instance);

    return instance;
  }

  /**
   * Get list of available extractors.
   */
  listExtractors(): string[] {
    return Array.from(this.extractors.keys());
  }

  /**
   * Clear instance cache (useful for testing).
   */
  clearCache(): void {
    this.instances.clear();
  }

  /**
   * Unregister an extractor.
   */
  unregister(name: ExtractorType): void {
    this.extractors.delete(name);
    // Clear related cached instances
    const keysToDelete: string[] = [];
    for (const [key] of this.instances) {
      if (key.startsWith(`${name}:`)) {
        keysToDelete.push(key);
      }
    }
    keysToDelete.forEach((key) => this.instances.delete(key));
  }
}

// Global singleton instance
let globalRegistry: ExtractorRegistry | null = null;

/**
 * Get the global extractor registry instance.
 */
export function getRegistry(): ExtractorRegistry {
  if (!globalRegistry) {
    globalRegistry = new ExtractorRegistry();
  }
  return globalRegistry;
}

/**
 * Convenience function: Get extractor by name from global registry.
 * @param name - Extractor name (e.g., 'image')
 * @param config - Optional configuration
 * @returns Extractor instance
 */
export function getExtractor(name: string, config?: any): IExtractor {
  return getRegistry().getExtractor(name, config);
}

/**
 * Reset global registry (useful for testing).
 */
export function resetRegistry(): void {
  globalRegistry = null;
}
