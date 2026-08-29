import { ref, readonly } from 'vue';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

// Module-scoped so every component shares the same session state (singleton composable).
const session = ref<Session | null>(null);
const sessionReady = ref(false);

// Single shared hydration promise. Anything that needs to know the session
// state before acting (router guard, apiFetch) must await this instead of
// calling supabase.auth.getSession() independently — a second, uncoordinated
// call races against this one and can observe session.value still null even
// though the "real" session check would have succeeded, causing silent
// unauthorized failures right after a fresh page load (most visible right
// after a cookie/storage reset, when hydration is slowest).
const ready = supabase.auth.getSession().then(({ data }) => {
  session.value = data.session;
  sessionReady.value = true;
});

supabase.auth.onAuthStateChange((_event, s) => {
  session.value = s;
  sessionReady.value = true;
});

export function useAuth() {
  return {
    session: readonly(session),
    sessionReady: readonly(sessionReady),
    isAuthenticated: () => session.value !== null,
    signOut: () => supabase.auth.signOut(),
  };
}

// Awaitable by non-component code that needs the session hydrated before
// making an auth decision. Resolves immediately on subsequent calls once
// the initial hydration has completed.
export function waitForSession(): Promise<void> {
  return ready;
}