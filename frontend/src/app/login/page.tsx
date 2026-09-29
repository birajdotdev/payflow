import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthShell } from "@/components/auth-shell";
import { LoginForm } from "@/components/login-form";
export const metadata: Metadata = { title: "Log in | PayFlow" };
async function LoginNotice({
  searchParams,
}: {
  searchParams: Promise<{ registered?: string; session?: string }>;
}) {
  const params = await searchParams;
  if (params.registered === "1")
    return (
      <p role="status" className="text-center text-sm">
        Account created. Log in to access your wallet.
      </p>
    );
  if (params.session === "expired")
    return (
      <p role="status" className="text-center text-sm">
        Please log in to continue. Your session may have expired.
      </p>
    );
  return null;
}
export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ registered?: string; session?: string }>;
}) {
  return (
    <AuthShell>
      <Suspense fallback={null}>
        <LoginNotice searchParams={searchParams} />
      </Suspense>
      <LoginForm />
    </AuthShell>
  );
}
