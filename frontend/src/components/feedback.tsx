import { AlertCircle, LockKeyhole, RefreshCw } from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { Skeleton } from '@/components/ui/skeleton'
import { normalizeError } from '@/lib/api'

type ErrorNoticeProps = {
  error: unknown
  retry?: () => void
  inline?: boolean
}

export function ErrorNotice({
  error,
  retry,
  inline = false,
}: ErrorNoticeProps) {
  const normalized = normalizeError(error)
  const title =
    normalized.status === 403 ? 'Access denied' : 'Unable to complete request'

  if (inline) {
    return (
      <Alert variant="destructive">
        <AlertCircle />
        <AlertTitle>{title}</AlertTitle>
        <AlertDescription>
          <p>{normalized.message}</p>
          {retry && (
            <Button variant="outline" size="sm" onClick={retry}>
              Try again
            </Button>
          )}
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <Empty role="alert" className="min-h-64 border">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          {normalized.status === 403 ? <LockKeyhole /> : <AlertCircle />}
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{normalized.message}</EmptyDescription>
      </EmptyHeader>
      {retry && (
        <EmptyContent>
          <Button variant="outline" onClick={retry}>
            <RefreshCw data-icon="inline-start" />
            Try again
          </Button>
        </EmptyContent>
      )}
    </Empty>
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
