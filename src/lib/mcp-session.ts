import type { Env } from '../types';
import { getSupabaseClient } from './supabase';

// Persists Mcp-Session-Id per connection for backends that implement the
// Streamable HTTP transport's session requirement (initialize mints a
// session; every subsequent call must echo Mcp-Session-Id or gets rejected).
// Session-less backends never populate this table — see design.md
// "MCP Session Lifecycle" addendum.

export async function getSessionId(connectionId: string, env: Env): Promise<string | null> {
  const supabase = getSupabaseClient(env);
  const { data } = await supabase
    .from('mcp_sessions')
    .select('session_id')
    .eq('connection_id', connectionId)
    .maybeSingle();

  return (data?.session_id as string | undefined) ?? null;
}

export async function setSessionId(connectionId: string, sessionId: string, env: Env): Promise<void> {
  const supabase = getSupabaseClient(env);
  await supabase.from('mcp_sessions').upsert({
    connection_id: connectionId,
    session_id: sessionId,
    last_used_at: new Date().toISOString(),
  });
}

export async function clearSessionId(connectionId: string, env: Env): Promise<void> {
  const supabase = getSupabaseClient(env);
  await supabase.from('mcp_sessions').delete().eq('connection_id', connectionId);
}
