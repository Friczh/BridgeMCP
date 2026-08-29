import { CONFIG } from '@/config';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/composables/useAuth';
import { useSystemPopup } from '@/composables/useSystemPopup';
import { friendlyMessage, NETWORK_ERROR_MESSAGE } from '@/api/errorMessages';
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
    void supabase.auth.signOut();
  }
}

export async function apiFetch<T = unknown>(path: string, opts: RequestInit = {}): Promise<T | null> {
  const { session } = useAuth();
  if (!session.value) throw new ApiError('unauthorized', 'no local session');

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
    handleApiError(body as ApiErrorBody);
    throw new ApiError((body as ApiErrorBody).error ?? 'request_failed', (body as ApiErrorBody).detail);
  }
  return body as T;
}

export { ApiError };
