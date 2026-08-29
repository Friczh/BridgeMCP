<script setup lang="ts">
defineProps<{ title: string; body: string }>();
</script>

<template>
  <div class="text-left py-12 px-6">
    <p class="text-xl font-semibold mb-2">{{ title }}</p>
    <p class="text-muted text-sm max-w-md">{{ body }}</p>
    <slot />
  </div>
</template>
