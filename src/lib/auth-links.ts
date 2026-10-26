export interface RecoveryLink {
  accessToken?: string;
  refreshToken?: string;
  code?: string;
  isRecovery: boolean;
}

function params(value: string) {
  const result = new Map<string, string>();
  for (const pair of value.split("&")) {
    const [rawKey, rawValue] = pair.split("=");
    if (!rawKey) continue;
    result.set(decodeURIComponent(rawKey), decodeURIComponent(rawValue ?? ""));
  }
  return result;
}

/** Reads a Supabase recovery URL without assuming PKCE or implicit flow. */
export function parseRecoveryLink(url: string | null): RecoveryLink {
  if (!url) return { isRecovery: false };
  const [beforeHash, hash = ""] = url.split("#");
  const query = beforeHash.includes("?") ? beforeHash.split("?")[1] ?? "" : "";
  const merged = new Map([...params(query), ...params(hash)]);
  const type = merged.get("type");
  const isRecovery = type === "recovery" || /reset-password/i.test(beforeHash);
  return {
    accessToken: merged.get("access_token") ?? undefined,
    refreshToken: merged.get("refresh_token") ?? undefined,
    code: merged.get("code") ?? undefined,
    isRecovery,
  };
}
