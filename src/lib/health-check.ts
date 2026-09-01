import type { Env } from '../types';
import { callBackendMcp, BackendError, type ConnectionRow } from './mcp-fanout';

export interface HealthCheckResult {
  status: 'ok' | 'error' | 'timeout';
  http_status?: number; // the backend's actual HTTP status (404, 400, etc.) when known
  detail?: string;
  latency_ms: number;
}

// Sends a real `initialize` request to a connection's server_url and reports
// pass/fail. Used synchronously right after a connection is created, on-demand
// via POST /connections/:id/check, and by the periodic cron sweep — one
// implementation, three callers, so the pass/fail definition never drifts.
export async function checkConnectionHealth(conn: ConnectionRow, env: Env): Promise<HealthCheckResult> {
  const started = Date.now();

  try {
    await callBackendMcp(
      conn,
      'initialize',
      { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'BridgeMCP', version: '1.0.0' } },
      env
    );
    return { status: 'ok', latency_ms: Date.now() - started };
  } catch (err) {
    const latency_ms = Date.now() - started;
    if (err instanceof BackendError) {
      return {
        status: err.status === 504 ? 'timeout' : 'error',
        http_status: err.backendStatus,
        detail: err.message,
        latency_ms,
      };
    }
    return { status: 'error', detail: err instanceof Error ? err.message : 'unknown error', latency_ms };
  }
}

