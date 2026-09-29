import type { Metadata } from "next";
import { Suspense } from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { SectionCards } from "@/components/section-cards";
import { SiteHeader } from "@/components/site-header";
import { SessionGuard } from "@/components/session-guard";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { requireDashboard } from "@/lib/auth/session";
import DashboardLoading from "./loading";
export const metadata: Metadata = { title: "Wallet dashboard | PayFlow" };
async function WalletDashboard() {
  const { user, wallet, expiresAt } = await requireDashboard();
  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties
      }
    >
      <SessionGuard expiresAt={expiresAt} />
      <AppSidebar
        variant="inset"
        user={{ fullName: user.fullName, email: user.email }}
      />
      <SidebarInset>
        <SiteHeader />
        <div className="flex flex-1 flex-col gap-6 px-4 py-6 lg:px-6">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Welcome, {user.fullName}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Your wallet at a glance.
            </p>
          </div>
          <SectionCards wallet={wallet} />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardLoading />}>
      <WalletDashboard />
    </Suspense>
  );
}
