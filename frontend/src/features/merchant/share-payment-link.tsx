import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from '@/components/ui/toast'

export function SharePaymentLink({ id }: { id: string }) {
  const [copied, setCopied] = useState(false)

  const [error, setError] = useState<unknown>()

  const url = `${window.location.origin}/payments/${id}`

  return (
    <div className="flex flex-col gap-2">
      <Button
        size="sm"
        variant="outline"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url)
            setCopied(true)
            setError(undefined)
            toast.add({ title: 'Payment link copied', type: 'success' })
          } catch (copyError) {
            setError(copyError)
            toast.add({
              title: 'Couldn’t copy the link',
              description: 'Select and copy the payment link below.',
              type: 'error',
            })
          }
        }}
      >
        {copied ? 'Link copied' : 'Copy payment link'}
      </Button>
      {error ? (
        <Input
          aria-label="Payment link"
          readOnly
          value={url}
          onFocus={(e) => e.target.select()}
        />
      ) : null}
    </div>
  )
}
