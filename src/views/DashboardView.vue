<script setup lang="ts">
import { ref, onMounted } from 'vue';
import Pane from '@/components/Pane.vue';
import AuditBarChart from '@/components/AuditBarChart.vue';
import { listConnections, listTokens, listAudit, getAuditStats } from '@/api/endpoints';
import type { AuditDailyStat } from '@/types';

const connCount = ref<number | null>(null);
const tokCount = ref<number | null>(null);
const recentCallCount = ref<number | null>(null);
const stats = ref<AuditDailyStat[]>([]);
const statsLoading = ref(true);

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

  try {
    stats.value = await getAuditStats(7);
  } catch {
    /* error already surfaced via the global popup */
  } finally {
    statsLoading.value = false;
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

    <div class="h-6"></div>

    <Pane title="calls, last 7 days">
      <p v-if="statsLoading" class="text-muted text-sm py-2">Loading…</p>
      <template v-else>
        <div class="flex items-center gap-4 mb-4 text-xs text-muted">
          <span class="flex items-center gap-1.5">
            <span class="inline-block w-2.5 h-2.5 rounded-sm" style="background: var(--accent)"></span>
            ok
          </span>
          <span class="flex items-center gap-1.5">
            <span class="inline-block w-2.5 h-2.5 rounded-sm" style="background: var(--ink); opacity: 0.35"></span>
            error
          </span>
        </div>
        <AuditBarChart :data="stats" />
      </template>
    </Pane>
  </div>
</template>
