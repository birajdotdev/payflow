import { Link } from '@tanstack/react-router'
import { useState } from 'react'
import type { ReactElement, ReactNode } from 'react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

import { ReceiptContent } from './receipt-screen'

export function ReceiptDialog({
  transactionId,
  trigger,
}: {
  transactionId: string
  trigger?: ReactElement<{ children?: ReactNode }>
}) {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger ?? <Button variant="outline" />}>
        {trigger?.props.children ?? 'View receipt'}
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Transaction receipt</DialogTitle>
          <DialogDescription>
            Your confirmed transaction record from PayFlow.
          </DialogDescription>
        </DialogHeader>
        {open && <ReceiptContent transactionId={transactionId} />}
        <p className="text-center text-xs text-muted-foreground">
          Simulated funds · No real money was moved
        </p>
        <DialogFooter showCloseButton>
          <Button
            nativeButton={false}
            render={
              <Link
                to="/transactions/$transactionId"
                params={{ transactionId }}
              />
            }
          >
            Open full receipt
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
