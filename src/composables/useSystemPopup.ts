import { ref, readonly } from 'vue';

interface ErrorPopupState {
  kind: 'error';
  message: string;
  code: string;
  detail?: unknown;
}

interface ConfirmPopupState {
  kind: 'confirm';
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void | Promise<void>;
}

type SystemPopupState = ErrorPopupState | ConfirmPopupState | null;

// Module-scoped singleton — the API client and the topbar's logout button
// both need to trigger this without prop-drilling, so it's a shared composable
// rather than component-local state. Rendered once by <SystemPopup /> in App.vue.
const state = ref<SystemPopupState>(null);

export function useSystemPopup() {
  function showError(message: string, code: string, detail?: unknown) {
    state.value = { kind: 'error', message, code, detail };
  }
  function showConfirm(opts: Omit<ConfirmPopupState, 'kind'>) {
    state.value = { kind: 'confirm', ...opts };
  }
  function close() {
    state.value = null;
  }
  return { state: readonly(state), showError, showConfirm, close };
}
