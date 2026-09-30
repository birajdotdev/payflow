import { useMutation } from '@tanstack/react-query'
import {
  createFileRoute,
  Link,
  Outlet,
  redirect,
  useRouter,
} from '@tanstack/react-router'
import { LayoutDashboard, LogOut, WalletCards } from 'lucide-react'

import { Brand } from '@/components/brand'
import { Button, buttonVariants } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { safeReturn } from '@/features/auth/contracts'
import { auth, useSession } from '@/features/auth/session'

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: async ({ context, location }) => {
    await context.auth.restore()

    const user = context.auth.getState().user

    if (!user)
      throw redirect({
        to: '/login',
        search: { redirect: safeReturn(location.pathname), registered: false },
      })

    return { user }
  },
  component: ProtectedLayout,
})

function ProtectedLayout() {
  const session = useSession()
  const router = useRouter()

  const logout = useMutation({
    mutationFn: () => auth.logout(),
    onSettled: async () => {
      await router.invalidate()
      await router.navigate({
        to: '/login',
        search: { redirect: '/dashboard', registered: false },
      })
    },
  })

  if (!session.user) return null

  return (
    <div className="min-h-svh bg-muted/30">
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-4">
          <Brand />

          <div className="flex items-center gap-4">
            <span className="hidden text-sm text-muted-foreground sm:block">
              {session.user.fullName}
            </span>

            <Button
              variant="outline"
              disabled={logout.isPending}
              onClick={() => logout.mutate()}
            >
              <LogOut data-icon="inline-start" />
              Log out
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-6 px-6 py-8 md:grid-cols-[180px_1fr]">
        <aside className="flex flex-col gap-5">
          <nav aria-label="Main navigation" className="flex gap-2 md:flex-col">
            <Link
              to="/dashboard"
              className={buttonVariants({
                variant: 'ghost',
                className: 'justify-start',
              })}
              activeProps={{
                'aria-current': 'page',
                className: 'bg-accent',
              }}
            >
              <LayoutDashboard data-icon="inline-start" />
              Overview
            </Link>

            <Link
              to="/wallet"
              className={buttonVariants({
                variant: 'ghost',
                className: 'justify-start',
              })}
              activeProps={{
                'aria-current': 'page',
                className: 'bg-accent',
              }}
            >
              <WalletCards data-icon="inline-start" />
              My wallet
            </Link>
          </nav>

          <Separator />

          <p className="hidden text-xs leading-relaxed text-muted-foreground md:block">
            Demo mode
            <br />
            All balances are simulated NPR funds.
          </p>
        </aside>

        <main className="min-w-0">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
