import { createRouter, createWebHistory } from 'vue-router';
import { supabase } from '@/lib/supabase';

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
  const { data } = await supabase.auth.getSession();
  const authed = data.session !== null;

  if (to.meta.requiresAuth && !authed) {
    return { name: 'login', query: { redirect: to.fullPath } };
  }
  if (to.name === 'login' && authed) {
    return { name: 'dashboard' };
  }
  return true;
});

export default router;
