import type { OfferGroup } from '../types'

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })

interface Props {
  title: string
  group: OfferGroup
}

export function PriceCard({ title, group }: Props) {
  const lowest = group.lowestTotal

  return (
    <section className="rounded-xl border border-gray-200 p-6">
      <h2 className="text-sm font-medium text-gray-500">{title}</h2>

      {lowest === null || group.count === 0 ? (
        <p className="mt-3 text-lg font-medium text-gray-900">No FBA offers available</p>
      ) : (
        <>
          <p className="mt-3 text-4xl font-semibold tracking-tight">{usd.format(lowest)}</p>
          <p className="mt-1 text-sm text-gray-500">
            Lowest total · {group.count} {group.count === 1 ? 'offer' : 'offers'}
          </p>
          <ul className="mt-5 divide-y divide-gray-100 border-t border-gray-100 text-sm">
            {group.offers.map((o, i) => (
              <li key={i} className="flex justify-between py-2">
                <span className="text-gray-500">{o.condition}</span>
                <span className="font-medium tabular-nums">{usd.format(o.total)}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}
