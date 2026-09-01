import { Hono } from 'hono';
import type { Env } from '../types';
import { verifySupabaseJwt } from '../lib/auth-jwt';
import { getSupabaseClient } from '../lib/supabase';
import { encryptJson } from '../lib/crypto';
import { sha256Hex } from '../lib/hash';
import { generateBridgeToken } from '../lib/auth-bridge-token';
import { createConnectionSchema } from '../schemas/connections';
import { createTokenSchema } from '../schemas/tokens';
import { auditQuerySchema, auditStatsQuerySchema } from '../schemas/audit';
import { normalizeDateFrom, normalizeDateTo } from '../lib/date-range';
import { rangeStartIso, bucketByDay } from '../lib/audit-stats';
import { ApiError } from '../lib/errors';
import { checkConnectionHealth } from '../lib/health-check';
import type { ConnectionRow } from '../lib/mcp-fanout';

type Vars = { userId: string };

const manage = new Hono<{ Bindings: Env; Variables: Vars }>();

// Every route below requires a valid Supabase user JWT.
// CORS/OPTIONS preflight is handled upstream in src/index.ts, BEFORE this
// middleware runs — do not reorder that.
manage.use('*', async (c, next) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    throw new ApiError(401, 'unauthorized', 'missing bearer token');
  }
  const token = authHeader.slice('Bearer '.length);

  try {
    const { sub } = await verifySupabaseJwt(token, c.env);
    c.set('userId', sub);
  } catch {
    // Never leak which specific check failed.
    throw new ApiError(401, 'unauthorized', 'invalid token');
  }

  await next();
});

// ---- Connections ----

manage.get('/connections', async (c) => {
  const supabase = getSupabaseClient(c.env);
  const { data, error } = await supabase
    .from('mcp_connections')
    .select('id, name, server_url, auth_type, created_at, last_checked_at, last_status, last_check_detail')
    .eq('user_id', c.get('userId'));

  if (error) throw new ApiError(502, 'bad_gateway', error.message);
  return c.json({ connections: data ?? [] });
});

manage.post('/connections', async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = createConnectionSchema.safeParse(body);
  if (!parsed.success) {
    throw new ApiError(400, 'bad_request', JSON.stringify(parsed.error.issues));
  }
  const { name, server_url, auth_type, credentials } = parsed.data;

  let encrypted_credentials: string | null = null;
  if (auth_type !== 'none') {
    if (!credentials) throw new ApiError(400, 'bad_request', 'credentials required for this auth_type');
    if (auth_type === 'header' && !credentials.header) {
      throw new ApiError(400, 'bad_request', 'credentials.header required when auth_type is "header"');
    }
    encrypted_credentials = await encryptJson(credentials, c.env);
  }

  const supabase = getSupabaseClient(c.env);
  const { data, error } = await supabase
    .from('mcp_connections')
    .insert({
      user_id: c.get('userId'),
      name,
      server_url,
      auth_type,
      encrypted_credentials,
    })
    .select('id, name, server_url, auth_type, created_at, encrypted_credentials')
    .single();

  if (error) {
    if (error.code === '23505') {
      throw new ApiError(400, 'bad_request', 'a connection with this name already exists');
    }
    throw new ApiError(502, 'bad_gateway', error.message);
  }

  // Best-effort liveness check right after creation — never blocks the
  // connection from being saved, just tells the popup whether it's actually
  // reachable so a typo'd URL or a 404/400 backend surfaces immediately
  // instead of silently failing on the first real tool call later.
  const check = await checkConnectionHealth(data as ConnectionRow, c.env);
  await supabase
    .from('mcp_connections')
    .update({
      last_checked_at: new Date().toISOString(),
      last_status: check.status,
      last_check_detail: check.http_status ? `HTTP ${check.http_status}: ${check.detail}` : check.detail ?? null,
    })
    .eq('id', data.id);

  const { encrypted_credentials: _omit, ...connection } = data;
  return c.json({ connection, check }, 201);
});

manage.delete('/connections/:id', async (c) => {
  const supabase = getSupabaseClient(c.env);
  const { error, count } = await supabase
    .from('mcp_connections')
    .delete({ count: 'exact' })
    .eq('id', c.req.param('id'))
    .eq('user_id', c.get('userId'));

  if (error) throw new ApiError(502, 'bad_gateway', error.message);
  if (!count) throw new ApiError(404, 'not_found');
  return c.json({ deleted: true });
});

// Live-checks a single backend MCP server by sending it a real `initialize`
// request. Does not touch tool_cache — this is a liveness probe, not a
// tools/list refresh. Scoped by user_id same as every other route here.
// Result is persisted (last_checked_at/last_status/last_check_detail) so the
// dashboard can show status without re-checking on every page load.
manage.post('/connections/:id/check', async (c) => {
  const supabase = getSupabaseClient(c.env);
  const { data, error } = await supabase
    .from('mcp_connections')
    .select('id, name, server_url, auth_type, encrypted_credentials')
    .eq('id', c.req.param('id'))
    .eq('user_id', c.get('userId'))
    .maybeSingle();

  if (error) throw new ApiError(502, 'bad_gateway', error.message);
  if (!data) throw new ApiError(404, 'not_found');

  const check = await checkConnectionHealth(data as ConnectionRow, c.env);

  await supabase
    .from('mcp_connections')
    .update({
      last_checked_at: new Date().toISOString(),
      last_status: check.status,
      last_check_detail: check.http_status ? `HTTP ${check.http_status}: ${check.detail}` : check.detail ?? null,
    })
    .eq('id', data.id);

  return c.json(check);
});

// ---- Bridge tokens ----
// GET never returns the token value or its hash — metadata only.

manage.get('/tokens', async (c) => {
  const supabase = getSupabaseClient(c.env);
  const { data, error } = await supabase
    .from('mcp_bridge_tokens')
    .select('id, name, expires_at, created_at, last_used_at')
    .eq('user_id', c.get('userId'));

  if (error) throw new ApiError(502, 'bad_gateway', error.message);
  return c.json({ tokens: data ?? [] });
});

manage.post('/tokens', async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = createTokenSchema.safeParse(body);
  if (!parsed.success) {
    throw new ApiError(400, 'bad_request', JSON.stringify(parsed.error.issues));
  }
  const { name, expiry } = parsed.data;

  const plaintext = generateBridgeToken();
  const token_hash = await sha256Hex(plaintext);

  let expires_at: string | null = null;
  if (expiry !== 'never') {
    const days = expiry === '30d' ? 30 : expiry === '90d' ? 90 : 365;
    expires_at = new Date(Date.now() + days * 86_400_000).toISOString();
  }

  const supabase = getSupabaseClient(c.env);
  const { data, error } = await supabase
    .from('mcp_bridge_tokens')
    .insert({ user_id: c.get('userId'), name, token_hash, expires_at })
    .select('id, name, expires_at, created_at')
    .single();

  if (error) throw new ApiError(502, 'bad_gateway', error.message);

  const bridge_url = `${c.env.BRIDGE_BASE_URL}/bridge/mcp?token=${plaintext}`;

  // Plaintext (and the URL built from it) shown exactly once, here.
  // Neither is ever retrievable again after this response.
  return c.json({ token: plaintext, bridge_url, ...data }, 201);
});

manage.delete('/tokens/:id', async (c) => {
  const supabase = getSupabaseClient(c.env);
  const { error, count } = await supabase
    .from('mcp_bridge_tokens')
    .delete({ count: 'exact' })
    .eq('id', c.req.param('id'))
    .eq('user_id', c.get('userId'));

  if (error) throw new ApiError(502, 'bad_gateway', error.message);
  if (!count) throw new ApiError(404, 'not_found');
  return c.json({ deleted: true });
});

// ---- Audit log ----
// Filters combine as AND. `connection_id`/`bridge_token_id` accept a uuid
// or the sentinel "null" to match rows orphaned by `on delete set null`.

manage.get('/audit', async (c) => {
  const parsed = auditQuerySchema.safeParse(Object.fromEntries(new URL(c.req.url).searchParams));
  if (!parsed.success) {
    throw new ApiError(400, 'bad_request', JSON.stringify(parsed.error.issues));
  }
  const { limit, offset, tool_name, success, date_from, date_to, connection_id, bridge_token_id } = parsed.data;

  const supabase = getSupabaseClient(c.env);
  let query = supabase
    .from('tool_call_audit')
    .select('id, tool_name, success, error_message, bridge_token_id, connection_id, called_at')
    .eq('user_id', c.get('userId'));

  if (tool_name) query = query.ilike('tool_name', `%${tool_name}%`);
  if (success !== undefined) query = query.eq('success', success === 'true');
  if (date_from) query = query.gte('called_at', normalizeDateFrom(date_from));
  if (date_to) query = query.lte('called_at', normalizeDateTo(date_to));
  if (connection_id) {
    query = connection_id === 'null' ? query.is('connection_id', null) : query.eq('connection_id', connection_id);
  }
  if (bridge_token_id) {
    query =
      bridge_token_id === 'null' ? query.is('bridge_token_id', null) : query.eq('bridge_token_id', bridge_token_id);
  }

  const { data, error } = await query.order('called_at', { ascending: false }).range(offset, offset + limit - 1);

  if (error) throw new ApiError(502, 'bad_gateway', error.message);
  return c.json({ audit: data ?? [] });
});

// Grouped by date(called_at)/success, scoped to user_id. Zero-filled across
// the full range — a day with no calls still appears with 0/0 rather than
// being absent, so the frontend chart doesn't need to fill gaps itself.
manage.get('/audit/stats', async (c) => {
  const parsed = auditStatsQuerySchema.safeParse(Object.fromEntries(new URL(c.req.url).searchParams));
  if (!parsed.success) {
    throw new ApiError(400, 'bad_request', JSON.stringify(parsed.error.issues));
  }
  const { days } = parsed.data;

  const supabase = getSupabaseClient(c.env);
  const { data, error } = await supabase
    .from('tool_call_audit')
    .select('called_at, success')
    .eq('user_id', c.get('userId'))
    .gte('called_at', rangeStartIso(days));

  if (error) throw new ApiError(502, 'bad_gateway', error.message);
  return c.json({ stats: bucketByDay(data ?? [], days) });
});

// Unconditional — deletes ALL of the user's audit rows regardless of any
// filters currently active in the UI (locked decision in design.md: "always
// clear everything," not scoped to the current filtered view). No soft
// delete, no undo.
manage.delete('/audit', async (c) => {
  const supabase = getSupabaseClient(c.env);
  const { error } = await supabase.from('tool_call_audit').delete().eq('user_id', c.get('userId'));

  if (error) throw new ApiError(502, 'bad_gateway', error.message);
  return c.json({ deleted: true });
});

export default manage;
