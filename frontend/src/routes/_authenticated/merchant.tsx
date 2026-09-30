import { createFileRoute } from '@tanstack/react-router'

import { MerchantScreen } from '@/features/merchant/merchant-screen'

export const Route = createFileRoute('/_authenticated/merchant')({
  component: MerchantScreen,
})
