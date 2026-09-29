"use client";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { LogoutButton } from "@/components/logout-button";
import type { UserProfile } from "@/lib/api/contracts";
export function NavUser({
  user,
}: {
  user: Pick<UserProfile, "fullName" | "email">;
}) {
  const initials = user.fullName
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => Array.from(part)[0] ?? "")
    .join("")
    .toUpperCase();
  return (
    <div className="space-y-3 border-t pt-3">
      <div className="flex min-w-0 items-center gap-2 px-2">
        <Avatar className="size-8">
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 text-sm">
          <p className="truncate font-medium">{user.fullName}</p>
          <p className="truncate text-xs text-muted-foreground">{user.email}</p>
        </div>
      </div>
      <LogoutButton />
    </div>
  );
}
