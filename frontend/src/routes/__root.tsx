import {
  Outlet,
  createRootRouteWithContext,
  Link,
  useRouter,
} from '@tanstack/react-router'
import type { ErrorComponentProps } from '@tanstack/react-router'
import { useEffect } from 'react'

import { ErrorNotice, PagePending } from '@/components/feedback'
import { ThemeProvider } from '@/components/theme-provider'
import { Button } from '@/components/ui/button'
import { useSession } from '@/features/auth/session'
import type { auth } from '@/features/auth/session'
import type { queryClient } from '@/lib/query-client'

import '../styles.css'

export const Route = createRootRouteWithContext<{
  auth: typeof auth
  queryClient: typeof queryClient
}>()({
  component: RootComponent,
  pendingComponent: PagePending,
  errorComponent: RouteError,
  notFoundComponent: () => (
    <main className="flex min-h-svh flex-col items-center justify-center gap-4 p-6">
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <p className="text-muted-foreground">This page doesn’t exist.</p>
      <Button render={<Link to="/" />}>Back to PayFlow</Button>
    </main>
  ),
})
function RootComponent() {
  const session = useSession()
  const router = useRouter()
  useEffect(() => {
    void router.invalidate()
  }, [session.status, router])
  return (
    <ThemeProvider>
      <Outlet />
    </ThemeProvider>
  )
}

function RouteError({ error, reset }: ErrorComponentProps) {
  const router = useRouter()
  return (
    <main className="mx-auto max-w-lg p-8">
      <ErrorNotice
        error={error}
        retry={() => {
          void router.invalidate().then(reset)
        }}
      />
    </main>
  )
}
