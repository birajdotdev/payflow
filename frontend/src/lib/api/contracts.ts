import { z } from "zod";
export const userSchema = z.object({
  userId: z.string().uuid(),
  fullName: z.string(),
  email: z.string(),
  phone: z.string(),
  role: z.enum(["USER", "MERCHANT", "ADMIN"]),
  status: z.enum(["ACTIVE", "SUSPENDED"]),
});
export const walletSchema = z.object({
  walletId: z.string().uuid(),
  balance: z.number().min(0).max(1_000_000),
  currency: z.literal("NPR"),
  status: z.enum(["ACTIVE", "FROZEN"]),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export const loginResponseSchema = z.object({
  accessToken: z.string().min(1),
  tokenType: z.literal("Bearer"),
  expiresAt: z.iso.datetime(),
  expiresIn: z.number().positive(),
  user: userSchema,
});
export const registrationResponseSchema = z.object({
  userId: z.string().uuid(),
  walletId: z.string().uuid(),
});
export type UserProfile = z.infer<typeof userSchema>;
export type Wallet = z.infer<typeof walletSchema>;
