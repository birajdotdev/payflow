import { WalletIcon, ShieldCheckIcon } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CopyWalletId } from "@/components/copy-wallet-id";
import type { Wallet } from "@/lib/api/contracts";
export function SectionCards({ wallet }: { wallet: Wallet }) {
  // Formatting only: all financial arithmetic and precision enforcement stay in Spring Boot.
  const balance = new Intl.NumberFormat("en-NP", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(wallet.balance);
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardDescription className="flex items-center gap-2">
            <WalletIcon className="size-4" />
            Available balance
          </CardDescription>
          <CardTitle
            className="text-3xl font-semibold tabular-nums"
            data-testid="wallet-balance"
          >
            NPR {balance}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Simulated funds for exploring PayFlow.
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardDescription className="flex items-center gap-2">
            <ShieldCheckIcon className="size-4" />
            Wallet status
          </CardDescription>
          <CardTitle>
            <Badge
              variant={wallet.status === "ACTIVE" ? "secondary" : "outline"}
            >
              {wallet.status === "ACTIVE" ? "Active" : "Frozen"}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {wallet.status === "ACTIVE"
              ? "Your NPR wallet is ready."
              : "Your wallet is readable, but financial operations are unavailable while frozen."}
          </p>
        </CardContent>
      </Card>
      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle>Wallet ID</CardTitle>
          <CardDescription>
            Your unique identifier for receiving transfers.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CopyWalletId walletId={wallet.walletId} />
        </CardContent>
      </Card>
    </div>
  );
}
