import { Check, Copy } from 'lucide-react'
import { useState } from 'react'

import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@/components/ui/input-group'

export function WalletId({
  value,
  label = 'Wallet ID',
}: {
  value: string
  label?: string
}) {
  const [feedback, setFeedback] = useState('')

  async function copy() {
    try {
      await navigator.clipboard.writeText(value)
      setFeedback('Copied')
    } catch {
      setFeedback('Could not copy. Select the wallet ID and copy it manually.')
    }
  }

  return (
    <div className="flex min-w-0 flex-col gap-1">
      <InputGroup>
        <InputGroupInput
          value={value}
          readOnly
          aria-label={label}
          onFocus={(event) => event.currentTarget.select()}
        />
        <InputGroupAddon align="inline-end">
          <InputGroupButton
            aria-label={`Copy ${label}`}
            title={`Copy ${label}`}
            onClick={() => void copy()}
          >
            {feedback === 'Copied' ? (
              <Check data-icon="inline-start" />
            ) : (
              <Copy data-icon="inline-start" />
            )}
            {feedback === 'Copied' ? 'Copied' : 'Copy'}
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
      <span
        role="status"
        className={
          feedback === 'Copied' || !feedback
            ? 'sr-only'
            : 'text-xs text-muted-foreground'
        }
      >
        {feedback}
      </span>
    </div>
  )
}
