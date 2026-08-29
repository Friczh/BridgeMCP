<script setup lang="ts">
import { computed } from 'vue';
import { RouterView } from 'vue-router';
import Sidebar from '@/components/Sidebar.vue';
import StatusLine from '@/components/StatusLine.vue';
import { useSidebar } from '@/composables/useSidebar';

const { isMobile, expanded } = useSidebar();

const contentMargin = computed(() => {
  if (isMobile.value) return '0px';
  return expanded.value ? '240px' : '64px';
});
</script>

<template>
  <div class="min-h-screen flex flex-col bg-bg">
    <Sidebar />
    <div
      class="flex-1 flex flex-col transition-[margin-left] duration-200 ease-out"
      :style="{ marginLeft: contentMargin }"
    >
      <main class="flex-1 p-6 md:p-10 max-w-5xl w-full">
        <RouterView />
      </main>
      <StatusLine />
    </div>
  </div>
</template>
