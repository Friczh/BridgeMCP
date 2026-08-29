<script setup lang="ts">
import { watch, onUnmounted } from 'vue';
import { DialogRoot, DialogPortal, DialogOverlay, DialogContent, DialogTitle } from 'reka-ui';
import { useSidebar } from '@/composables/useSidebar';

defineProps<{ title: string }>();
const open = defineModel<boolean>('open', { required: true });

const { notifyDialogOpen } = useSidebar();
watch(
  open,
  (isOpen, wasOpen) => {
    // wasOpen is undefined on the immediate first call — only report a real transition.
    if (wasOpen === undefined) {
      if (isOpen) notifyDialogOpen(true);
      return;
    }
    if (isOpen !== wasOpen) notifyDialogOpen(isOpen);
  },
  { immediate: true },
);
// If this component unmounts while its dialog is still open, don't leave the counter stuck.
onUnmounted(() => {
  if (open.value) notifyDialogOpen(false);
});
</script>

<template>
  <DialogRoot v-model:open="open">
    <DialogPortal>
      <DialogOverlay class="fixed inset-0 bg-black/50 z-40" />
      <DialogContent
        class="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md outline-none"
        @escape-key-down="open = false"
      >
        <div class="pane bg-panel">
          <DialogTitle class="text-lg font-semibold mb-4">{{ title }}</DialogTitle>
          <slot />
        </div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
