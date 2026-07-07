import * as fs from "fs";
import * as path from "path";
import {
  Lane,
  RoutedIngestionDecision,
  IngestionProfiles,
} from "./types";

let cachedProfiles: IngestionProfiles;

function loadProfiles(): IngestionProfiles {
  if (cachedProfiles) return cachedProfiles;
  const profilesPath = path.join(__dirname, "ingestionProfiles.json");
  const profiles = JSON.parse(fs.readFileSync(profilesPath, "utf-8"));
  cachedProfiles = profiles;
  return cachedProfiles;
}

export function route(entry: any): RoutedIngestionDecision {
  const profiles = loadProfiles();

  const source = entry.source || "unknown";
  const mediaType = entry.mediaType || "unknown/unknown";
  const size = entry.size || 0;
  const retryCount = entry.retryCount || 0;
  const isDLQRepeat = entry.fromDLQ === true;

  let selectedProfile = "filesystem";

  // Exact profile match
  if (profiles[source]) {
    selectedProfile = source;
  }
  // Wildcard match: api:* → api:generic
  else if (source.startsWith("api:") && profiles["api:generic"]) {
    selectedProfile = "api:generic";
  }
  // Image detection
  else if (mediaType.startsWith("image/") && profiles.images) {
    selectedProfile = "images";
  }
  // PDF detection
  else if (mediaType === "application/pdf" && profiles.pdf) {
    selectedProfile = "pdf";
  }
  // Default fallback
  else {
    selectedProfile = "filesystem";
  }

  const profile = profiles[selectedProfile];
  if (!profile) {
    throw new Error(`Profile not found: ${selectedProfile}`);
  }

  // Lane selection heuristics
  let lane: Lane = profile.defaultLane;

  // Quarantine signals
  if (isDLQRepeat && retryCount >= (profile.maxRetries || 3)) {
    lane = "quarantine";
  } else if (size > (profile.maxSizeMB || 10) * 1024 * 1024) {
    lane = "quarantine";
  } else if (source === "unknown" && profile.defaultLane === "fast") {
    // Unknown sources downgrade to deep
    lane = "deep";
  }

  return {
    profile: selectedProfile,
    lane,
    extractors: profile.extractors || [],
  };
}
