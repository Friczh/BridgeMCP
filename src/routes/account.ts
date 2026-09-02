import { Hono } from 'hono';
import type { Env } from '../types';
import { ApiError } from '../lib/errors';
import { getSupabaseClient } from '../lib/supabase';
import {
  verifyPasswordGrant,
  findVerifiedTotpFactor,
  verifyTotpCode,
  adminFindVerifiedTotpFactor,
  adminDeleteFactor,
} from '../lib/supabase-auth-rest';
import { signPasswordVerifiedToken, signCompleteToken, verifyPasswordVerifiedToken, requireReauthToken } from '../lib/reauth';
import { reauthPasswordSchema, reauthMfaSchema, updatePasswordSchema } from '../schemas/account';

type Vars = { userId: string; userEmail?: string };

const account = new Hono<{ Bindings: Env; Variables: Vars }>();

// Mounted under an app that already enforces the normal Supabase session JWT
// (see manage.ts) — every route below additionally requires proof of a
// *fresh* re-authentication for the specific mutation it guards. See
// design.md "Server-side re-authentication" for the full flow.

// ---- Step 1: re-verify password ----
// Returns either a completed reauth token (no MFA on the account) or a
// partial token that must be redeemed with a TOTP code at /reauth/mfa.
account.post('/reauth/password', async (c) => {
  const email = c.get('userEmail');
  if (!email) throw new ApiError(401, 'unauthorized', 'invalid token');

  const body = await c.req.json().catch(() => null);
  const parsed = reauthPasswordSchema.safeParse(body);
  if (!parsed.success) throw new ApiError(400, 'bad_request', JSON.stringify(parsed.error.issues));

  const { access_token } = await verifyPasswordGrant(email, parsed.data.password, c.env);
  const factor = await findVerifiedTotpFactor(access_token, c.env);

  if (factor) {
    const partial_token = await signPasswordVerifiedToken(
      { sub: c.get('userId'), factor_id: factor.id, access_token },
      c.env
    );
    return c.json({ status: 'mfa_required', partial_token });
  }

  const reauth_token = await signCompleteToken(c.get('userId'), c.env);
  return c.json({ status: 'ok', reauth_token });
});

// ---- Step 2 (only if the account has 2FA): re-verify a TOTP code ----
account.post('/reauth/mfa', async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = reauthMfaSchema.safeParse(body);
  if (!parsed.success) throw new ApiError(400, 'bad_request', JSON.stringify(parsed.error.issues));

  const claims = await verifyPasswordVerifiedToken(parsed.data.partial_token, c.get('userId'), c.env);
  await verifyTotpCode(claims.factor_id, parsed.data.code, claims.access_token, c.env);

  const reauth_token = await signCompleteToken(c.get('userId'), c.env);
  return c.json({ status: 'ok', reauth_token });
});

// ---- Protected mutations — each requires X-Reauth-Token from a completed reauth above ----

account.post('/password', async (c) => {
  await requireReauthToken(c.req.header('X-Reauth-Token'), c.get('userId'), c.env);

  const body = await c.req.json().catch(() => null);
  const parsed = updatePasswordSchema.safeParse(body);
  if (!parsed.success) throw new ApiError(400, 'bad_request', JSON.stringify(parsed.error.issues));

  const supabase = getSupabaseClient(c.env);
  const { error } = await supabase.auth.admin.updateUserById(c.get('userId'), { password: parsed.data.password });
  if (error) throw new ApiError(502, 'bad_gateway', error.message);

  return c.json({ status: 'ok' });
});

account.post('/mfa/disable', async (c) => {
  await requireReauthToken(c.req.header('X-Reauth-Token'), c.get('userId'), c.env);

  const factor = await adminFindVerifiedTotpFactor(c.get('userId'), c.env);
  if (!factor) throw new ApiError(404, 'not_found', 'no active 2FA factor');

  await adminDeleteFactor(c.get('userId'), factor.id, c.env);
  return c.json({ status: 'ok' });
});

export default account;
