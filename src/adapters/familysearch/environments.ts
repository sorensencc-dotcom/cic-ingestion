export type FamilySearchEnv = "beta" | "production";

export interface FamilySearchHosts {
  api: string;
  ident: string;
}

export const FAMILYSEARCH_HOSTS: Record<FamilySearchEnv, FamilySearchHosts> = {
  beta: {
    api: "https://apibeta.familysearch.org",
    ident: "https://identbeta.familysearch.org",
  },
  production: {
    api: "https://api.familysearch.org",
    ident: "https://ident.familysearch.org",
  },
};

export const TOKEN_PATH = "/cis-web/oauth2/v3/token";
export const AUTHORIZATION_PATH = "/cis-web/oauth2/v3/authorization";

export function parseFamilySearchEnv(raw: string | undefined): FamilySearchEnv {
  const value = (raw ?? "beta").trim().toLowerCase();
  if (value === "beta" || value === "production") return value;
  throw new Error(
    `Invalid FAMILYSEARCH_ENV "${raw}": expected "beta" or "production"`
  );
}
