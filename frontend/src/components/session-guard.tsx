"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
// Only expiry metadata crosses the server boundary; the JWT never does.
export function SessionGuard({ expiresAt }: { expiresAt: number }) {
  const router = useRouter();
  useEffect(() => {
    function checkExpiry() {
      if (Date.now() >= expiresAt)
        window.location.replace("/login?session=expired");
    }
    function recheckSession() {
      checkExpiry();
      router.refresh();
    }
    function onStorage(event: StorageEvent) {
      if (event.key === "payflow-session-change") recheckSession();
    }
    function onPageShow(event: PageTransitionEvent) {
      if (event.persisted) recheckSession();
      else checkExpiry();
    }
    const timer = window.setTimeout(
      checkExpiry,
      Math.max(0, expiresAt - Date.now())
    );
    window.addEventListener("focus", recheckSession);
    window.addEventListener("pageshow", onPageShow);
    window.addEventListener("storage", onStorage);
    // An auth change can happen while this tab is hydrating, before listeners attach.
    recheckSession();
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("focus", recheckSession);
      window.removeEventListener("pageshow", onPageShow);
      window.removeEventListener("storage", onStorage);
    };
  }, [expiresAt, router]);
  return null;
}
