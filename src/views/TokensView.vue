<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { Copy, Check } from 'lucide-vue-next';
import Pane from '@/components/Pane.vue';
import Popup from '@/components/Popup.vue';
import Button from '@/components/Button.vue';
import Select from '@/components/Select.vue';
import EmptyState from '@/components/EmptyState.vue';
import { listTokens, createToken, revokeToken } from '@/api/endpoints';
import { useCounts } from '@/composables/useCounts';
import { fmtDate } from '@/utils/format';
import type { BridgeToken, TokenExpiry } from '@/types';

const { refresh: refreshCounts } = useCounts();

const tokens = ref<BridgeToken[]>([]);
const loading = ref(true);

async function load() {
  loading.value = true;
  try {
    tokens.value = await listTokens();
  } finally {
    loading.value = false;
  }
}
onMounted(load);

const EXPIRY_OPTIONS = [
  { value: 'never', label: 'No expiry' },
  { value: '30d', label: '30 days' },
  { value: '90d', label: '90 days' },
  { value: '1y', label: '1 year' },
];

const newPopupOpen = ref(false);
const tokenName = ref('');
const expiry = ref<TokenExpiry>('never');
const submitting = ref(false);

const oncePopupOpen = ref(false);
const shownToken = ref('');
const shownUrl = ref('');
const copiedToken = ref(false);
const copiedUrl = ref(false);

function openNewToken() {
  tokenName.value = '';
  expiry.value = 'never';
  newPopupOpen.value = true;
}

async function onSubmit() {
  submitting.value = true;
  try {
    const res = await createToken(tokenName.value, expiry.value);
    newPopupOpen.value = false;
    shownToken.value = res.token;
    shownUrl.value = res.bridge_url;
    copiedToken.value = false;
    copiedUrl.value = false;
    oncePopupOpen.value = true;
    await load();
    void refreshCounts();
  } catch {
    /* error already surfaced via the global popup */
  } finally {
    submitting.value = false;
  }
}

async function onRevoke(id: string) {
  await revokeToken(id);
  await load();
  void refreshCounts();
}

async function copy(value: string, which: 'token' | 'url') {
  await navigator.clipboard.writeText(value);
  if (which === 'token') {
    copiedToken.value = true;
  } else {
    copiedUrl.value = true;
  }
}
</script>

<template>
  <div>
    <div class="flex items-end justify-between gap-4 mb-8 flex-wrap">
      <div>
        <h2 class="text-2xl font-semibold mb-1">Tokens</h2>
        <p class="text-muted text-sm">Bridge tokens for AI clients. Each is shown once at creation.</p>
      </div>
      <Button variant="primary" @click="openNewToken">New token</Button>
    </div>

    <Pane title="tokens">
      <p v-if="loading" class="text-muted text-sm py-2">Loading…</p>
      <EmptyState
        v-else-if="tokens.length === 0"
        title="No tokens yet"
        body="Generate a bridge token to connect an AI client like Claude Desktop."
      />
      <template v-else>
        <div class="ruled-row head" style="--cols: 2fr 1fr 1fr auto">
          <div>Name</div>
          <div>Created</div>
          <div>Last used</div>
          <div>Actions</div>
        </div>
        <div v-for="t in tokens" :key="t.id" class="ruled-row" style="--cols: 2fr 1fr 1fr auto">
          <div class="font-medium">{{ t.name }}</div>
          <div class="mono text-xs text-muted">{{ fmtDate(t.created_at) }}</div>
          <div class="mono text-xs text-muted">{{ fmtDate(t.last_used_at) }}</div>
          <div>
            <button class="text-xs text-muted hover:text-danger" @click="onRevoke(t.id)">Revoke</button>
          </div>
        </div>
      </template>
    </Pane>

    <Popup v-model:open="newPopupOpen" title="New bridge token">
      <p class="text-muted text-sm mb-6">Name it for the client that will use it. The token is shown once.</p>
      <form class="space-y-5" @submit.prevent="onSubmit">
        <div>
          <label for="token-name" class="block text-xs font-medium text-muted mb-1.5">Name</label>
          <input
            id="token-name"
            v-model="tokenName"
            required
            placeholder="Claude Desktop — laptop"
            class="w-full bg-transparent border-b border-rule focus:border-accent outline-none py-2 text-sm"
          />
        </div>
        <div>
          <label class="block text-xs font-medium text-muted mb-1.5">Expiry</label>
          <Select v-model="expiry" :options="EXPIRY_OPTIONS" />
        </div>
        <div class="flex justify-end gap-3">
          <Button type="button" variant="secondary" @click="newPopupOpen = false">Cancel</Button>
          <Button type="submit" variant="primary" :disabled="submitting">
            {{ submitting ? 'Generating…' : 'Generate' }}
          </Button>
        </div>
      </form>
    </Popup>

    <Popup v-model:open="oncePopupOpen" title="Copy this token now">
      <p class="text-muted text-sm mb-6">
        It won't be shown again. Paste it into your AI client's MCP config.
      </p>
      <div class="mb-4">
        <div class="text-xs text-muted mb-2">Bridge token</div>
        <div class="flex items-center gap-2 bg-bg-sidebar rounded-pane p-3">
          <span class="mono text-xs break-all flex-1">{{ shownToken }}</span>
          <button class="shrink-0 text-muted hover:text-accent" @click="copy(shownToken, 'token')">
            <component :is="copiedToken ? Check : Copy" class="icon w-4 h-4" />
          </button>
        </div>
      </div>
      <div class="mb-6">
        <div class="text-xs text-muted mb-2">Bridge URL</div>
        <div class="flex items-center gap-2 bg-bg-sidebar rounded-pane p-3">
          <span class="mono text-xs break-all flex-1">{{ shownUrl }}</span>
          <button class="shrink-0 text-muted hover:text-accent" @click="copy(shownUrl, 'url')">
            <component :is="copiedUrl ? Check : Copy" class="icon w-4 h-4" />
          </button>
        </div>
      </div>
      <div class="flex justify-end">
        <Button variant="primary" @click="oncePopupOpen = false">Done</Button>
      </div>
    </Popup>
  </div>
</template>
