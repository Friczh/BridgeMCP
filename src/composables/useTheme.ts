import { ref, watch } from 'vue';

type Theme = 'dark' | 'light';

const STORAGE_KEY = 'bridgemcp-theme';

function initialTheme(): Theme {
  const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
  if (stored === 'dark' || stored === 'light') return stored;
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

// Module-scoped singleton — index.html's inline script already set the
// attribute pre-paint; this just keeps Vue state and the DOM in sync from here on.
const theme = ref<Theme>(initialTheme());

watch(
  theme,
  (t) => {
    document.documentElement.setAttribute('data-theme', t);
    localStorage.setItem(STORAGE_KEY, t);
  },
  { immediate: true },
);

export function useTheme() {
  function toggle() {
    theme.value = theme.value === 'dark' ? 'light' : 'dark';
  }
  return { theme, toggle };
}
