<script setup lang="ts">
import { ref, onMounted } from 'vue';
import Pane from '@/components/Pane.vue';
import EmptyState from '@/components/EmptyState.vue';
import { listAudit } from '@/api/endpoints';
import { fmtDate } from '@/utils/format';
import type { AuditEntry } from '@/types';

const entries = ref<AuditEntry[]>([]);
const loading = ref(true);

onMounted(async () => {
  try {
    entries.value = await listAudit();
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <div>
    <h2 class="text-2xl font-semibold mb-1">Audit log</h2>
    <p class="text-muted text-sm mb-8">Every tool call routed through the bridge, successful or not.</p>

    <Pane title="calls">
      <p v-if="loading" class="text-muted text-sm py-2">Loading…</p>
      <EmptyState
        v-else-if="entries.length === 0"
        title="No calls yet"
        body="Tool calls routed through your bridge tokens will appear here."
      />
      <template v-else>
        <div class="ruled-row head" style="--cols: 2fr 1fr 1fr 1fr">
          <div>Tool</div>
          <div>Result</div>
          <div>Token</div>
          <div>Time</div>
        </div>
        <div v-for="a in entries" :key="a.id" class="ruled-row" style="--cols: 2fr 1fr 1fr 1fr">
          <div class="mono text-xs font-medium">{{ a.tool_name }}</div>
          <div>
            <span
              class="mono text-xs px-2 py-1 rounded-pane border"
              :class="a.success ? 'border-accent text-accent' : 'border-danger text-danger'"
            >
              {{ a.success ? 'ok' : 'failed' }}
            </span>
          </div>
          <div class="mono text-xs text-muted truncate">{{ a.bridge_token_id ?? '—' }}</div>
          <div class="mono text-xs text-muted">{{ fmtDate(a.called_at) }}</div>
        </div>
      </template>
    </Pane>
  </div>
</template>
