import { z } from "zod";

// Match Java String.strip/isBlank, without changing passwords.
const javaWhitespace =
  "\\u0009-\\u000d\\u001c-\\u0020\\u1680\\u2000-\\u2006\\u2008-\\u200a\\u2028\\u2029\\u205f\\u3000";
const edges = new RegExp(`^[${javaWhitespace}]+|[${javaWhitespace}]+$`, "g");
const blank = new RegExp(`^[${javaWhitespace}]*$`);
export const strip = (value: string) => value.replace(edges, "");
export const emailSchema = z
  .string()
  .transform(strip)
  .transform((value) => value.toLowerCase())
  .pipe(
    z
      .string()
      .min(1, "Email is required")
      .max(255, "Email must be at most 255 characters")
      .email("Enter a valid email address")
  );
export const passwordSchema = z
  .string()
  .refine((value) => !blank.test(value), "Password is required")
  .refine(
    (value) => Array.from(value).length >= 8,
    "Password must contain at least 8 characters"
  )
  .refine(
    (value) => new TextEncoder().encode(value).length <= 72,
    "Password must be at most 72 UTF-8 bytes"
  );
