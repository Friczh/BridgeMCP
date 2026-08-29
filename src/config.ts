// Only values design.md classifies as safe to be public ever live here.
// Everything else (service role key, JWT secret, encryption key) is
// Worker-only and must never appear in this codebase or any .env file
// read by Vite, since VITE_* values are inlined into the static bundle.

function requireEnv(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Missing required env var: ${name}. Check .env / .env.local.`);
  }
  return value;
}

export const CONFIG = {
  SUPABASE_URL: requireEnv('VITE_SUPABASE_URL', import.meta.env.VITE_SUPABASE_URL),
  SUPABASE_ANON_KEY: requireEnv('VITE_SUPABASE_ANON_KEY', import.meta.env.VITE_SUPABASE_ANON_KEY),
  WORKER_URL: requireEnv('VITE_WORKER_URL', import.meta.env.VITE_WORKER_URL),
} as const;
