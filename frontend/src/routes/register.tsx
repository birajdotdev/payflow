import { createFileRoute, redirect } from '@tanstack/react-router'

import { AuthScreen } from '@/features/auth/auth-screen'
import { safeReturn } from '@/features/auth/contracts'

export const Route = createFileRoute('/register')({
  validateSearch: (search) => ({ redirect: safeReturn(search.redirect) }),
  beforeLoad: async ({ context }) => {
    await context.auth.restore()
    if (context.auth.getState().status === 'authenticated')
      throw redirect({ to: '/dashboard' })
  },
  component: Register,
})
function Register() {
  return <AuthScreen mode="register" redirect={Route.useSearch().redirect} />
}
