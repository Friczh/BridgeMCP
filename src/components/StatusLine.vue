<script setup lang="ts">
import { useRoute } from 'vue-router';
import { computed } from 'vue';
import { useCounts } from '@/composables/useCounts';

const route = useRoute();
const { connectionCount, tokenCount } = useCounts();

const HINTS: Record<string, string> = {
  dashboard: 'overview of your bridge',
  connections: 'backend MCP servers reachable through your bridge',
  tokens: 'bridge tokens are shown once at creation',
  audit: 'every tool call routed through the bridge',
  settings: 'account and bridge configuration',
};
const hint = computed(() => HINTS[route.name as string] ?? '');
</script>

<template>
  <div
    class="h-8 px-4 flex items-center justify-between border-t border-rule bg-bg-sidebar mono text-xs text-muted shrink-0"
  >
    <span>{{ hint }}</span>
    <span>{{ connectionCount }} connection{{ connectionCount === 1 ? '' : 's' }} · {{ tokenCount }} active token{{ tokenCount === 1 ? '' : 's' }}</span>
  </div>
</template>
