// Phase 27 — Ingestion Autonomy: Core type definitions

export type Lane = "fast" | "deep" | "quarantine";

export interface OperatorFlags {
  forceReingest?: boolean;
  skip?: boolean;
  quarantine?: boolean;
  overrideProfile?: string;
  overrideLane?: Lane;
}

export interface RoutedIngestionDecision {
  profile: string;
  lane: Lane;
  extractors: string[];
}

export interface VerificationResult {
  passed: boolean;
  errors: string[];
  cost: number;
}

export interface ExtractorResult {
  output: any;
  cost: number;
}

export interface Cost {
  extractorCost: number;
  verificationCost: number;
  totalCost: number;
}

export interface ManifestRecord {
  id: string;
  source: string;
  mediaType: string;
  profile: string;
  lane: Lane;
  extractorsRun: string[];
  verification: {
    passed: boolean;
    errors: string[];
  };
  operatorFlags: OperatorFlags;
  timestamps: {
    ingested?: string;
    verified?: string;
    indexed?: string;
  };
  routingVersion: string;
  retryCount: number;
  cost?: Cost;
}

export interface IngestionProfile {
  defaultLane: Lane;
  extractors: string[];
  maxSizeMB?: number;
  requiresOperatorApproval?: boolean;
  maxRetries?: number;
}

export interface IngestionProfiles {
  [profileName: string]: IngestionProfile;
}

export class FileLockedError extends Error {
  constructor(message: string = "Manifest file is locked by another process") {
    super(message);
    this.name = "FileLockedError";
  }
}
