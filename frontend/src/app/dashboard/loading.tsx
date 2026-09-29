import { Skeleton } from "@/components/ui/skeleton";
export default function DashboardLoading() {
  return (
    <main aria-busy="true" className="mx-auto w-full max-w-5xl space-y-6 p-6">
      <p role="status" className="text-sm text-muted-foreground">
        Loading your wallet…
      </p>
      <Skeleton className="h-8 w-48" />
      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-40" />
        <Skeleton className="h-40" />
      </div>
      <Skeleton className="h-40" />
    </main>
  );
}
