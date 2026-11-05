import { useState } from 'react'
import { defaultSelection, mockProfit, offerAt, type Selection } from '../profit'
import type { BookPrices } from '../types'
import { OfferGrid } from './OfferGrid'
import { StatCard } from './StatCard'

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })

function formatRank(rank: number | null): string {
  if (rank === null) return '—'
  if (rank >= 1_000_000) return `~${(rank / 1_000_000).toFixed(1)}M`
  if (rank >= 1_000) return `~${Math.round(rank / 1_000)}K`
  return String(rank)
}

export function ResultView({ data }: { data: BookPrices }) {
  const [picked, setPicked] = useState<Selection | null>(null)
  const selected = offerAt(data, picked) ? picked : defaultSelection(data)
  const offer = offerAt(data, selected)

  const profit = offer ? mockProfit(offer.total, data.weightLbs) : null
  const meta = [data.format, data.weightLbs !== null ? `${data.weightLbs.toFixed(2)} lbs` : null].filter(Boolean)

  return (
    <div className="w-full">
      <div className="grid grid-cols-4 gap-2">
        <div className="flex items-center justify-center overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          {data.imageUrl ? (
            <img src={data.imageUrl} alt="" className="h-full max-h-28 w-full object-contain" />
          ) : (
            <span className="text-xs text-gray-400">No cover</span>
          )}
        </div>
        <StatCard label="ASR" value={formatRank(data.asr)} hint={data.asrCategory} />
        <StatCard label="List Price" value={data.listPrice !== null ? usd.format(data.listPrice) : '—'} />
        <StatCard
          label="Profit (F)"
          value={profit !== null ? profit.toFixed(2) : '—'}
          hint={offer ? `@ ${offer.total.toFixed(2)}` : null}
          tone={profit === null ? 'default' : profit >= 0 ? 'positive' : 'negative'}
        />
      </div>

      {data.title && <h2 className="mt-4 text-base font-medium text-gray-900">{data.title}</h2>}
      {meta.length > 0 && <p className="mt-1 text-sm text-gray-500">{meta.join(' · ')}</p>}

      <div className="mt-4">
        {data.totalOffers === 0 ? (
          <p className="rounded-xl border border-gray-200 p-6 text-center text-sm text-gray-500">
            Amazon lists no offers for this book right now (out of stock).
          </p>
        ) : (
          <OfferGrid data={data} selected={selected} onSelect={setPicked} />
        )}
      </div>

      {offer && (
        <p className="mt-2 text-xs text-gray-400">
          {offer.seller} · {offer.condition} · {usd.format(offer.price)}
          {offer.shipping > 0 ? ` + ${usd.format(offer.shipping)} shipping` : ''} · profit is a mock estimate
        </p>
      )}
    </div>
  )
}
