"use client";
import { Button } from "@/components/ui/button";
import { LogoutButton } from "@/components/logout-button";
export default function DashboardError() {
  return (
    <main className="mx-auto flex min-h-svh max-w-md flex-col justify-center gap-4 p-6">
      <h1 className="text-xl font-semibold">
        Your wallet is temporarily unavailable
      </h1>
      <p role="alert" className="text-sm text-muted-foreground">
        We couldn’t load your wallet. Your session has not been cleared. Please
        try again shortly.
      </p>
      <Button onClick={() => window.location.reload()}>Try again</Button>
      <LogoutButton />
    </main>
  );
}
