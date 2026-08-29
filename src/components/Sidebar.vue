<script setup lang="ts">
import { computed } from 'vue';
import { RouterLink, useRoute } from 'vue-router';
import {
  LayoutDashboard,
  Share2,
  KeyRound,
  ScrollText,
  Settings,
  Menu,
  Sun,
  Moon,
  LogOut,
} from 'lucide-vue-next';
import { useAuth } from '@/composables/useAuth';
import { useTheme } from '@/composables/useTheme';
import { useSystemPopup } from '@/composables/useSystemPopup';
import { useSidebar } from '@/composables/useSidebar';

const route = useRoute();
const { session, signOut } = useAuth();
const { theme, toggle: toggleTheme } = useTheme();
const { showConfirm } = useSystemPopup();

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { to: '/dashboard/connections', label: 'Connections', icon: Share2, exact: false },
  { to: '/dashboard/tokens', label: 'Tokens', icon: KeyRound, exact: false },
  { to: '/dashboard/audit', label: 'Audit Log', icon: ScrollText, exact: false },
  { to: '/dashboard/settings', label: 'Settings', icon: Settings, exact: false },
] as const;

function isActive(to: string, exact: boolean) {
  return exact ? route.path === to : route.path.startsWith(to);
}

const { isMobile, mobileOpen, expanded, toggle, closeOnMobileNav, setHover } = useSidebar();

const initials = computed(() => {
  const email = session.value?.user.email ?? '';
  return email.slice(0, 2).toUpperCase() || '?';
});

function onLogoutClick() {
  showConfirm({
    title: 'Log out of BridgeMCP?',
    message: "You'll need to sign in again to manage connections and tokens.",
    confirmLabel: 'Log out',
    onConfirm: async () => {
      await signOut();
    },
  });
}
</script>

<template>
  <!-- mobile scrim -->
  <div
    v-if="isMobile && mobileOpen"
    class="fixed inset-0 bg-black/40 z-20"
    @click="mobileOpen = false"
  />

  <!-- mobile toggle: rendered outside the collapsible aside, since the aside
       itself is width:0 when closed on mobile and would clip its own
       trigger button, making it permanently unreachable. -->
  <button
    v-if="isMobile && !mobileOpen"
    aria-label="Open navigation"
    class="fixed top-3 left-3 z-30 text-ink bg-bg-sidebar border border-rule rounded-sidebar p-2"
    @click="toggle"
  >
    <Menu class="icon w-5 h-5" />
  </button>

  <aside
    class="fixed top-0 left-0 bottom-0 z-30 bg-bg-sidebar border-r border-rule flex flex-col transition-[width] duration-200 ease-out overflow-hidden"
    :style="{ width: isMobile ? (mobileOpen ? '260px' : '0px') : expanded ? '240px' : '64px' }"
    @mouseenter="setHover(true)"
    @mouseleave="setHover(false)"
  >
    <div class="h-14 flex items-center px-5 shrink-0">
      <button aria-label="Toggle navigation" class="text-ink shrink-0" @click="toggle">
        <Menu class="icon w-5 h-5" />
      </button>
    </div>

    <nav class="flex-1 px-3 py-2 space-y-1 whitespace-nowrap">
      <RouterLink
        v-for="item in NAV_ITEMS"
        :key="item.to"
        :to="item.to"
        class="flex items-center gap-3 px-3 py-2.5 rounded-sidebar transition-colors"
        :class="
          isActive(item.to, item.exact)
            ? 'bg-accent text-accent-ink'
            : 'text-ink hover:bg-panel'
        "
        @click="closeOnMobileNav"
      >
        <component :is="item.icon" class="icon w-5 h-5 shrink-0" />
        <span class="text-sm font-medium" :class="{ 'opacity-0': !expanded && !isMobile }">{{ item.label }}</span>
      </RouterLink>
    </nav>

    <div class="p-3 border-t border-rule space-y-1">
      <button
        class="w-full flex items-center gap-3 px-3 py-2.5 rounded-sidebar text-ink hover:bg-panel transition-colors"
        @click="toggleTheme"
      >
        <component :is="theme === 'dark' ? Sun : Moon" class="icon w-5 h-5 shrink-0" />
        <span class="text-sm font-medium" :class="{ 'opacity-0': !expanded && !isMobile }">
          {{ theme === 'dark' ? 'Light mode' : 'Dark mode' }}
        </span>
      </button>

      <div class="flex items-center gap-3 px-3 py-2">
        <div class="w-8 h-8 rounded-full bg-accent text-accent-ink flex items-center justify-center text-xs font-semibold shrink-0">
          {{ initials }}
        </div>
        <span
          class="text-xs text-muted truncate flex-1"
          :class="{ 'opacity-0': !expanded && !isMobile }"
        >
          {{ session?.user.email }}
        </span>
        <button
          aria-label="Log out"
          class="shrink-0 text-muted hover:text-danger transition-colors"
          :class="{ 'opacity-0 pointer-events-none': !expanded && !isMobile }"
          @click="onLogoutClick"
        >
          <LogOut class="icon w-4 h-4" />
        </button>
      </div>
    </div>
  </aside>
</template>