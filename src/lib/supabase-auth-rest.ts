import type { Env } from '../types';
import { ApiError } from './errors';

// Raw fetches against Supabase Auth (GoTrue) REST endpoints — used instead of
// the supabase-js client for the handful of auth operations it doesn't
// expose (password-grant re-verification, factor challenge/verify on behalf
// of the calling user, admin factor deletion). Kept in one file so the
// endpoint shapes are easy to re-check against Supabase's docs if they change.

interface SupabaseUserFactor {
  id: string;
  factor_type: string;
  status: string;
}

interface SupabaseAuthUser {
  id: string;
  factors?: SupabaseUserFactor[];
}

// Step 1 of reauth: re-verify the current password. This is the same check
// `signInWithPassword` does client-side, just executed server-side so a
// compromised session token alone can't skip it — the caller still needs the
// actual password.
export async function verifyPasswordGrant(email: string, password: string, env: Env): Promise<{ access_token: string }> {
  const res = await fetch(`${env.SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: env.SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    throw new ApiError(401, 'unauthorized', 'incorrect password');
  }
  const data = (await res.json()) as { access_token?: string };
  if (!data.access_token) {
    throw new ApiError(502, 'bad_gateway', 'malformed response from auth provider');
  }
  return { access_token: data.access_token };
}

// Looks up the caller's verified TOTP factor using a freshly-minted access
// token (from verifyPasswordGrant), rather than trusting anything the client
// claims about its own factors.
export async function findVerifiedTotpFactor(accessToken: string, env: Env): Promise<SupabaseUserFactor | null> {
  const res = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: env.SUPABASE_ANON_KEY, Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new ApiError(502, 'bad_gateway', 'failed to load user factors');
  const user = (await res.json()) as SupabaseAuthUser;
  return user.factors?.find((f) => f.factor_type === 'totp' && f.status === 'verified') ?? null;
}

// Step 2 of reauth: challenge + verify a fresh TOTP code against the factor,
// using the access token captured in step 1. Combines both GoTrue calls
// since the Worker has no reason to expose an intermediate challenge_id.
export async function verifyTotpCode(
  factorId: string,
  code: string,
  accessToken: string,
  env: Env
): Promise<void> {
  const challengeRes = await fetch(`${env.SUPABASE_URL}/auth/v1/factors/${factorId}/challenge`, {
    method: 'POST',
    headers: { apikey: env.SUPABASE_ANON_KEY, Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
  });
  if (!challengeRes.ok) throw new ApiError(502, 'bad_gateway', 'failed to start MFA challenge');
  const challenge = (await challengeRes.json()) as { id?: string };
  if (!challenge.id) throw new ApiError(502, 'bad_gateway', 'malformed challenge response');

  const verifyRes = await fetch(`${env.SUPABASE_URL}/auth/v1/factors/${factorId}/verify`, {
    method: 'POST',
    headers: { apikey: env.SUPABASE_ANON_KEY, Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ challenge_id: challenge.id, code }),
  });
  if (!verifyRes.ok) throw new ApiError(401, 'unauthorized', 'invalid code');
}

// ---- Admin-scoped operations (service role key) ----
// Used only after a completed reauth grant (see lib/reauth.ts).

export async function adminFindVerifiedTotpFactor(userId: string, env: Env): Promise<SupabaseUserFactor | null> {
  const res = await fetch(`${env.SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
    headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` },
  });
  if (!res.ok) throw new ApiError(502, 'bad_gateway', 'failed to load user');
  const user = (await res.json()) as SupabaseAuthUser;
  return user.factors?.find((f) => f.factor_type === 'totp' && f.status === 'verified') ?? null;
}

export async function adminDeleteFactor(userId: string, factorId: string, env: Env): Promise<void> {
  const res = await fetch(`${env.SUPABASE_URL}/auth/v1/admin/users/${userId}/factors/${factorId}`, {
    method: 'DELETE',
    headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` },
  });
  if (!res.ok) throw new ApiError(502, 'bad_gateway', 'failed to remove MFA factor');
}
