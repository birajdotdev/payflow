import Link from "next/link";
import { WalletIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

export function Navbar() {
  return (
    <header className="border-b bg-background">
      <nav
        aria-label="Main navigation"
        className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8"
      >
        <Link
          href="/"
          className="flex items-center gap-2 font-medium"
        >
          <span className="flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <WalletIcon aria-hidden="true" className="size-4" />
          </span>
          PayFlow
        </Link>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            nativeButton={false}
            render={<Link href="/login" />}
          >
            Log in
          </Button>
          <Button nativeButton={false} render={<Link href="/signup" />}>
            Get started
          </Button>
        </div>
      </nav>
    </header>
  );
}
