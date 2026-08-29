import { ref, readonly } from 'vue';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

// Module-scoped so every component shares the same session state (singleton composable).
const session = ref<Session | null>(null);
const sessionReady = ref(false);

supabase.auth.getSession().then(({ data }) => {
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
