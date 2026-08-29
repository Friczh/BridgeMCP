import { ref, computed, onMounted, onUnmounted } from 'vue';

const pinned = ref(false);
const hovering = ref(false);
const mobileOpen = ref(false);
const isMobile = ref(false);

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

  const expanded = computed(() => (isMobile.value ? mobileOpen.value : pinned.value || hovering.value));

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

  return { pinned, hovering, mobileOpen, isMobile, expanded, toggle, closeOnMobileNav, setHover };
}
