<script setup lang="ts">
import { RouterLink } from 'vue-router';
import Button from '@/components/Button.vue';
</script>

<template>
  <div class="min-h-screen flex flex-col items-center justify-center bg-bg text-ink px-6">
    <h1 class="text-4xl font-semibold mb-3">bridgemcp</h1>
    <p class="text-muted mb-8 max-w-sm text-center">
      One bridge URL for every MCP server you connect. Placeholder homepage — replace with real
      marketing content later.
    </p>
    <RouterLink to="/login">
      <Button variant="primary">Sign in</Button>
    </RouterLink>
  </div>
</template>
