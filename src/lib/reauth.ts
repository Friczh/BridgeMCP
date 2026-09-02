import { SignJWT, jwtVerify } from 'jose';
import type { Env } from '../types';
import { ApiError } from './errors';

// Two-stage reauth: 'password_verified' (issued after a correct password
// re-check, only usable to submit an MFA code) and 'complete' (issued after
// MFA re-check, or immediately after password if the account has no verified
// TOTP factor — this is the token protected mutations require).
// Short TTL is the actual security boundary here, not single-use enforcement:
// the Worker is stateless (per design.md), so there's no server-side store to
// mark a token "spent." A 2-minute window of reuse by the same authenticated
// session is an accepted tradeoff — consistent with e.g. Stripe/GitHub's
// "recently authenticated" grace windows.
const TTL_SECONDS = 120;

interface PasswordVerifiedClaims {
  sub: string;
  stage: 'password_verified';
  factor_id: string;
  // The Supabase access_token minted by the password-grant call in step 1,
  // carried through so step 2 can use it to challenge/verify the TOTP
  // factor. JWT payloads aren't encrypted, only signed — this token is only
  // ever equal in privilege to the caller's own existing session, so
  // decodability by that same caller isn't a privilege escalation.
  access_token: string;
}

interface CompleteClaims {
  sub: string;
  stage: 'complete';
}

async function sign(payload: Record<string, unknown>, env: Env): Promise<string> {
  const secret = new TextEncoder().encode(env.REAUTH_JWT_SECRET);
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${TTL_SECONDS}s`)
    .sign(secret);
}

export function signPasswordVerifiedToken(
  claims: Omit<PasswordVerifiedClaims, 'stage'>,
  env: Env
): Promise<string> {
  return sign({ ...claims, stage: 'password_verified' }, env);
}

export function signCompleteToken(sub: string, env: Env): Promise<string> {
  return sign({ sub, stage: 'complete' }, env);
}

async function verify<T>(token: string, env: Env): Promise<T> {
  const secret = new TextEncoder().encode(env.REAUTH_JWT_SECRET);
  try {
    const { payload } = await jwtVerify(token, secret, { algorithms: ['HS256'] });
    return payload as T;
  } catch {
    throw new ApiError(401, 'unauthorized', 'reauthentication expired or invalid');
  }
}

export async function verifyPasswordVerifiedToken(
  token: string,
  userId: string,
  env: Env
): Promise<PasswordVerifiedClaims> {
  const claims = await verify<PasswordVerifiedClaims>(token, env);
  if (claims.stage !== 'password_verified' || claims.sub !== userId) {
    throw new ApiError(401, 'unauthorized', 'reauthentication expired or invalid');
  }
  return claims;
}

// Verifies the header on any mutation route that requires a completed
// reauth grant. `sub` binding to the caller's real session JWT prevents a
// reauth token issued for one user being replayed under another user's
// session.
export async function requireReauthToken(headerValue: string | undefined, userId: string, env: Env): Promise<void> {
  if (!headerValue) {
    throw new ApiError(401, 'unauthorized', 'reauthentication required');
  }
  const claims = await verify<CompleteClaims>(headerValue, env);
  if (claims.stage !== 'complete' || claims.sub !== userId) {
    throw new ApiError(401, 'unauthorized', 'reauthentication expired or invalid');
  }
}
