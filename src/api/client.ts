import { CONFIG } from '@/config';
import { supabase } from '@/lib/supabase';
import { useAuth, waitForSession } from '@/composables/useAuth';
import { useSystemPopup } from '@/composables/useSystemPopup';
import { friendlyMessage, NETWORK_ERROR_MESSAGE } from '@/api/errorMessages';
import router from '@/router';
import type { ApiErrorBody } from '@/types';

// Tracks in-flight /manage/* requests so an `unauthorized` response can
// cancel siblings before clearing the session, instead of letting them
// also fail and stack duplicate error popups (per design.md).
const inFlight = new Set<AbortController>();

class ApiError extends Error {
  code: string;
  detail?: unknown;
  constructor(code: string, detail?: unknown) {
    super(code);
    this.code = code;
    this.detail = detail;
  }
}

function handleApiError(body: ApiErrorBody) {
  const code = body.error || 'unknown';
  const { showError } = useSystemPopup();
  showError(friendlyMessage(code), code, body.detail);

  if (code === 'unauthorized') {
    inFlight.forEach((c) => c.abort());
    inFlight.clear();
    void supabase.auth.signOut().then(() => {
      // Same reasoning as the manual logout button: signOut() alone doesn't
      // move the user off a now-invalid dashboard page, since nothing here
      // is a navigation the router guard would react to.
      void router.push({ name: 'login' });
    });
  }
}

interface ApiFetchOptions {
  // Skips the global error popup + forced sign-out for an `unauthorized`
  // response from this specific call. Used by the reauth flow: a wrong
  // password/code there is an expected user-input error, not a stale or
  // compromised session — it shouldn't log the user out.
  silentUnauthorized?: boolean;
}

export async function apiFetch<T = unknown>(
  path: string,
  opts: RequestInit = {},
  extra: ApiFetchOptions = {}
): Promise<T | null> {
  // Wait for the shared session hydration before checking session.value —
  // without this, requests fired before hydration completes (most likely
  // right after a cookie/storage reset) saw session.value still null and
  // failed silently here, even though the user was actually authenticated.
  await waitForSession();
  const { session } = useAuth();
  if (!session.value) {
    const body = { error: 'unauthorized', detail: 'no local session' };
    handleApiError(body);
    throw new ApiError('unauthorized', 'no local session');
  }

  const controller = new AbortController();
  inFlight.add(controller);

  let res: Response;
  try {
    res = await fetch(`${CONFIG.WORKER_URL}${path}`, {
      ...opts,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.value.access_token}`,
        ...(opts.headers ?? {}),
      },
    });
  } catch (err) {
    inFlight.delete(controller);
    if ((err as Error).name === 'AbortError') throw new ApiError('aborted');
    const { showError } = useSystemPopup();
    showError(NETWORK_ERROR_MESSAGE, 'network_failure', 'No response from Worker.');
    throw new ApiError('network_failure');
  }
  inFlight.delete(controller);

  if (res.status === 204) return null;

  let body: unknown = {};
  try {
    body = await res.json();
  } catch {
    /* empty/non-JSON body */
  }

  if (!res.ok) {
    const errBody = body as ApiErrorBody;
    const suppress = extra.silentUnauthorized && errBody.error === 'unauthorized';
    if (!suppress) handleApiError(errBody);
    throw new ApiError(errBody.error ?? 'request_failed', errBody.detail);
  }
  return body as T;
}

export { ApiError };