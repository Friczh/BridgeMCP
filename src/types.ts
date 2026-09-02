export interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  SUPABASE_JWT_SECRET: string;
  // Public anon key — needed server-side (not just by the browser) to call
  // Supabase Auth's password-grant and MFA challenge/verify endpoints on the
  // user's behalf during the /manage/account/reauth flow. Safe by the same
  // reasoning as the browser's copy: RLS-gated, meant to be public.
  SUPABASE_ANON_KEY: string;
  // Signs the short-lived reauth tokens issued by /manage/account/reauth/*.
  // Deliberately separate from SUPABASE_JWT_SECRET — different blast radius
  // (a leak here only forges a 2-minute reauth grant, not a full session).
  REAUTH_JWT_SECRET: string;
  ENCRYPTION_KEY: string;
  ALLOWED_ORIGIN: string;
  BRIDGE_BASE_URL: string;
  // Rate limiting binding — per design.md "Rate Limiting" section.
  // Keyed by user_id, 100 req/min fixed window, /bridge/mcp only.
  BRIDGE_RATE_LIMITER: { limit: (opts: { key: string }) => Promise<{ success: boolean }> };
}