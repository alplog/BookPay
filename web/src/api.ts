import type { BookPrices, OfferGroup } from './types'

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null
}

function isGroup(v: unknown): v is OfferGroup {
  return (
    isObject(v) &&
    Array.isArray(v.offers) &&
    typeof v.count === 'number' &&
    (v.lowestTotal === null || typeof v.lowestTotal === 'number') &&
    v.offers.every((o) => isObject(o) && typeof o.total === 'number')
  )
}

function isBookPrices(v: unknown): v is BookPrices {
  return (
    isObject(v) &&
    (v.title === null || typeof v.title === 'string') &&
    (v.source === 'live' || v.source === 'cache') &&
    (v.asOf === null || typeof v.asOf === 'string') &&
    typeof v.totalOffers === 'number' &&
    isGroup(v.fbu) &&
    isGroup(v.fbn) &&
    isGroup(v.mu) &&
    isGroup(v.mn)
  )
}

export function fetchBookPrices(isbn: string, signal?: AbortSignal): Promise<BookPrices> {
  return getPrices(`/api/book/${encodeURIComponent(isbn)}`, signal)
}

/** Instant saved snapshot, or null when none is available. */
export async function fetchCachedPrices(isbn: string, signal?: AbortSignal): Promise<BookPrices | null> {
  try {
    return await getPrices(`/api/book/${encodeURIComponent(isbn)}/cached`, signal)
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err
    return null
  }
}

async function getPrices(url: string, signal?: AbortSignal): Promise<BookPrices> {
  let res: Response
  try {
    res = await fetch(url, { signal })
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err
    throw new Error('Network error. Check your connection and try again.')
  }

  let body: unknown
  try {
    body = await res.json()
  } catch {
    throw new Error('Received an unexpected response from the server.')
  }

  if (!res.ok) {
    const message = isObject(body) && typeof body.error === 'string' ? body.error : 'Request failed.'
    throw new Error(message)
  }
  if (!isBookPrices(body)) throw new Error('Received an unexpected response from the server.')
  return body
}
