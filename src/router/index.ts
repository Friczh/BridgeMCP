import { createRouter, createWebHistory } from 'vue-router';
import { useAuth, waitForSession } from '@/composables/useAuth';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('@/views/HomeView.vue'),
      meta: { layout: 'home', public: true },
    },
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/LoginView.vue'),
      meta: { layout: 'home', public: true },
    },
    {
      path: '/dashboard',
      component: () => import('@/layouts/AppLayout.vue'),
      meta: { requiresAuth: true },
      children: [
        { path: '', name: 'dashboard', component: () => import('@/views/DashboardView.vue') },
        { path: 'connections', name: 'connections', component: () => import('@/views/ConnectionsView.vue') },
        { path: 'tokens', name: 'tokens', component: () => import('@/views/TokensView.vue') },
        { path: 'audit', name: 'audit', component: () => import('@/views/AuditView.vue') },
        { path: 'settings', name: 'settings', component: () => import('@/views/SettingsView.vue') },
      ],
    },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
});

router.beforeEach(async (to) => {
  // Awaits the same shared hydration promise useAuth/apiFetch use — a
  // separate independent getSession() call here previously let this guard
  // and useAuth's own session.value disagree during the hydration window.
  await waitForSession();
  const { isFullyAuthenticated } = useAuth();
  // Checks session presence AND aal2 (if the account has 2FA) — session
  // presence alone was the earlier bug: it let a page refresh mid-MFA-
  // challenge bypass the code step entirely, since signInWithPassword
  // already persists a real aal1 session before the code is ever verified.
  const authed = await isFullyAuthenticated();

  if (to.meta.requiresAuth && !authed) {
    return { name: 'login', query: { redirect: to.fullPath } };
  }
  if (to.name === 'login' && authed) {
    return { name: 'dashboard' };
  }
  return true;
});

export default router;