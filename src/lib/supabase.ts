import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Env } from '../types';

// Service-role (sb_secret_...) client — bypasses RLS.
// Every query built on top of this MUST manually filter by user_id.
// persistSession/autoRefreshToken disabled: the Worker is stateless per-request,
// so session persistence and background refresh timers would leak across isolate reuse.
export function getSupabaseClient(env: Env): SupabaseClient {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
