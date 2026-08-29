<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import Pane from '@/components/Pane.vue';
import Popup from '@/components/Popup.vue';
import Button from '@/components/Button.vue';
import Select from '@/components/Select.vue';
import EmptyState from '@/components/EmptyState.vue';
import {
  listConnections,
  createConnection,
  deleteConnection,
  recheckConnection,
} from '@/api/endpoints';
import { useCounts } from '@/composables/useCounts';
import type { McpConnection, AuthType, HealthCheckResult } from '@/types';

const { refresh: refreshCounts } = useCounts();

const connections = ref<McpConnection[]>([]);
const loading = ref(true);

async function load() {
  loading.value = true;
  try {
    connections.value = await listConnections();
  } finally {
    loading.value = false;
  }
}
onMounted(load);

const AUTH_OPTIONS = [
  { value: 'none', label: 'None' },
  { value: 'bearer', label: 'Bearer token' },
  { value: 'header', label: 'Custom header' },
];

const popupOpen = ref(false);
const name = ref('');
const serverUrl = ref('');
const authType = ref<AuthType>('none');
const credValue = ref('');
const headerName = ref('');
const submitting = ref(false);
const checkWarning = ref<HealthCheckResult | null>(null);

const needsCred = computed(() => authType.value !== 'none');

function openNewConnection() {
  name.value = '';
  serverUrl.value = '';
  authType.value = 'none';
  credValue.value = '';
  headerName.value = '';
  checkWarning.value = null;
  popupOpen.value = true;
}

async function onSubmit() {
  submitting.value = true;
  checkWarning.value = null;
  try {
    const credentials =
      authType.value !== 'none' && credValue.value
        ? authType.value === 'header'
          ? { header: headerName.value, value: credValue.value }
          : { value: credValue.value }
        : undefined;

    const { check } = await createConnection({
      name: name.value,
      server_url: serverUrl.value,
      auth_type: authType.value,
      credentials,
    });
    await load();
    void refreshCounts();

    if (check.status === 'ok') {
      popupOpen.value = false;
    } else {
      checkWarning.value = check;
    }
  } catch {
    /* error already surfaced via the global popup */
  } finally {
    submitting.value = false;
  }
}

async function onDelete(id: string) {
  await deleteConnection(id);
  await load();
  void refreshCounts();
}

async function onRecheck(id: string) {
  await recheckConnection(id);
  await load();
}

function checkLabel(check: HealthCheckResult): string {
  if (check.http_status) return `HTTP ${check.http_status}`;
  return check.status === 'timeout' ? 'Timed out' : 'Error';
}
</script>

<template>
  <div>
    <div class="flex items-end justify-between gap-4 mb-8 flex-wrap">
      <div>
        <h2 class="text-2xl font-semibold mb-1">Connections</h2>
        <p class="text-muted text-sm">Backend MCP servers reachable through your bridge.</p>
      </div>
      <Button variant="primary" @click="openNewConnection">New connection</Button>
    </div>

    <Pane title="connections">
      <p v-if="loading" class="text-muted text-sm py-2">Loading…</p>
      <EmptyState
        v-else-if="connections.length === 0"
        title="No connections yet"
        body="Add a backend MCP server to start routing tool calls through your bridge."
      />
      <template v-else>
        <div class="ruled-row head" style="--cols: 2fr 1fr 1fr auto">
          <div>Name</div>
          <div>Server URL</div>
          <div>Status</div>
          <div>Actions</div>
        </div>
        <div v-for="c in connections" :key="c.id" class="ruled-row" style="--cols: 2fr 1fr 1fr auto">
          <div class="font-medium">{{ c.name }}</div>
          <div class="mono text-xs text-muted truncate">{{ c.server_url }}</div>
          <div>
            <span
              class="mono text-xs px-2 py-1 rounded-pane border"
              :class="c.last_status === 'ok' ? 'border-accent text-accent' : c.last_status === 'error' || c.last_status === 'timeout' ? 'border-danger text-danger' : 'border-rule text-muted'"
              :title="c.last_check_detail ?? ''"
            >
              {{ c.last_status ?? 'unverified' }}
            </span>
          </div>
          <div class="flex gap-2">
            <button class="text-xs text-muted hover:text-accent" @click="onRecheck(c.id)">Recheck</button>
            <button class="text-xs text-muted hover:text-danger" @click="onDelete(c.id)">Remove</button>
          </div>
        </div>
      </template>
    </Pane>

    <Popup v-model:open="popupOpen" title="New connection">
      <p class="text-muted text-sm mb-6">Add a backend MCP server. Its tools will appear under this name.</p>
      <form class="space-y-5" @submit.prevent="onSubmit">
        <div>
          <label for="conn-name" class="block text-xs font-medium text-muted mb-1.5">Name</label>
          <input
            id="conn-name"
            v-model="name"
            required
            placeholder="github"
            class="w-full bg-transparent border-b border-rule focus:border-accent outline-none py-2 text-sm"
          />
        </div>
        <div>
          <label for="conn-url" class="block text-xs font-medium text-muted mb-1.5">Server URL</label>
          <input
            id="conn-url"
            v-model="serverUrl"
            type="url"
            required
            placeholder="https://mcp.example.com"
            class="w-full bg-transparent border-b border-rule focus:border-accent outline-none py-2 text-sm"
          />
        </div>
        <div>
          <label class="block text-xs font-medium text-muted mb-1.5">Auth type</label>
          <Select v-model="authType" :options="AUTH_OPTIONS" />
        </div>
        <template v-if="needsCred">
          <div v-if="authType === 'header'">
            <label for="conn-header" class="block text-xs font-medium text-muted mb-1.5">Header name</label>
            <input
              id="conn-header"
              v-model="headerName"
              placeholder="X-API-Key"
              class="w-full bg-transparent border-b border-rule focus:border-accent outline-none py-2 text-sm"
            />
          </div>
          <div>
            <label for="conn-cred" class="block text-xs font-medium text-muted mb-1.5">Credential</label>
            <input
              id="conn-cred"
              v-model="credValue"
              placeholder="token or header value"
              class="w-full bg-transparent border-b border-rule focus:border-accent outline-none py-2 text-sm"
            />
          </div>
        </template>

        <div v-if="checkWarning" class="mono text-xs text-danger border border-danger rounded-pane p-3">
          Connection saved, but the health check failed: {{ checkLabel(checkWarning) }}
          <template v-if="checkWarning.detail"> — {{ checkWarning.detail }}</template>.
          You can fix the server and recheck from the connections list.
        </div>

        <div class="flex justify-end gap-3">
          <Button
            v-if="checkWarning"
            type="button"
            variant="secondary"
            @click="popupOpen = false"
          >
            Close
          </Button>
          <template v-else>
            <Button type="button" variant="secondary" @click="popupOpen = false">Cancel</Button>
            <Button type="submit" variant="primary" :disabled="submitting">
              {{ submitting ? 'Checking…' : 'Create' }}
            </Button>
          </template>
        </div>
      </form>
    </Popup>
  </div>
</template>
