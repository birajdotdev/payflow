import { createFileRoute } from '@tanstack/react-router'

import { WalletScreen } from '@/features/wallet/wallet-screen'

export const Route = createFileRoute('/_authenticated/dashboard')({
  component: () => <WalletScreen overview />,
})
