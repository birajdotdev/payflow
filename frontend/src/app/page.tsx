import Link from "next/link";
import { WalletIcon } from "lucide-react";
import { Navbar } from "@/components/navbar";
import { Button } from "@/components/ui/button";
export default function Page() {
  return (
    <>
      <Navbar />
      <main className="mx-auto flex min-h-[calc(100svh-4rem)] max-w-3xl flex-col items-center justify-center gap-6 px-6 py-16 text-center">
        <div className="flex size-14 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <WalletIcon className="size-7" />
        </div>
        <p className="text-sm font-medium text-muted-foreground">
          Your demo wallet
        </p>
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          A simpler place to start with PayFlow.
        </h1>
        <p className="max-w-lg text-base leading-relaxed text-muted-foreground">
          Create an account and explore your own NPR wallet. All funds are
          simulated—no bank account or card required.
        </p>
        <div className="flex gap-3">
          <Button
            size="lg"
            nativeButton={false}
            render={<Link href="/signup" />}
          >
            Create account
          </Button>
          <Button
            size="lg"
            variant="outline"
            nativeButton={false}
            render={<Link href="/login" />}
          >
            Log in
          </Button>
        </div>
      </main>
    </>
  );
}
