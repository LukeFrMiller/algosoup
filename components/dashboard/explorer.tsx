// Dimension explorer bars — plain divs, geometry copied from design/gen-main.mjs (W=560px per 100%).
import type { LabelStat } from '@/lib/stats/types'
import { pct } from './format'

const W = 560
const BLUE = '#2a78d6'

export function Explorer({ rows, p0, minSample }: { rows: LabelStat[]; p0: number; minSample: number }) {
  if (!rows.length) return <p className="text-xs text-muted-foreground">No labelled reels for this dimension yet.</p>
  return (
    <div className="flex max-w-[820px] flex-col gap-1">
      {rows.map((r) => {
        const { mean: m, lo, hi } = r.posterior
        const dim = r.n < minSample
        return (
          <div key={r.value} className="flex h-7 items-center gap-3" style={{ opacity: dim ? 0.4 : 1 }}>
            <div className="w-[150px] text-right font-mono text-xs">{r.value}</div>
            <div className="relative h-7 grow">
              <div className="absolute inset-y-0 left-0 w-px bg-[#c3c2b7]" />
              <div className="absolute inset-y-0 w-px border-l border-dashed border-[#c3c2b7]" style={{ left: Math.round(p0 * W) }} />
              <div className="absolute top-1.5 left-0 h-4 rounded-r" style={{ width: Math.round(m * W), background: BLUE }} />
              <div className="absolute top-[13px] h-0.5 bg-[#525252]" style={{ left: Math.round(lo * W), width: Math.round((hi - lo) * W) }} />
              <div className="absolute top-[5px] text-xs whitespace-nowrap tabular-nums" style={{ left: Math.round(Math.max(m, hi) * W) + 10 }}>
                <b className="font-semibold">{pct(m)}</b>{' '}
                <span className="text-muted-foreground">
                  {r.hits}/{r.n}
                  {dim && ' · low sample'}
                </span>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
