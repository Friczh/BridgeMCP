<script setup lang="ts">
import {
  SelectRoot,
  SelectTrigger,
  SelectValue,
  SelectIcon,
  SelectPortal,
  SelectContent,
  SelectViewport,
  SelectItem,
  SelectItemText,
  SelectItemIndicator,
} from 'reka-ui';
import { ChevronDown, Check } from 'lucide-vue-next';

defineProps<{ options: { value: string; label: string }[]; placeholder?: string }>();
const model = defineModel<string>({ required: true });
</script>

<template>
  <SelectRoot v-model="model">
    <SelectTrigger
      class="w-full flex items-center justify-between bg-transparent border-b border-rule focus:border-accent outline-none py-2 text-sm"
    >
      <SelectValue :placeholder="placeholder" />
      <SelectIcon>
        <ChevronDown class="icon w-4 h-4 text-muted" />
      </SelectIcon>
    </SelectTrigger>
    <SelectPortal>
      <SelectContent class="pane z-50 bg-panel" position="popper" :side-offset="4">
        <SelectViewport class="p-1">
          <SelectItem
            v-for="opt in options"
            :key="opt.value"
            :value="opt.value"
            class="flex items-center justify-between px-3 py-2 text-sm rounded-pane cursor-pointer hover:bg-bg-sidebar outline-none data-[highlighted]:bg-bg-sidebar"
          >
            <SelectItemText>{{ opt.label }}</SelectItemText>
            <SelectItemIndicator>
              <Check class="icon w-4 h-4 text-accent" />
            </SelectItemIndicator>
          </SelectItem>
        </SelectViewport>
      </SelectContent>
    </SelectPortal>
  </SelectRoot>
</template>
