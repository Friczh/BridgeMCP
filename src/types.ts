export interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  SUPABASE_JWT_SECRET: string;
  ENCRYPTION_KEY: string;
  ALLOWED_ORIGIN: string;
  BRIDGE_BASE_URL: string;
  // Rate limiting binding — per design.md "Rate Limiting" section.
  // Keyed by user_id, 100 req/min fixed window, /bridge/mcp only.
  BRIDGE_RATE_LIMITER: { limit: (opts: { key: string }) => Promise<{ success: boolean }> };
}