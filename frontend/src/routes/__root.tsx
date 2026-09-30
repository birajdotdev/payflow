import {
  Outlet,
  createRootRouteWithContext,
  Link,
  useRouter,
} from '@tanstack/react-router'
import type { ErrorComponentProps } from '@tanstack/react-router'
import { FileQuestion } from 'lucide-react'
import { useEffect } from 'react'

import { ErrorNotice, PagePending } from '@/components/feedback'
import { ThemeProvider } from '@/components/theme-provider'
import { buttonVariants } from '@/components/ui/button'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { Toaster } from '@/components/ui/toast'
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
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <FileQuestion />
          </EmptyMedia>
          <EmptyTitle>Page not found</EmptyTitle>
          <EmptyDescription>
            This page doesn’t exist. Return to PayFlow to find your wallet.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Link to="/" className={buttonVariants()}>
            Back to PayFlow
          </Link>
        </EmptyContent>
      </Empty>
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
      <Toaster>
        <Outlet />
      </Toaster>
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
