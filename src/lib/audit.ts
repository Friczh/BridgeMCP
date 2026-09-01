import type { Env } from '../types';
import { getSupabaseClient } from './supabase';

export interface AuditParams {
  userId: string;
  bridgeTokenId: string | null;
  connectionId: string | null;
  toolName: string;
  success: boolean;
  errorMessage?: string;
}

export async function logToolCall(params: AuditParams, env: Env): Promise<void> {
  const supabase = getSupabaseClient(env);
  await supabase.from('tool_call_audit').insert({
    user_id: params.userId,
    bridge_token_id: params.bridgeTokenId,
    connection_id: params.connectionId,
    tool_name: params.toolName,
    success: params.success,
    error_message: params.errorMessage ?? null,
  });
}
