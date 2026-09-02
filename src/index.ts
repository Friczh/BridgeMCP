import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Env } from './types';
import manage from './routes/manage';
import bridge from './routes/bridge';
import { ApiError } from './lib/errors';
import { getSupabaseClient } from './lib/supabase';
import { checkConnectionHealth } from './lib/health-check';
import type { ConnectionRow } from './lib/mcp-fanout';

const app = new Hono<{ Bindings: Env }>();

// CORS (incl. OPTIONS preflight short-circuit) MUST run before any auth
// middleware on /manage/*. Reordering this was the root cause of the
// earlier "401 despite valid login" bug — do not move this below manage.use(...).
app.use(
  '/manage/*',
  cors({
    origin: (_origin, c) => c.env.ALLOWED_ORIGIN,
    allowMethods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'X-Reauth-Token'],
  })
);

app.get('/', (c) => c.json({ service: 'BridgeMCP', status: 'ok', pages: 'https://bridgemcp.pages.dev' }));
app.get('/health', (c) => c.json({ status: 'ok' }));

app.route('/manage', manage);
app.route('/bridge', bridge);

app.notFound((c) => c.json({ error: 'not_found' }, 404));

app.onError((err, c) => {
  if (err instanceof ApiError) {
    return c.json({ error: err.code, detail: err.message }, err.status as 400 | 401 | 404 | 429 | 502 | 504);
  }
  console.error(err);
  return c.json({ error: 'internal_error' }, 500);
});

// Periodic liveness sweep — runs on the Cron Trigger defined in
// wrangler.jsonc (every 15 min). Iterates every connection across all users
// (system job, not user-scoped) and updates last_checked_at/last_status.
// Capped at 200 per run: fine for current scale, revisit with pagination or
// a queue if the connection count grows past that.
async function runHealthCheckSweep(env: Env): Promise<void> {
  const supabase = getSupabaseClient(env);
  const { data, error } = await supabase
    .from('mcp_connections')
    .select('id, name, server_url, auth_type, encrypted_credentials')
    .limit(200);

  if (error || !data) {
    console.error('health check sweep: failed to load connections', error);
    return;
  }

  // Run checks with limited concurrency so we don't fire 200 simultaneous
  // outbound requests from one isolate — batches of 10.
  const BATCH_SIZE = 10;
  for (let i = 0; i < data.length; i += BATCH_SIZE) {
    const batch = data.slice(i, i + BATCH_SIZE);
    await Promise.all(
      batch.map(async (conn) => {
        const check = await checkConnectionHealth(conn as ConnectionRow, env);
        await supabase
          .from('mcp_connections')
          .update({
            last_checked_at: new Date().toISOString(),
            last_status: check.status,
            last_check_detail: check.http_status ? `HTTP ${check.http_status}: ${check.detail}` : check.detail ?? null,
          })
          .eq('id', conn.id);
      })
    );
  }
}

export default {
  fetch: app.fetch,
  scheduled: async (_event: ScheduledEvent, env: Env, ctx: ExecutionContext) => {
    ctx.waitUntil(runHealthCheckSweep(env));
  },
};