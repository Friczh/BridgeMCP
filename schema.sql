-- BridgeMCP database schema
-- Run this once in Supabase SQL Editor (Dashboard → SQL Editor → New query)

create table mcp_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  server_url text not null,
  auth_type text not null,
  encrypted_credentials text,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);
alter table mcp_connections enable row level security;
create policy "own connections" on mcp_connections
  for all using (auth.uid() = user_id);

create table tool_cache (
  connection_id uuid primary key references mcp_connections(id) on delete cascade,
  tools jsonb not null,
  cached_at timestamptz not null default now()
);
alter table tool_cache enable row level security;
create policy "own tool cache" on tool_cache
  for all using (
    connection_id in (select id from mcp_connections where user_id = auth.uid())
  );

create table mcp_bridge_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  token_hash text not null unique,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);
alter table mcp_bridge_tokens enable row level security;
create policy "own tokens" on mcp_bridge_tokens
  for all using (auth.uid() = user_id);

create table tool_call_audit (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  bridge_token_id uuid references mcp_bridge_tokens(id) on delete set null,
  connection_id uuid references mcp_connections(id) on delete set null,
  tool_name text not null,
  success boolean not null,
  error_message text,
  called_at timestamptz not null default now()
);
alter table tool_call_audit enable row level security;
create policy "own audit log" on tool_call_audit
  for select using (auth.uid() = user_id);
