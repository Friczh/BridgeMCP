<script setup lang="ts">
import { computed } from 'vue';
import { ChevronRight } from 'lucide-vue-next';
import { CollapsibleRoot, CollapsibleTrigger, CollapsibleContent } from 'reka-ui';
import Popup from '@/components/Popup.vue';
import Button from '@/components/Button.vue';
import { useSystemPopup } from '@/composables/useSystemPopup';

const { state, close } = useSystemPopup();

const isOpen = computed({
  get: () => state.value !== null,
  set: (v) => {
    if (!v) close();
  },
});

async function confirmAction() {
  if (state.value?.kind === 'confirm') {
    await state.value.onConfirm();
  }
  close();
}
</script>

<template>
  <Popup
    v-if="state?.kind === 'error'"
    v-model:open="isOpen"
    title="Something needs attention"
  >
    <p class="text-muted text-sm mb-4">{{ state.message }}</p>
    <CollapsibleRoot class="mb-4 -mt-2">
      <CollapsibleTrigger class="flex items-center gap-1 text-xs mono text-muted group">
        More details
        <ChevronRight class="icon w-3 h-3 transition-transform group-data-[state=open]:rotate-90" />
      </CollapsibleTrigger>
      <CollapsibleContent class="mono text-xs text-muted mt-2">
        error: {{ state.code }}<br />
        <template v-if="state.detail">detail: {{ JSON.stringify(state.detail) }}<br /></template>
        time: {{ new Date().toISOString() }}
      </CollapsibleContent>
    </CollapsibleRoot>
    <div class="flex justify-end">
      <Button variant="secondary" @click="close">Dismiss</Button>
    </div>
  </Popup>

  <Popup
    v-else-if="state?.kind === 'confirm'"
    v-model:open="isOpen"
    :title="state.title"
  >
    <p class="text-muted text-sm mb-6">{{ state.message }}</p>
    <div class="flex justify-end gap-3">
      <Button variant="secondary" @click="close">Cancel</Button>
      <Button variant="primary" @click="confirmAction">{{ state.confirmLabel }}</Button>
    </div>
  </Popup>
</template>
