import { describe, expect, it } from 'vite-plus/test'

import { formatMoney } from '@/features/wallet/queries'

import { passwordSchema, registerSchema, safeReturn } from './contracts'

describe('client contracts', () => {
  it('matches the password code-point and UTF-8 limits', () => {
    expect(passwordSchema.safeParse('😀'.repeat(8)).success).toBe(true)
    expect(passwordSchema.safeParse('😀'.repeat(19)).success).toBe(false)
    expect(passwordSchema.safeParse(' '.repeat(8)).success).toBe(false)
    expect(passwordSchema.safeParse('short').success).toBe(false)
  })
  it('normalizes whitespace and validates international phones', () => {
    const input = {
      fullName: ' Person ',
      email: 'person@example.com ',
      phone: '+9779800000000 ',
      password: 'password123',
    }
    expect(registerSchema.parse(input)).toMatchObject({
      fullName: 'Person',
      email: 'person@example.com',
      phone: '+9779800000000',
    })
    expect(
      registerSchema.safeParse({ ...input, phone: '9800000000' }).success
    ).toBe(false)
  })
  it('only permits supported internal return destinations', () => {
    for (const destination of [
      '//evil.com',
      'https://evil.com',
      '/\\evil.com',
      '/login',
      '/missing',
    ])
      expect(safeReturn(destination)).toBe('/dashboard')
    expect(safeReturn('/wallet')).toBe('/wallet')
  })
  it('formats decimal balances without floating point calculations', () => {
    expect(formatMoney('99999999999999999.99', 'NPR')).toBe(
      'NPR 99,999,999,999,999,999.99'
    )
    expect(formatMoney('0.00', 'NPR')).toBe('NPR 0.00')
  })
})
