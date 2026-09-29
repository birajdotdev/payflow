import { z } from "zod";
import { emailSchema, passwordSchema, strip } from "./shared";
export const signupSchema = z.object({
  fullName: z
    .string()
    .transform(strip)
    .pipe(
      z
        .string()
        .min(1, "Full name is required")
        .max(100, "Full name must be at most 100 characters")
    ),
  email: emailSchema,
  phone: z
    .string()
    .transform(strip)
    .pipe(
      z
        .string()
        .regex(
          /^\+[1-9][0-9]{7,14}$/,
          "Use an international number, such as +9779812345678"
        )
    ),
  password: passwordSchema,
});
export type SignupSchema = z.infer<typeof signupSchema>;
