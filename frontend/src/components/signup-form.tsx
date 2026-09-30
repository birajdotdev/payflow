// Adapted from shadcn signup-03; TanStack Form content is supplied by AuthScreen.
import type { ReactNode } from 'react'

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

export function SignupForm({
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
          <h1>Create your account</h1>
        </CardTitle>
        <CardDescription>Your own wallet. Start with NPR 0.00.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">{children}</CardContent>
      <CardFooter className="justify-center">{footer}</CardFooter>
    </Card>
  )
}
