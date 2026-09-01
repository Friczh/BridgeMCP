import type { Env } from '../types';
import { getSupabaseClient } from './supabase';
import { sha256Hex } from './hash';

export interface ResolvedBridgeToken {
  tokenId: string;
  userId: string;
}

// Plaintext token is never stored — only its hash. Loss of the DB
// doesn't leak usable tokens.
export async function resolveBridgeToken(token: string, env: Env): Promise<ResolvedBridgeToken | null> {
  const hash = await sha256Hex(token);
  const supabase = getSupabaseClient(env);

  const { data, error } = await supabase
    .from('mcp_bridge_tokens')
    .select('id, user_id, expires_at')
    .eq('token_hash', hash)
    .maybeSingle();

  if (error || !data) return null;
  if (data.expires_at && new Date(data.expires_at as string) < new Date()) return null;

  // Fire-and-forget last_used_at touch — doesn't block the request.
  void supabase
    .from('mcp_bridge_tokens')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', data.id as string);

  return { tokenId: data.id as string, userId: data.user_id as string };
}

export function generateBridgeToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  let out = '';
  for (const b of bytes) out += alphabet[b % alphabet.length];
  return out;
}
