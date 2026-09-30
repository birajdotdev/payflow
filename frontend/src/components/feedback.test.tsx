// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it, vi } from 'vite-plus/test'

import { ApiError } from '@/lib/api'

import { ErrorNotice } from './feedback'

afterEach(cleanup)

it('offers recovery in an Empty state for a page failure', async () => {
  const retry = vi.fn()
  render(<ErrorNotice error={new ApiError('Connection lost')} retry={retry} />)
  expect(screen.getByRole('alert').getAttribute('data-slot')).toBe('empty')
  expect(screen.getByText('Connection lost')).toBeDefined()
  await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
  expect(retry).toHaveBeenCalledOnce()
})

it('keeps form failures compact and preserves the error message', () => {
  render(
    <ErrorNotice inline error={new ApiError('Insufficient wallet balance')} />
  )
  expect(screen.getByRole('alert').getAttribute('data-slot')).toBe('alert')
  expect(screen.getByText('Insufficient wallet balance')).toBeDefined()
})
