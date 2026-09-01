import type { Env } from '../types';
import { getSupabaseClient } from './supabase';

const TTL_MS = 5 * 60 * 1000; // 5 minutes — TTL enforced here, not a DB constraint.

export async function getCachedTools(connectionId: string, env: Env): Promise<unknown[] | null> {
  const supabase = getSupabaseClient(env);
  const { data } = await supabase
    .from('tool_cache')
    .select('tools, cached_at')
    .eq('connection_id', connectionId)
    .maybeSingle();

  if (!data) return null;

  const age = Date.now() - new Date(data.cached_at as string).getTime();
  if (age > TTL_MS) return null;

  return data.tools as unknown[];
}

export async function setCachedTools(connectionId: string, tools: unknown[], env: Env): Promise<void> {
  const supabase = getSupabaseClient(env);
  await supabase.from('tool_cache').upsert({
    connection_id: connectionId,
    tools,
    cached_at: new Date().toISOString(),
  });
}
