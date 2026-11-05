import type { BookPrices, FbaOffer, OfferGroup } from './types'

export type ColumnKey = 'mu' | 'fbu' | 'fbn' | 'mn'

export const COLUMNS: { key: ColumnKey; label: string }[] = [
  { key: 'mu', label: 'MU' },
  { key: 'fbu', label: 'FU' },
  { key: 'fbn', label: 'FN' },
  { key: 'mn', label: 'MN' },
]

export interface Selection {
  column: ColumnKey
  index: number
}

// MOCK: placeholder economics until the real fee/cost model is defined.
const MOCK_COST = 3
const REFERRAL_RATE = 0.15
const CLOSING_FEE = 1.8
const FBA_BASE_FEE = 2.5
const FBA_FEE_PER_LB = 0.4

/** Profit if the book is sold (FBA) at `sellPrice`. */
export function mockProfit(sellPrice: number, weightLbs: number | null): number {
  const fees = sellPrice * REFERRAL_RATE + CLOSING_FEE + FBA_BASE_FEE + FBA_FEE_PER_LB * (weightLbs ?? 1)
  return Math.round((sellPrice - fees - MOCK_COST) * 100) / 100
}

export function groupOf(data: BookPrices, column: ColumnKey): OfferGroup {
  return data[column]
}

export function offerAt(data: BookPrices, sel: Selection | null): FbaOffer | null {
  return sel ? (groupOf(data, sel.column).offers[sel.index] ?? null) : null
}

/** Cheapest Amazon-fulfilled new offer first, then the other columns in priority order. */
export function defaultSelection(data: BookPrices): Selection | null {
  for (const column of ['fbn', 'fbu', 'mn', 'mu'] as const) {
    if (data[column].offers.length > 0) return { column, index: 0 }
  }
  return null
}
