import { z } from 'zod'

export const emailSchema = z
  .string()
  .trim()
  .email('Enter a valid email address.')
  .max(255)

export const passwordSchema = z
  .string()
  .refine(
    (value) => value.trim().length > 0 && Array.from(value).length >= 8,
    'Use at least 8 characters.'
  )
  .refine(
    (value) => new TextEncoder().encode(value).length <= 72,
    'Password must be 72 UTF-8 bytes or fewer.'
  )

export const loginSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
})

export const registerSchema = loginSchema.extend({
  fullName: z.string().trim().min(1, 'Enter your full name.').max(100),
  phone: z
    .string()
    .trim()
    .regex(
      /^\+[1-9][0-9]{7,14}$/,
      'Use an international phone number, such as +9779800000000.'
    ),
})

export type LoginInput = z.infer<typeof loginSchema>

export type RegisterInput = z.infer<typeof registerSchema>

export type User = {
  userId: string
  fullName: string
  email: string
  phone: string
  role: 'USER' | 'MERCHANT' | 'ADMIN'
  status: 'ACTIVE' | 'SUSPENDED'
}

export type LoginResponse = {
  accessToken: string
  tokenType: string
  expiresIn: number
  expiresAt: string
  user: User
}

export type RegisterResponse = Omit<User, 'status'> & { walletId: string }

export function safeReturn(value: unknown): '/dashboard' | '/wallet' {
  return value === '/wallet' ? '/wallet' : '/dashboard'
}
