import { AlertCircle } from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { normalizeError } from '@/lib/api'

export function ErrorNotice({
  error,
  retry,
}: {
  error: unknown
  retry?: () => void
}) {
  const normalized = normalizeError(error)
  return (
    <Alert variant="destructive">
      <AlertCircle />
      <AlertTitle>
        {normalized.status === 403
          ? 'Access denied'
          : 'Unable to complete request'}
      </AlertTitle>
      <AlertDescription>
        <p>{normalized.message}</p>
        {retry && (
          <Button variant="outline" onClick={retry}>
            Try again
          </Button>
        )}
      </AlertDescription>
    </Alert>
  )
}
export function PagePending() {
  return (
    <main
      aria-label="Loading PayFlow"
      aria-busy="true"
      className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-8"
    >
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-48 w-full" />
      <p className="text-sm text-muted-foreground">Connecting to PayFlow…</p>
    </main>
  )
}
