import { useMutation } from '@tanstack/react-query'
import {
  createFileRoute,
  Outlet,
  Navigate,
  redirect,
  useRouter,
} from '@tanstack/react-router'

import { AppSidebar } from '@/components/app-sidebar'
import { SiteHeader } from '@/components/site-header'
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar'
import { safeReturn } from '@/features/auth/contracts'
import { auth, useSession } from '@/features/auth/session'

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: async ({ context, location }) => {
    await context.auth.restore()

    const user = context.auth.getState().user

    if (!user)
      throw redirect({
        to: '/login',
        search: { redirect: safeReturn(location.href), registered: false },
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

  if (!session.user)
    return (
      <Navigate
        to="/login"
        search={{
          redirect: safeReturn(router.state.location.href),
          registered: false,
        }}
        replace
      />
    )

  return (
    <SidebarProvider>
      <AppSidebar
        user={session.user}
        logout={() => logout.mutate()}
        loggingOut={logout.isPending}
      />
      <SidebarInset>
        <SiteHeader />
        <div className="@container/main flex flex-1 flex-col gap-6 p-4 sm:p-6 lg:p-8">
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
