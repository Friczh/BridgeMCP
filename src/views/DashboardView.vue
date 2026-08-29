<script setup lang="ts">
import { ref, onMounted } from 'vue';
import Pane from '@/components/Pane.vue';
import { listConnections, listTokens, listAudit } from '@/api/endpoints';

const connCount = ref<number | null>(null);
const tokCount = ref<number | null>(null);
const recentCallCount = ref<number | null>(null);

onMounted(async () => {
  try {
    const [conns, toks, audit] = await Promise.all([listConnections(), listTokens(), listAudit()]);
    connCount.value = conns.length;
    tokCount.value = toks.length;
    const since = Date.now() - 24 * 3600 * 1000;
    recentCallCount.value = audit.filter((a) => new Date(a.called_at).getTime() > since).length;
  } catch {
    /* error already surfaced via the global popup */
  }
});
</script>

<template>
  <div>
    <h2 class="text-2xl font-semibold mb-1">Overview</h2>
    <p class="text-muted text-sm mb-8">Bridge status across your connections, tokens, and recent tool calls.</p>

    <Pane title="summary">
      <div class="ruled-row head" style="--cols: repeat(3, 1fr)">
        <div>Connections</div>
        <div>Active tokens</div>
        <div>Calls (24h)</div>
      </div>
      <div class="ruled-row" style="--cols: repeat(3, 1fr)">
        <div class="text-2xl font-semibold">{{ connCount ?? '—' }}</div>
        <div class="text-2xl font-semibold">{{ tokCount ?? '—' }}</div>
        <div class="text-2xl font-semibold">{{ recentCallCount ?? '—' }}</div>
      </div>
    </Pane>
  </div>
</template>
