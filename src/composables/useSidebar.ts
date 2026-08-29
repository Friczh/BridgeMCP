import { ref, computed, onMounted, onUnmounted } from 'vue';

const pinned = ref(false);
const hovering = ref(false);
const mobileOpen = ref(false);
const isMobile = ref(false);
// Reka UI sets `pointer-events: none` on <body> while any modal Dialog is open
// (standard Radix/Reka behavior), which freezes mouseenter/mouseleave on the
// sidebar entirely until the dialog unmounts. Rather than trust that frozen
// hover state, any open dialog forces the sidebar collapsed outright.
const openDialogCount = ref(0);

function checkMobile() {
  isMobile.value = window.matchMedia('(max-width: 768px)').matches;
}

let listenerCount = 0;

export function useSidebar() {
  onMounted(() => {
    checkMobile();
    listenerCount += 1;
    if (listenerCount === 1) window.addEventListener('resize', checkMobile);
  });
  onUnmounted(() => {
    listenerCount -= 1;
    if (listenerCount === 0) window.removeEventListener('resize', checkMobile);
  });

  const expanded = computed(
    () => openDialogCount.value === 0 && (isMobile.value ? mobileOpen.value : pinned.value || hovering.value),
  );

  function toggle() {
    if (isMobile.value) mobileOpen.value = !mobileOpen.value;
    else pinned.value = !pinned.value;
  }
  function closeOnMobileNav() {
    if (isMobile.value) mobileOpen.value = false;
  }
  function setHover(v: boolean) {
    if (!isMobile.value) hovering.value = v;
  }
  function notifyDialogOpen(open: boolean) {
    openDialogCount.value += open ? 1 : -1;
    if (openDialogCount.value < 0) openDialogCount.value = 0;
  }

  return {
    pinned,
    hovering,
    mobileOpen,
    isMobile,
    expanded,
    toggle,
    closeOnMobileNav,
    setHover,
    notifyDialogOpen,
  };
}
