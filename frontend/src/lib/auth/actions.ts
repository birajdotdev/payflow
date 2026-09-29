"use server";
import { revalidatePath } from "next/cache";
import { apiRequest, authErrorMessage } from "@/lib/api/server";
import {
  loginResponseSchema,
  registrationResponseSchema,
} from "@/lib/api/contracts";
import { loginSchema } from "@/lib/validation/auth/login-schema";
import { signupSchema } from "@/lib/validation/auth/signup-schema";
import { clearSession, isSameOrigin, setSession } from "./session";

type AuthResult = { ok: true } | { ok: false; error: string };
const originError: AuthResult = {
  ok: false,
  error: "Unable to submit this request. Reload the page and try again.",
};
export async function loginAction(input: unknown): Promise<AuthResult> {
  if (!(await isSameOrigin())) return originError;
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: "Please check your email and password." };
  try {
    const result = await apiRequest("/auth/login", loginResponseSchema, {
      body: parsed.data,
    });
    await setSession(result.accessToken, result.expiresAt);
  } catch (error) {
    return { ok: false, error: authErrorMessage(error) };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}
export async function signupAction(input: unknown): Promise<AuthResult> {
  if (!(await isSameOrigin())) return originError;
  const parsed = signupSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: "Please check your registration details." };
  try {
    await apiRequest("/auth/register", registrationResponseSchema, {
      body: parsed.data,
    });
  } catch (error) {
    return { ok: false, error: authErrorMessage(error) };
  }
  return { ok: true };
}
export async function logoutAction(): Promise<AuthResult> {
  if (!(await isSameOrigin())) return originError;
  await clearSession();
  revalidatePath("/", "layout");
  return { ok: true };
}
