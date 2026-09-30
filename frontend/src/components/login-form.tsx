// Adapted from shadcn login-03; TanStack Form content is supplied by AuthScreen.
import type { ReactNode } from 'react'

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

export function LoginForm({
  children,
  footer,
}: {
  children: ReactNode
  footer: ReactNode
}) {
  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle>
          <h1>Welcome back</h1>
        </CardTitle>
        <CardDescription>Sign in to your PayFlow wallet.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">{children}</CardContent>
      <CardFooter className="justify-center">{footer}</CardFooter>
    </Card>
  )
}
