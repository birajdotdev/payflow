import { CheckCircle2, Clock3, XCircle } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
export function TransactionStatus({ status }: { status: string }) {
  const Icon =
    status === 'SUCCESS' ? CheckCircle2 : status === 'FAILED' ? XCircle : Clock3
  return (
    <Badge variant={status === 'FAILED' ? 'destructive' : 'outline'}>
      <Icon />
      {status === 'SUCCESS'
        ? 'Completed'
        : status === 'FAILED'
          ? 'Failed'
          : status === 'REFUNDED'
            ? 'Refunded'
            : 'Pending'}
    </Badge>
  )
}
