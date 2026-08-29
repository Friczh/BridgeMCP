<script setup lang="ts">
import { DialogRoot, DialogPortal, DialogOverlay, DialogContent, DialogTitle } from 'reka-ui';

defineProps<{ title: string }>();
const open = defineModel<boolean>('open', { required: true });
</script>

<template>
  <DialogRoot v-model:open="open">
    <DialogPortal>
      <DialogOverlay class="fixed inset-0 bg-black/50 z-40" />
      <DialogContent
        class="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md pane"
        @escape-key-down="open = false"
      >
        <DialogTitle class="text-lg font-semibold mb-4">{{ title }}</DialogTitle>
        <slot />
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
