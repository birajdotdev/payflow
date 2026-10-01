// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vite-plus/test'

import {
  HistoryAdvancedFilters,
  advancedFiltersSchema,
} from './history-advanced-filters'

afterEach(cleanup)

const empty = { minAmount: '', maxAmount: '', counterpartyWalletId: '' }
describe('advanced history filters', () => {
  it('validates amount bounds and exact wallet IDs', () => {
    expect(
      advancedFiltersSchema.safeParse({
        ...empty,
        minAmount: '0',
        maxAmount: '1000000',
      }).success
    ).toBe(true)
    for (const minAmount of ['-1', '1.001', '1000000.01', 'NaN', '1e3']) {
      expect(
        advancedFiltersSchema.safeParse({ ...empty, minAmount }).success
      ).toBe(false)
    }
    expect(
      advancedFiltersSchema.safeParse({
        ...empty,
        minAmount: '50',
        maxAmount: '25',
      }).success
    ).toBe(false)
    expect(
      advancedFiltersSchema.safeParse({
        ...empty,
        counterpartyWalletId: 'bad-id',
      }).success
    ).toBe(false)
  })
  it('keeps invalid drafts out of the applied filters and allows correction', async () => {
    const apply = vi.fn()
    const user = userEvent.setup()
    render(<HistoryAdvancedFilters initial={empty} apply={apply} />)
    await user.type(screen.getByLabelText('Minimum amount'), '50')
    await user.type(screen.getByLabelText('Maximum amount'), '25')
    await user.click(
      screen.getByRole('button', { name: 'Apply advanced filters' })
    )
    expect(apply).not.toHaveBeenCalled()
    expect(screen.getByRole('alert').textContent).toContain('Minimum amount')
    await user.clear(screen.getByLabelText('Minimum amount'))
    await user.type(screen.getByLabelText('Minimum amount'), '25')
    await user.click(
      screen.getByRole('button', { name: 'Apply advanced filters' })
    )
    expect(apply).toHaveBeenCalledWith({
      ...empty,
      minAmount: '25',
      maxAmount: '25',
    })
  })
})
