import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { apiRequest, ApiError } from "@/lib/api/server";
import { userSchema, walletSchema } from "@/lib/api/contracts";

export const SESSION_COOKIE = "payflow_session";
export async function isSameOrigin(): Promise<boolean> {
  const origin = (await headers()).get("origin");
  return (
    origin === new URL(process.env.APP_ORIGIN ?? "http://localhost:3000").origin
  );
}
export async function setSession(token: string, expiresAt: string) {
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: new Date(expiresAt),
  });
}
export async function clearSession() {
  (await cookies()).delete(SESSION_COOKIE);
}
export async function requireDashboard() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) redirect("/login?session=expired");
  // Expiry is only a UI hint. Spring Boot verifies the signature and current account.
  let expiresAt: number;
  try {
    const payload = JSON.parse(
      Buffer.from(token.split(".")[1], "base64url").toString()
    );
    expiresAt =
      z.object({ exp: z.number().positive() }).parse(payload).exp * 1000;
  } catch {
    redirect("/login?session=expired");
  }
  if (expiresAt <= Date.now()) redirect("/login?session=expired");
  try {
    const [user, wallet] = await Promise.all([
      apiRequest("/auth/me", userSchema, { token }),
      apiRequest("/wallet", walletSchema, { token }),
    ]);
    return { user, wallet, expiresAt };
  } catch (error) {
    if (error instanceof ApiError && error.status === 401)
      redirect("/login?session=expired");
    throw error;
  }
}
