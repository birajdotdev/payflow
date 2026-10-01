// Adapted from shadcn dashboard-01.
import { useRouterState } from '@tanstack/react-router'

import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { SidebarTrigger } from '@/components/ui/sidebar'
export function SiteHeader() {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })
  const title =
    pathname === '/admin'
      ? 'Administration'
      : pathname === '/merchant'
        ? 'Merchant'
        : pathname.startsWith('/payments/')
          ? 'Merchant payment'
          : pathname.startsWith('/transactions/') &&
              pathname !== '/transactions/'
            ? 'Transaction receipt'
            : pathname.startsWith('/transactions')
              ? 'Transactions'
              : pathname === '/send'
                ? 'Send money'
                : pathname === '/wallet'
                  ? 'My wallet'
                  : pathname === '/profile'
                    ? 'Profile'
                    : 'Overview'
  return (
    <header className="flex h-16 shrink-0 items-center gap-2 border-b">
      <div className="flex w-full items-center gap-3 px-4 sm:px-6">
        <SidebarTrigger />
        <Separator
          orientation="vertical"
          className="h-4 data-vertical:self-auto"
        />
        <span className="text-sm font-medium">{title}</span>
        <Badge variant="outline" className="ml-auto">
          NPR wallet
        </Badge>
      </div>
    </header>
  )
}
