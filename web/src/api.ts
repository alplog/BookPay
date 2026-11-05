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
  return isObject(v) && isGroup(v.fbu) && isGroup(v.fbn)
}

export async function fetchBookPrices(isbn: string, signal?: AbortSignal): Promise<BookPrices> {
  let res: Response
  try {
    res = await fetch(`/api/book/${encodeURIComponent(isbn)}`, { signal })
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
