import { COLUMNS, groupOf, type Selection } from '../profit'
import type { BookPrices } from '../types'

interface Props {
  data: BookPrices
  selected: Selection | null
  onSelect: (selection: Selection) => void
}

export function OfferGrid({ data, selected, onSelect }: Props) {
  const rows = Math.max(...COLUMNS.map((c) => groupOf(data, c.key).offers.length))

  return (
    <div className="w-full overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="grid grid-cols-4 bg-gray-50 px-2 py-3 text-center text-sm font-medium text-gray-500">
        {COLUMNS.map((c) => {
          const count = groupOf(data, c.key).count
          return <span key={c.key}>{count > 0 ? `${c.label} (${count})` : c.label}</span>
        })}
      </div>

      <div className="max-h-96 overflow-y-auto px-2 py-1">
        {Array.from({ length: rows }, (_, index) => (
          <div key={index} className="grid grid-cols-4 items-center">
            {COLUMNS.map((c) => {
              const offer = groupOf(data, c.key).offers[index]
              if (!offer) return <span key={c.key} />
              const isSelected = selected?.column === c.key && selected.index === index
              return (
                <button
                  key={c.key}
                  type="button"
                  aria-pressed={isSelected}
                  title={`${offer.seller} · ${offer.condition}`}
                  onClick={() => onSelect({ column: c.key, index })}
                  className={`m-1 rounded-lg border-2 py-2.5 text-lg tabular-nums transition-colors ${
                    isSelected
                      ? 'border-gray-900 font-medium text-green-600 underline decoration-orange-500 decoration-2 underline-offset-4'
                      : 'border-transparent text-gray-800 hover:bg-gray-100'
                  }`}
                >
                  {offer.total.toFixed(2)}
                </button>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
