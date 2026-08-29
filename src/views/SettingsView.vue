<script setup lang="ts">
import Pane from '@/components/Pane.vue';
import { useAuth } from '@/composables/useAuth';
import { CONFIG } from '@/config';

const { session } = useAuth();
</script>

<template>
  <div>
    <h2 class="text-2xl font-semibold mb-1">Settings</h2>
    <p class="text-muted text-sm mb-8">Account and bridge configuration.</p>

    <Pane title="account">
      <div class="ruled-row" style="--cols: 1fr 2fr">
        <div class="text-muted text-xs">Account</div>
        <div class="text-sm">{{ session?.user.email }}</div>
      </div>
      <div class="ruled-row" style="--cols: 1fr 2fr">
        <div class="text-muted text-xs">Bridge URL</div>
        <div class="mono text-xs break-all">{{ CONFIG.WORKER_URL }}</div>
      </div>
    </Pane>
  </div>
</template>
