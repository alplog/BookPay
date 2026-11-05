import { useRef, useState, type FormEvent } from 'react'
import { AlertCircle, Loader2, Search } from 'lucide-react'
import { fetchBookPrices, fetchCachedPrices } from './api'
import { ResultView } from './components/ResultView'
import type { BookPrices } from './types'

export default function App() {
  const [isbn, setIsbn] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<BookPrices | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const value = isbn.trim()
    if (!value || loading) return

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setLoading(true)
    setError(null)
    setData(null)

    let liveDone = false
    fetchCachedPrices(value, controller.signal)
      .then((cached) => {
        if (cached && !liveDone && abortRef.current === controller) setData(cached)
      })
      .catch(() => {})

    try {
      const live = await fetchBookPrices(value, controller.signal)
      liveDone = true
      setData(live)
    } catch (err) {
      liveDone = true
      if (err instanceof DOMException && err.name === 'AbortError') return
      setData(null)
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      if (abortRef.current === controller) setLoading(false)
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center px-4 py-12 sm:py-20">
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Book Price Lookup</h1>
      <p className="mt-2 text-gray-500">Check live Amazon book prices.</p>

      <form onSubmit={onSubmit} className="mt-8 flex w-full max-w-xl flex-col gap-3 sm:flex-row">
        <input
          type="text"
          inputMode="numeric"
          value={isbn}
          onChange={(e) => setIsbn(e.target.value)}
          placeholder="ISBN-10 or ISBN-13"
          aria-label="ISBN"
          autoFocus
          className="h-11 flex-1 rounded-lg border border-gray-300 px-3 text-base outline-none focus:border-gray-900"
        />
        <button
          type="submit"
          disabled={loading || isbn.trim() === ''}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-gray-900 px-5 text-sm font-medium text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Search className="h-4 w-4" />
          Check Prices
        </button>
      </form>

      {loading && (
        <div className="mt-12 flex items-center gap-2 text-gray-500" role="status">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>
            {data?.source === 'cache'
              ? `Showing saved prices${data.asOf ? ` from ${new Date(data.asOf).toLocaleString()}` : ''}. Updating with live prices…`
              : 'Fetching live prices… this can take up to 30 seconds.'}
          </span>
        </div>
      )}

      {error && (
        <div className="mt-8 flex w-full max-w-xl items-start gap-2 rounded-lg border border-gray-200 p-4 text-sm" role="alert">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
          <span>{error}</span>
        </div>
      )}

      {data && (
        <div className={`${loading ? 'mt-6' : 'mt-10'} w-full ${data.source === 'cache' ? 'opacity-60' : ''}`}>
          <ResultView key={data.isbn} data={data} />
        </div>
      )}
    </main>
  )
}
