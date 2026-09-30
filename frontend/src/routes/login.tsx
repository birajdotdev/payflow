import { createFileRoute, redirect } from '@tanstack/react-router'

import { AuthScreen } from '@/features/auth/auth-screen'
import { safeReturn } from '@/features/auth/contracts'

export const Route = createFileRoute('/login')({
  validateSearch: (search) => ({
    redirect: safeReturn(search.redirect),
    registered: search.registered === true,
  }),
  beforeLoad: async ({ context, search }) => {
    await context.auth.restore()

    if (context.auth.getState().status === 'authenticated')
      throw redirect({ to: search.redirect })
  },
  component: Login,
})

function Login() {
  const search = Route.useSearch()

  return <AuthScreen mode="login" {...search} />
}
