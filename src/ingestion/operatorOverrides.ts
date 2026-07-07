import * as fs from "fs";
import * as path from "path";
import { OperatorFlags, Lane } from "./types";

interface OperatorOverride {
  forceReingest?: boolean;
  skip?: boolean;
  quarantine?: boolean;
  overrideProfile?: string;
  overrideLane?: Lane;
}

interface OperatorOverridesMap {
  [entryId: string]: OperatorOverride;
}

let cachedOverrides: OperatorOverridesMap | null = null;

export function loadOperatorOverrides(): OperatorOverridesMap {
  if (cachedOverrides) return cachedOverrides;

  const overridesPath = path.join(__dirname, "operatorOverrides.json");

  try {
    if (!fs.existsSync(overridesPath)) {
      cachedOverrides = {};
      return cachedOverrides;
    }

    const raw = JSON.parse(fs.readFileSync(overridesPath, "utf-8"));

    // Filter out metadata keys
    cachedOverrides = Object.entries(raw).reduce((acc, [key, value]) => {
      if (!key.startsWith("_")) {
        acc[key] = value as OperatorOverride;
      }
      return acc;
    }, {} as OperatorOverridesMap);

    return cachedOverrides;
  } catch (err) {
    console.warn("[OperatorOverrides] Failed to load:", err);
    cachedOverrides = {};
    return cachedOverrides;
  }
}

export function clearCache(): void {
  cachedOverrides = null;
}

export function applyOverride(
  entry: any,
  override: OperatorOverride
): { operatorFlags: OperatorFlags; skip: boolean; profile?: string; lane?: Lane } {
  const operatorFlags: OperatorFlags = {
    forceReingest: override.forceReingest,
    skip: override.skip,
    quarantine: override.quarantine,
    overrideProfile: override.overrideProfile,
    overrideLane: override.overrideLane,
  };

  return {
    operatorFlags,
    skip: override.skip === true,
    profile: override.overrideProfile,
    lane: override.overrideLane,
  };
}

export function getOverrideForEntry(entry: any): OperatorOverride | null {
  if (!entry.id) return null;

  const overrides = loadOperatorOverrides();
  return overrides[entry.id] || null;
}
