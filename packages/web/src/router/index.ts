import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/login',
      name: 'Login',
      component: () => import('@/views/LoginView.vue'),
      meta: { requiresAuth: false },
    },
    {
      path: '/',
      name: 'Dashboard',
      component: () => import('@/views/DashboardView.vue'),
    },
    {
      path: '/search',
      name: 'Search',
      component: () => import('@/views/SearchView.vue'),
    },
    {
      path: '/my-documents',
      name: 'MyDocuments',
      component: () => import('@/views/MyDocumentsView.vue'),
    },
    {
      path: '/documents',
      name: 'AllDocuments',
      component: () => import('@/views/AllDocumentsView.vue'),
    },
    {
      path: '/graph',
      name: 'GlobalGraph',
      component: () => import('@/views/GlobalGraphView.vue'),
    },
    {
      path: '/knowledge-graph',
      name: 'KnowledgeGraph',
      component: () => import('@/views/KnowledgeGraphView.vue'),
    },
    {
      path: '/d/:domainCode',
      name: 'DomainWorkspace',
      component: () => import('@/views/DomainWorkspace.vue'),
    },
    {
      path: '/d/:domainCode/doc/:id',
      name: 'DocumentDetail',
      component: () => import('@/views/DocumentDetailView.vue'),
    },
    {
      path: '/d/:domainCode/compare',
      name: 'DocumentCompare',
      component: () => import('@/views/DocumentCompareView.vue'),
    },
    {
      path: '/admin/domains',
      name: 'AdminDomains',
      component: () => import('@/views/AdminDomainsView.vue'),
      meta: { roles: ['ADMIN'] },
    },
    {
      path: '/admin/users',
      name: 'AdminUsers',
      component: () => import('@/views/AdminUsersView.vue'),
      meta: { roles: ['ADMIN'] },
    },
    {
      path: '/admin/permissions',
      name: 'AdminPermissions',
      component: () => import('@/views/AdminPermissionsView.vue'),
      meta: { roles: ['ADMIN'] },
    },
    {
      path: '/admin/feedback',
      name: 'AdminFeedback',
      component: () => import('@/views/AdminFeedbackView.vue'),
      meta: { roles: ['ADMIN'] },
    },
    {
      path: '/admin/audit',
      name: 'AdminAudit',
      component: () => import('@/views/AdminAuditView.vue'),
      meta: { roles: ['ADMIN'] },
    },
    // 기존 라우트 리다이렉트
    {
      path: '/documents/:id',
      redirect: (to) => `/d/_/doc/${to.params.id}`,
    },
    {
      path: '/upload',
      redirect: '/',
    },
    {
      path: '/settings',
      redirect: '/admin/domains',
    },
    {
      path: '/admin/settings',
      redirect: '/admin/domains',
    },
  ],
})

router.beforeEach((to) => {
  const auth = useAuthStore()

  if (to.meta.requiresAuth === false) return true

  if (!auth.isAuthenticated) {
    return { name: 'Login', query: { redirect: to.fullPath } }
  }

  const requiredRoles = to.meta.roles as string[] | undefined
  if (requiredRoles && !requiredRoles.includes(auth.user?.role ?? '')) {
    return { name: 'Dashboard' }
  }

  return true
})

export { router }
