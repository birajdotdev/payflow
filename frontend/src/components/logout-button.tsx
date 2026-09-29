"use client";
import { useState } from "react";
import { notifySessionChange } from "@/lib/auth/notify-session-change";
import { LogOutIcon } from "lucide-react";
import { logoutAction } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
export function LogoutButton() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  async function logout() {
    setPending(true);
    setError(undefined);
    try {
      const result = await logoutAction();
      if (!result.ok) {
        setError(result.error);
        setPending(false);
        return;
      }
      notifySessionChange();
      window.location.replace("/login");
    } catch {
      setError("Unable to log out. Please try again.");
      setPending(false);
    }
  }
  return (
    <div className="space-y-2">
      <Button
        className="w-full justify-start"
        variant="ghost"
        disabled={pending}
        onClick={logout}
      >
        <LogOutIcon />
        {pending ? "Logging out…" : "Log out"}
      </Button>
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
