import { jwtVerify, createRemoteJWKSet, decodeProtectedHeader } from 'jose';
import type { Env } from '../types';

export class AuthError extends Error {}

// Module-scope cache: reused across requests within a warm isolate.
// createRemoteJWKSet defers the actual network fetch until first jwtVerify call.
let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

function getJwks(env: Env) {
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(`${env.SUPABASE_URL}/auth/v1/.well-known/jwks.json`));
  }
  return jwks;
}

export interface VerifiedUser {
  sub: string;
  email?: string;
}

// Peek the header WITHOUT verifying, branch on alg, then verify against
// exactly one pinned algorithm. Never let the library infer/accept whatever
// alg the token itself claims (algorithm-confusion class of bug).
export async function verifySupabaseJwt(token: string, env: Env): Promise<VerifiedUser> {
  let header;
  try {
    header = decodeProtectedHeader(token);
  } catch {
    throw new AuthError('malformed token');
  }

  if (header.alg === 'ES256') {
    const { payload } = await jwtVerify(token, getJwks(env), { algorithms: ['ES256'] });
    if (!payload.sub) throw new AuthError('missing sub claim');
    return { sub: payload.sub, email: payload.email as string | undefined };
  }

  if (header.alg === 'HS256') {
    const secret = new TextEncoder().encode(env.SUPABASE_JWT_SECRET);
    const { payload } = await jwtVerify(token, secret, { algorithms: ['HS256'] });
    if (!payload.sub) throw new AuthError('missing sub claim');
    return { sub: payload.sub, email: payload.email as string | undefined };
  }

  throw new AuthError(`unsupported alg: ${String(header.alg)}`);
}
