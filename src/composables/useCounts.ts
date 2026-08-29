import { ref } from 'vue';
import { listConnections, listTokens } from '@/api/endpoints';

const connectionCount = ref(0);
const tokenCount = ref(0);
let loaded = false;

async function refresh() {
  try {
    const [conns, toks] = await Promise.all([listConnections(), listTokens()]);
    connectionCount.value = conns.length;
    tokenCount.value = toks.length;
    loaded = true;
  } catch {
    /* error already surfaced via the global popup */
  }
}

export function useCounts() {
  if (!loaded) void refresh();
  return { connectionCount, tokenCount, refresh };
}
