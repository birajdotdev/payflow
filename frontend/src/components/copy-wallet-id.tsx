"use client";
import { useState } from "react";
import { CopyIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
export function CopyWalletId({ walletId }: { walletId: string }) {
  const [message, setMessage] = useState("");
  async function copy() {
    try {
      await navigator.clipboard.writeText(walletId);
      setMessage("Wallet ID copied.");
    } catch {
      setMessage("Could not copy. Select the wallet ID and copy it manually.");
    }
  }
  return (
    <div className="space-y-3">
      <code className="block text-sm break-all" data-testid="wallet-id">
        {walletId}
      </code>
      <Button variant="outline" onClick={copy}>
        <CopyIcon />
        Copy wallet ID
      </Button>
      <p role="status" className="text-xs text-muted-foreground">
        {message}
      </p>
    </div>
  );
}
