interface Props {
  label: string
  value: string
  hint?: string | null
  tone?: 'default' | 'positive' | 'negative'
}

const TONES = {
  default: 'text-gray-900',
  positive: 'text-green-600',
  negative: 'text-red-600',
}

export function StatCard({ label, value, hint, tone = 'default' }: Props) {
  return (
    <div className="flex min-w-0 flex-col items-center justify-center rounded-xl border border-gray-200 bg-white px-2 py-3 text-center shadow-sm">
      <span className="text-xs text-gray-500">{label}</span>
      <span className={`mt-1 text-xl font-semibold tabular-nums ${TONES[tone]}`}>{value}</span>
      <span className="mt-0.5 h-4 max-w-full truncate text-[11px] text-gray-400">{hint ?? ''}</span>
    </div>
  )
}
