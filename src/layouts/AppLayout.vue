<script setup lang="ts">
import { computed } from 'vue';
import { RouterView } from 'vue-router';
import { Menu } from 'lucide-vue-next';
import Sidebar from '@/components/Sidebar.vue';
import StatusLine from '@/components/StatusLine.vue';
import { useSidebar } from '@/composables/useSidebar';

const { isMobile, mobileOpen, expanded, toggle } = useSidebar();

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
      <!-- Mobile-only header row. In-flow (not fixed) so it reserves real
           space above the page content instead of floating over it — the
           previous fixed-position button had no layout footprint, so it sat
           directly on top of page headings. Hidden while the drawer itself
           is open (the drawer has its own close affordance). -->
      <div v-if="isMobile && !mobileOpen" class="h-14 flex items-center px-4 border-b border-rule shrink-0">
        <button aria-label="Open navigation" class="text-ink" @click="toggle">
          <Menu class="icon w-5 h-5" />
        </button>
      </div>
      <main class="flex-1 p-6 md:p-10 max-w-5xl w-full">
        <RouterView />
      </main>
      <StatusLine />
    </div>
  </div>
</template>

