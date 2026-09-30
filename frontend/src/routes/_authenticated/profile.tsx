import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'

import { ErrorNotice, PagePending } from '@/components/feedback'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { useSession } from '@/features/auth/session'
import { profileQuery } from '@/features/wallet/queries'

export const Route = createFileRoute('/_authenticated/profile')({
  component: ProfileScreen,
})

function ProfileScreen() {
  const user = useSession().user!
  const profile = useQuery(profileQuery(user.userId))
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">Your profile</h1>
      <Card>
        <CardHeader>
          <CardTitle>Account details</CardTitle>
          <CardDescription>Your current PayFlow profile.</CardDescription>
        </CardHeader>
        <CardContent>
          {profile.error ? (
            <ErrorNotice
              error={profile.error}
              retry={() => {
                void profile.refetch()
              }}
            />
          ) : profile.data ? (
            <dl className="grid gap-4 sm:grid-cols-2">
              {(
                [
                  ['Full name', profile.data.fullName],
                  ['Email address', profile.data.email],
                  ['Phone number', profile.data.phone],
                  ['Role', profile.data.role],
                  ['Status', profile.data.status],
                  ['User ID', profile.data.userId],
                ] as const
              ).map(([label, value]) => (
                <div key={label} className="flex flex-col gap-1">
                  <dt className="text-sm text-muted-foreground">{label}</dt>
                  <dd className="text-sm break-all">{value}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <PagePending />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
