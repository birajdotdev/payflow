import { useForm } from '@tanstack/react-form'
import { useMutation } from '@tanstack/react-query'
import { Link, useRouter } from '@tanstack/react-router'
import { ArrowRight } from 'lucide-react'
import { z } from 'zod'

import { Brand } from '@/components/brand'
import { ErrorNotice } from '@/components/feedback'
import { LoginForm } from '@/components/login-form'
import { SignupForm } from '@/components/signup-form'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'

import { loginSchema, registerSchema, safeReturn } from './contracts'
import { auth, useSession } from './session'

export function AuthScreen({
  mode,
  redirect = '/dashboard',
  registered = false,
}: {
  mode: 'login' | 'register'
  redirect?: string
  registered?: boolean
}) {
  const router = useRouter()
  const session = useSession()
  const isRegister = mode === 'register'

  const mutation = useMutation({
    mutationFn: async (value: {
      fullName: string
      phone: string
      email: string
      password: string
    }) => {
      if (isRegister) {
        await auth.register(registerSchema.parse(value))

        await router.navigate({
          to: '/login',
          search: { redirect, registered: true },
        })
      } else {
        await auth.login(loginSchema.parse(value))

        await router.invalidate()
        if (redirect === '/wallet' || redirect === '/dashboard')
          await router.navigate({ to: redirect })
        else await router.navigate({ href: safeReturn(redirect) })
      }
    },
  })

  const logout = useMutation({ mutationFn: () => auth.logout() })

  const form = useForm({
    defaultValues: { fullName: '', phone: '', email: '', password: '' },
    validators: {
      onSubmit: isRegister
        ? registerSchema
        : loginSchema.extend({
            fullName: z.string(),
            phone: z.string(),
          }),
    },
    onSubmit: async ({ value }) => {
      await mutation.mutateAsync(value).catch(() => undefined)
    },
  })

  const fields = [
    ...(isRegister
      ? [
          {
            name: 'fullName' as const,
            label: 'Full name',
            type: 'text',
            autoComplete: 'name',
            placeholder: 'Your full name',
          },
          {
            name: 'phone' as const,
            label: 'Phone number',
            type: 'tel',
            autoComplete: 'tel',
            placeholder: '+9779800000000',
          },
        ]
      : []),
    {
      name: 'email' as const,
      label: 'Email address',
      type: 'email',
      autoComplete: 'email',
      placeholder: 'you@example.com',
    },
    {
      name: 'password' as const,
      label: 'Password',
      type: 'password',
      autoComplete: isRegister ? 'new-password' : 'current-password',
      placeholder: 'Enter your password',
    },
  ]

  const FormBlock = isRegister ? SignupForm : LoginForm
  return (
    <main className="flex min-h-svh items-center justify-center bg-muted/40 px-4 py-10 sm:px-6">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <div className="flex justify-center">
          <Brand />
        </div>
        <FormBlock
          footer={
            <p className="text-sm text-muted-foreground">
              {isRegister ? 'Already have an account? ' : 'New to PayFlow? '}
              <Link
                className="font-medium text-primary hover:underline"
                to={isRegister ? '/login' : '/register'}
                search={{ redirect, registered: false }}
              >
                {isRegister ? 'Sign in' : 'Create an account'}
              </Link>
            </p>
          }
        >
          {registered && (
            <Alert variant="success">
              <AlertTitle>Your wallet is ready</AlertTitle>
              <AlertDescription>
                Account created. Sign in to get started.
              </AlertDescription>
            </Alert>
          )}

          {session.logoutUnconfirmed && (
            <Alert variant="warning">
              <AlertTitle>Server logout is unconfirmed</AlertTitle>
              <AlertDescription>
                Your local session was cleared, but we could not confirm
                revocation. Retry before leaving a shared device.
                <Button
                  variant="outline"
                  disabled={logout.isPending}
                  onClick={() => logout.mutate()}
                >
                  Retry logout
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {logout.error && <ErrorNotice inline error={logout.error} />}

          <form
            noValidate
            onSubmit={(event) => {
              event.preventDefault()
              event.stopPropagation()

              void form.handleSubmit()
            }}
          >
            <FieldGroup>
              {fields.map((input) => (
                <form.Field
                  key={input.name}
                  name={input.name}
                  validators={{
                    onBlur: isRegister
                      ? registerSchema.shape[input.name]
                      : input.name === 'email'
                        ? loginSchema.shape.email
                        : loginSchema.shape.password,
                  }}
                >
                  {(field) => {
                    const invalid =
                      field.state.meta.isTouched && !field.state.meta.isValid

                    return (
                      <Field
                        data-invalid={invalid}
                        data-disabled={mutation.isPending}
                      >
                        <FieldLabel htmlFor={field.name}>
                          {input.label}
                        </FieldLabel>

                        <Input
                          id={field.name}
                          name={field.name}
                          type={input.type}
                          autoComplete={input.autoComplete}
                          placeholder={input.placeholder}
                          value={field.state.value}
                          onBlur={field.handleBlur}
                          onChange={(event) =>
                            field.handleChange(event.target.value)
                          }
                          aria-invalid={invalid}
                          aria-describedby={
                            invalid ? `${field.name}-error` : undefined
                          }
                          disabled={mutation.isPending}
                        />

                        {input.name === 'password' && isRegister && (
                          <FieldDescription>
                            At least 8 characters; up to 72 UTF-8 bytes.
                          </FieldDescription>
                        )}

                        {invalid && (
                          <FieldError
                            id={`${field.name}-error`}
                            errors={field.state.meta.errors}
                          />
                        )}
                      </Field>
                    )
                  }}
                </form.Field>
              ))}

              {mutation.error && <ErrorNotice inline error={mutation.error} />}

              <form.Subscribe selector={(state) => [state.isSubmitting]}>
                {([submitting]) => (
                  <Button
                    type="submit"
                    size="lg"
                    disabled={submitting || mutation.isPending}
                  >
                    {submitting ? (
                      <Spinner data-icon="inline-start" />
                    ) : (
                      <ArrowRight data-icon="inline-start" />
                    )}

                    {isRegister ? 'Create account' : 'Sign in'}
                  </Button>
                )}
              </form.Subscribe>
            </FieldGroup>
          </form>
        </FormBlock>
        <FieldDescription className="text-center">
          Demo wallet · All funds are simulated NPR.
        </FieldDescription>
      </div>
    </main>
  )
}
