<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import Pane from '@/components/Pane.vue';
import Button from '@/components/Button.vue';
import Select from '@/components/Select.vue';
import EmptyState from '@/components/EmptyState.vue';
import { listAudit, clearAudit, listConnections, listTokens } from '@/api/endpoints';
import { useSystemPopup } from '@/composables/useSystemPopup';
import { fmtDate } from '@/utils/format';
import type { AuditEntry, McpConnection, BridgeToken } from '@/types';

const { showConfirm } = useSystemPopup();

const entries = ref<AuditEntry[]>([]);
const loading = ref(true);
const connections = ref<McpConnection[]>([]);
const tokens = ref<BridgeToken[]>([]);

// 'all' is a local-only sentinel — never sent to the Worker, stripped when building the request.
const toolName = ref('');
const result = ref<'all' | 'true' | 'false'>('all');
const dateFrom = ref('');
const dateTo = ref('');
const connectionFilter = ref('all');
const tokenFilter = ref('all');

const RESULT_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'true', label: 'OK' },
  { value: 'false', label: 'Failed' },
];

const connectionOptions = computed(() => [
  { value: 'all', label: 'All' },
  { value: 'null', label: 'Orphaned / deleted' },
  ...connections.value.map((c) => ({ value: c.id, label: c.name })),
]);
const tokenOptions = computed(() => [
  { value: 'all', label: 'All' },
  { value: 'null', label: 'Orphaned / deleted' },
  ...tokens.value.map((t) => ({ value: t.id, label: t.name })),
]);

// Name lookups so rows show "github" / "Claude Desktop" instead of raw uuids.
const connectionNames = computed(() => new Map(connections.value.map((c) => [c.id, c.name])));
const tokenNames = computed(() => new Map(tokens.value.map((t) => [t.id, t.name])));

function connectionLabel(id: string | null): string {
  if (id === null) return 'orphaned';
  return connectionNames.value.get(id) ?? 'orphaned';
}
function tokenLabel(id: string | null): string {
  if (id === null) return 'orphaned';
  return tokenNames.value.get(id) ?? 'orphaned';
}

async function loadFilterSources() {
  try {
    const [conns, toks] = await Promise.all([listConnections(), listTokens()]);
    connections.value = conns;
    tokens.value = toks;
  } catch {
    /* error already surfaced via the global popup; filters just show no names */
  }
}

async function loadEntries() {
  loading.value = true;
  try {
    entries.value = await listAudit({
      tool_name: toolName.value || undefined,
      success: result.value === 'all' ? undefined : result.value,
      date_from: dateFrom.value || undefined,
      date_to: dateTo.value || undefined,
      connection_id: connectionFilter.value === 'all' ? undefined : connectionFilter.value,
      bridge_token_id: tokenFilter.value === 'all' ? undefined : tokenFilter.value,
    });
  } finally {
    loading.value = false;
  }
}

function resetFilters() {
  toolName.value = '';
  result.value = 'all';
  dateFrom.value = '';
  dateTo.value = '';
  connectionFilter.value = 'all';
  tokenFilter.value = 'all';
  void loadEntries();
}

function onClearAudit() {
  showConfirm({
    title: 'Clear audit log',
    message: 'Delete all audit log entries? This cannot be undone.',
    confirmLabel: 'Delete',
    onConfirm: async () => {
      await clearAudit();
      resetFilters();
    },
  });
}

onMounted(() => {
  void loadFilterSources();
  void loadEntries();
});
</script>

<template>
  <div>
    <div class="flex items-end justify-between gap-4 mb-8 flex-wrap">
      <div>
        <h2 class="text-2xl font-semibold mb-1">Audit log</h2>
        <p class="text-muted text-sm">Every tool call routed through the bridge, successful or not.</p>
      </div>
      <Button variant="danger" @click="onClearAudit">Clear audit log</Button>
    </div>

    <Pane title="filters">
      <form class="grid grid-cols-2 md:grid-cols-3 gap-5 items-end" @submit.prevent="loadEntries">
        <div>
          <label for="audit-tool" class="block text-xs font-medium text-muted mb-1.5">Tool name</label>
          <input
            id="audit-tool"
            v-model="toolName"
            placeholder="github__create_issue"
            class="w-full bg-transparent border-b border-rule focus:border-accent outline-none py-2 text-sm"
          />
        </div>
        <div>
          <label class="block text-xs font-medium text-muted mb-1.5">Result</label>
          <Select v-model="result" :options="RESULT_OPTIONS" />
        </div>
        <div>
          <label for="audit-from" class="block text-xs font-medium text-muted mb-1.5">From</label>
          <input
            id="audit-from"
            v-model="dateFrom"
            type="date"
            class="w-full bg-transparent border-b border-rule focus:border-accent outline-none py-2 text-sm"
          />
        </div>
        <div>
          <label for="audit-to" class="block text-xs font-medium text-muted mb-1.5">To</label>
          <input
            id="audit-to"
            v-model="dateTo"
            type="date"
            class="w-full bg-transparent border-b border-rule focus:border-accent outline-none py-2 text-sm"
          />
        </div>
        <div>
          <label class="block text-xs font-medium text-muted mb-1.5">Connection</label>
          <Select v-model="connectionFilter" :options="connectionOptions" />
        </div>
        <div>
          <label class="block text-xs font-medium text-muted mb-1.5">Token</label>
          <Select v-model="tokenFilter" :options="tokenOptions" />
        </div>
        <div class="flex gap-3 col-span-full">
          <Button type="submit" variant="primary">Apply</Button>
          <Button type="button" variant="secondary" @click="resetFilters">Reset</Button>
        </div>
      </form>
    </Pane>

    <div class="h-6"></div>

    <Pane title="calls">
      <p v-if="loading" class="text-muted text-sm py-2">Loading…</p>
      <EmptyState
        v-else-if="entries.length === 0"
        title="No calls found"
        body="No audit entries match the current filters."
      />
      <template v-else>
        <div class="ruled-row head" style="--cols: 2fr 1fr 1fr 1fr 1fr">
          <div>Tool</div>
          <div>Result</div>
          <div>Connection</div>
          <div>Token</div>
          <div>Time</div>
        </div>
        <div v-for="a in entries" :key="a.id" class="ruled-row" style="--cols: 2fr 1fr 1fr 1fr 1fr">
          <div class="mono text-xs font-medium">{{ a.tool_name }}</div>
          <div>
            <span
              class="mono text-xs px-2 py-1 rounded-pane border"
              :class="a.success ? 'border-accent text-accent' : 'border-danger text-danger'"
            >
              {{ a.success ? 'ok' : 'failed' }}
            </span>
          </div>
          <div class="mono text-xs text-muted truncate">{{ connectionLabel(a.connection_id) }}</div>
          <div class="mono text-xs text-muted truncate">{{ tokenLabel(a.bridge_token_id) }}</div>
          <div class="mono text-xs text-muted">{{ fmtDate(a.called_at) }}</div>
        </div>
      </template>
    </Pane>
  </div>
</template>
