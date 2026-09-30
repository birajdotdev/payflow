import { createFileRoute } from '@tanstack/react-router'

import { FundingScreen } from '@/features/financial/funding-screen'
export const Route = createFileRoute('/_authenticated/send')({
  component: () => <FundingScreen transfer />,
})
