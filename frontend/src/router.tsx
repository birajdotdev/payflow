import { createRouter } from '@tanstack/react-router'

import { PagePending } from '@/components/feedback'
import { auth } from '@/features/auth/session'
import { queryClient } from '@/lib/query-client'

import { routeTree } from './routeTree.gen'

export function getRouter() {
  return createRouter({
    routeTree,
    context: { auth, queryClient },
    scrollRestoration: true,
    defaultPreload: 'intent',
    defaultPreloadStaleTime: 0,
    defaultPendingComponent: PagePending,
  })
}
declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
