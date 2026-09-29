import "server-only";
import { z } from "zod";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string
  ) {
    super("PayFlow API request failed");
  }
}
export async function apiRequest<T>(
  path: string,
  schema: z.ZodType<T>,
  options: { token?: string; body?: unknown } = {}
): Promise<T> {
  const baseUrl = process.env.PAYFLOW_API_URL ?? "http://localhost:8080";
  let response: Response;
  let payload: unknown;
  try {
    response = await fetch(new URL(`/api/v1${path}`, baseUrl), {
      method: options.body === undefined ? "GET" : "POST",
      headers: {
        Accept: "application/json",
        ...(options.body === undefined
          ? {}
          : { "Content-Type": "application/json" }),
        ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      },
      body:
        options.body === undefined ? undefined : JSON.stringify(options.body),
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(10_000),
    });
    payload = await response.json();
  } catch {
    throw new ApiError(503, "SERVICE_UNAVAILABLE");
  }
  if (!response.ok) {
    const error = z.object({ code: z.string() }).safeParse(payload);
    throw new ApiError(
      response.status,
      error.success ? error.data.code : "UNKNOWN_ERROR"
    );
  }
  const result = z
    .object({ success: z.literal(true), data: schema })
    .safeParse(payload);
  if (!result.success) throw new ApiError(502, "INVALID_RESPONSE");
  return result.data.data;
}
export function authErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === "INVALID_CREDENTIALS")
      return "Email or password is incorrect, or this account is unavailable.";
    if (error.code === "REGISTRATION_CONFLICT")
      return "An account could not be created with these details. Try signing in or use different details.";
    if (error.status === 400) return "Please check your details and try again.";
  }
  return "PayFlow is unavailable right now. Please try again shortly.";
}
