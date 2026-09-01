import { Hono } from 'hono';
import type { Env } from '../types';
import { resolveBridgeToken } from '../lib/auth-bridge-token';
import { getSupabaseClient } from '../lib/supabase';
import { getCachedTools, setCachedTools } from '../lib/tool-cache';
import { callBackendMcp, BackendError, type ConnectionRow } from '../lib/mcp-fanout';
import { logToolCall } from '../lib/audit';
import { ApiError } from '../lib/errors';

const bridge = new Hono<{ Bindings: Env }>();

// No browser calls this route (AI clients only) — CORS headers aren't
// needed, but OPTIONS still short-circuits before any DB lookup.
bridge.options('/mcp', (c) => c.body(null, 204));

bridge.post('/mcp', async (c) => {
  const token = c.req.query('token');
  if (!token) throw new ApiError(401, 'unauthorized', 'invalid bridge token');
  const auth = await resolveBridgeToken(token, c.env);
  if (!auth) throw new ApiError(401, 'unauthorized', 'invalid bridge token');

  // Per-user fixed-window rate limit (100/min), keyed by user_id — combines
  // across all of that user's bridge tokens. Cloudflare native binding, no
  // DB hit. Not written to tool_call_audit (avoid audit spam under abuse).
  // See design.md "Rate Limiting (per-user, bridge path only)".
  const { success: withinLimit } = await c.env.BRIDGE_RATE_LIMITER.limit({ key: auth.userId });
  if (!withinLimit) throw new ApiError(429, 'rate_limited', 'too many requests');

  const body = await c.req.json().catch(() => null);
  if (!body || typeof body.method !== 'string') {
    throw new ApiError(400, 'bad_request', 'missing "method" field');
  }

  // MCP handshake: every compliant client (including claude.ai) sends this
  // first, before tools/list. Must respond with protocolVersion + serverInfo
  // or the client treats the connection as failed.
  if (body.method === 'initialize') {
    return c.json({
      jsonrpc: '2.0',
      id: body.id ?? 1,
      result: {
        protocolVersion: '2025-03-26',
        capabilities: { tools: {} },
        serverInfo: { name: 'BridgeMCP', version: '1.0.0' },
      },
    });
  }

  // Notification (no id, no response body expected) — client fires this
  // after initialize completes. Must not fall through to "unsupported method".
  if (body.method === 'notifications/initialized') {
    return c.body(null, 202);
  }

  const supabase = getSupabaseClient(c.env);
  const { data: connections, error } = await supabase
    .from('mcp_connections')
    .select('id, name, server_url, auth_type, encrypted_credentials')
    .eq('user_id', auth.userId);

  if (error) throw new ApiError(502, 'bad_gateway', error.message);
  const rows = (connections ?? []) as ConnectionRow[];

  if (body.method === 'tools/list') {
    return c.json({
      jsonrpc: '2.0',
      id: body.id ?? 1,
      result: { tools: await listAllTools(rows, auth, c.env) },
    });
  }

  if (body.method === 'tools/call') {
    return c.json({
      jsonrpc: '2.0',
      id: body.id ?? 1,
      result: await callTool(rows, body.params, auth, c.env),
    });
  }

  throw new ApiError(400, 'bad_request', `unsupported method: ${body.method}`);
});

async function listAllTools(
  rows: ConnectionRow[],
  auth: { userId: string; tokenId: string },
  env: Env
): Promise<unknown[]> {
  const merged: unknown[] = [];

  for (const conn of rows) {
    let tools = await getCachedTools(conn.id, env);

    if (!tools) {
      try {
        const result = (await callBackendMcp(conn, 'tools/list', {}, env)) as {
          result?: { tools?: unknown[] };
        };
        tools = result?.result?.tools ?? [];
        await setCachedTools(conn.id, tools, env);
      } catch (err) {
        // A broken connection should not take down the whole merged list —
        // log it and skip, rather than failing tools/list entirely.
        await logToolCall(
          {
            userId: auth.userId,
            bridgeTokenId: auth.tokenId,
            connectionId: conn.id,
            toolName: `${conn.name}__tools/list`,
            success: false,
            errorMessage: err instanceof Error ? err.message : 'unknown error',
          },
          env
        );
        continue;
      }
    }

    for (const t of tools) {
      merged.push({ ...(t as object), name: `${conn.name}__${(t as { name: string }).name}` });
    }
  }

  return merged;
}

async function callTool(
  rows: ConnectionRow[],
  params: { name?: string; arguments?: unknown } | undefined,
  auth: { userId: string; tokenId: string },
  env: Env
): Promise<unknown> {
  const fullName = params?.name ?? '';
  const sepIdx = fullName.indexOf('__');
  if (sepIdx === -1) throw new ApiError(404, 'not_found', 'malformed tool name (expected connection__tool)');

  const connName = fullName.slice(0, sepIdx);
  const toolName = fullName.slice(sepIdx + 2);

  const conn = rows.find((r) => r.name === connName);
  if (!conn) throw new ApiError(404, 'not_found', `no connection named '${connName}'`);

  try {
    const result = (await callBackendMcp(conn, 'tools/call', { name: toolName, arguments: params?.arguments ?? {} }, env)) as {
      result?: unknown;
    };

    await logToolCall(
      { userId: auth.userId, bridgeTokenId: auth.tokenId, connectionId: conn.id, toolName: fullName, success: true },
      env
    );

    return result.result;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'backend error';
    await logToolCall(
      {
        userId: auth.userId,
        bridgeTokenId: auth.tokenId,
        connectionId: conn.id,
        toolName: fullName,
        success: false,
        errorMessage: message,
      },
      env
    );

    if (err instanceof BackendError) {
      throw new ApiError(err.status, err.status === 504 ? 'gateway_timeout' : 'bad_gateway', message);
    }
    throw new ApiError(502, 'bad_gateway', message);
  }
}

export default bridge;
