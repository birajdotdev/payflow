// Adapted from shadcn dashboard-01.
import { Link, linkOptions, useRouterState } from '@tanstack/react-router'
import {
  ArrowUpRight,
  History,
  LayoutDashboard,
  WalletCards,
  UserRound,
  Store,
} from 'lucide-react'

import { Brand } from '@/components/brand'
import { NavUser } from '@/components/nav-user'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from '@/components/ui/card'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar'
import type { User } from '@/features/auth/contracts'
const navigation = linkOptions([
  { to: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { to: '/wallet', label: 'My wallet', icon: WalletCards },
  { to: '/profile', label: 'Profile', icon: UserRound },
  { to: '/send', label: 'Send money', icon: ArrowUpRight },
  { to: '/merchant', label: 'Merchant', icon: Store },
  {
    to: '/transactions',
    search: { page: 0, size: 20 },
    label: 'Transactions',
    icon: History,
  },
])
export function AppSidebar({
  user,
  logout,
  loggingOut,
}: {
  user: User
  logout: () => void
  loggingOut: boolean
}) {
  const { setOpenMobile } = useSidebar()
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })
  return (
    <Sidebar variant="inset" collapsible="offcanvas">
      <SidebarHeader className="px-4 py-5">
        <Brand />
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Workspace</SidebarGroupLabel>
          <SidebarGroupContent>
            <nav aria-label="Main navigation">
              <SidebarMenu>
                {navigation.map(({ label, icon: Icon, ...options }) => (
                  <SidebarMenuItem key={options.to}>
                    <SidebarMenuButton
                      isActive={pathname.startsWith(options.to)}
                      render={
                        <Link
                          {...options}
                          onClick={() => setOpenMobile(false)}
                        />
                      }
                    >
                      <Icon />
                      <span>{label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </nav>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup className="mt-auto">
          <Card size="sm">
            <CardHeader>
              <Badge variant="secondary" className="w-fit">
                Demo mode
              </Badge>
            </CardHeader>
            <CardContent>
              <CardDescription>
                A place to try your financial workflow with simulated NPR funds.
              </CardDescription>
            </CardContent>
          </Card>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} logout={logout} loggingOut={loggingOut} />
      </SidebarFooter>
    </Sidebar>
  )
}
