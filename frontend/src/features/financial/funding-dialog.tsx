import { CircleHelp, Plus } from 'lucide-react'
import { useCallback, useState } from 'react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { useSession } from '@/features/auth/session'

import { FundingScreen } from './funding-screen'
import { savedIntentSchema } from './operation'

export function FundingDialog() {
  const user = useSession().user!
  const [open, setOpen] = useState(() => {
    try {
      const saved = savedIntentSchema.safeParse(
        JSON.parse(
          sessionStorage.getItem(`payflow-intent:${user.userId}:DEPOSIT`) ??
            'null'
        )
      )
      return saved.success && saved.data.operation === 'DEPOSIT'
    } catch {
      return false
    }
  })
  const [state, setState] = useState({ pending: false, unknown: false })
  const reportState = useCallback(
    (next: { pending: boolean; unknown: boolean }) => setState(next),
    []
  )

  return (
    <div className="flex flex-col gap-2">
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!state.pending) setOpen(next)
        }}
      >
        <DialogTrigger render={<Button variant="outline" />}>
          <Plus data-icon="inline-start" />
          Add demo funds
        </DialogTrigger>
        <DialogContent className="sm:max-w-lg" showCloseButton={!state.pending}>
          <DialogHeader>
            <DialogTitle>Add demo funds</DialogTitle>
            <DialogDescription>
              Top up your wallet with simulated NPR funds.
            </DialogDescription>
          </DialogHeader>
          <FundingScreen compact onStateChange={reportState} />
        </DialogContent>
      </Dialog>
      {state.unknown && !open && (
        <Alert variant="warning" role="status">
          <CircleHelp />
          <AlertTitle>Deposit outcome unknown</AlertTitle>
          <AlertDescription>
            <p>
              Your deposit may have completed. Check its outcome before adding
              more funds.
            </p>
            <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
              Resume deposit
            </Button>
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}
