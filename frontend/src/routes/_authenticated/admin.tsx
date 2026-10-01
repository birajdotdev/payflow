import { createFileRoute } from '@tanstack/react-router'

import { AdminScreen } from '@/features/admin/admin-screen'
export const Route = createFileRoute('/_authenticated/admin')({
  component: AdminScreen,
})
