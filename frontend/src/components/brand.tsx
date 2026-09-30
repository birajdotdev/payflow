import { Link } from '@tanstack/react-router'
import { WalletCards } from 'lucide-react'

export function Brand() {
  return (
    <Link
      to="/"
      className="flex items-center gap-2 text-lg font-semibold tracking-tight"
    >
      <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <WalletCards className="size-5" />
      </span>
      PayFlow
    </Link>
  )
}
