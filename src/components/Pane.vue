<script setup lang="ts">
defineProps<{ title: string }>();
</script>

<template>
  <div class="pane">
    <span class="pane-title">{{ title }}</span>
    <slot />
  </div>
</template>
