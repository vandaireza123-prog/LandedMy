/** Headers for Supabase REST calls. Legacy JWT keys go in both apikey and Authorization; new `sb_secret_…` / `sb_publishable_…` keys are sent as apikey only (the gateway maps them to the role). */
export function sbHeaders(key: string, extra: Record<string, string> = {}): Record<string, string> {
  const h: Record<string, string> = { apikey: key, "content-type": "application/json", ...extra };
  if (!key.startsWith("sb_")) h.authorization = `Bearer ${key}`;
  return h;
}
