'use client'
// hook_device × beat heatmap + cell detail sheet. Colour ramp and cell geometry from design/gen-main.mjs.
import { useEffect, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { acceptSuggestion, cellVideos, type CellVideo } from '@/app/(app)/actions'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet'
import type { Metric, PairStat, Suggestion } from '@/lib/stats/types'
import { TARGET_N } from '@/lib/suggestions'
import { CHIP, chipText, compact, mult, pct, shortDate, THUMB } from './format'

const RAMP = ['#cde2fb', '#b7d3f6', '#9ec5f4', '#86b6ef', '#6da7ec', '#5598e7', '#3987e5', '#2a78d6', '#256abf', '#1c5cab', '#184f95', '#104281', '#0d366b']
const rampAt = (m: number) => RAMP[Math.min(RAMP.length - 1, Math.max(0, Math.round(((m - 0.05) / 0.6) * (RAMP.length - 1))))]
const EMPTY = '#fafafa'

type Props = { hooks: string[]; beats: string[]; pairs: PairStat[]; metric: Metric; minSample: number; screened: number }

export function Heatmap({ hooks, beats, pairs, metric, minSample, screened }: Props) {
  const [open, setOpen] = useState<PairStat | null>(null)
  const cell = new Map(pairs.map((p) => [`${p.a.value}|${p.b.value}`, p]))
  return (
    <div className="flex flex-col gap-3">
      <div className="grid items-center gap-0.5" style={{ gridTemplateColumns: `150px repeat(${beats.length}, 64px)` }}>
        <div />
        {beats.map((b) => (
          <div key={b} className="flex h-7 items-end justify-center text-center font-mono text-[10px] leading-tight whitespace-pre-line text-muted-foreground">
            {b.replace('_', '_\n')}
          </div>
        ))}
        {hooks.map((h) => (
          <Cells key={h} hook={h} beats={beats} cell={cell} minSample={minSample} selected={open} onSelect={setOpen} />
        ))}
      </div>
      <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
        <div className="flex items-center gap-1">
          <span>hit rate</span>
          {['#cde2fb', '#86b6ef', '#3987e5', '#1c5cab', '#0d366b'].map((c) => (
            <span key={c} className="inline-block h-2.5 w-3.5 rounded-sm" style={{ background: c }} />
          ))}
          <span>5% → 65%</span>
        </div>
        <span>opacity = sample size, full at n ≥ {2 * minSample}</span>
        <div className="flex items-center gap-1">
          <span className="inline-block h-2.5 w-3.5 rounded-sm border border-border" style={{ background: EMPTY }} />
          <span>never combined</span>
        </div>
      </div>
      <CellSheet key={open ? `${open.a.value}|${open.b.value}|${metric}` : 'none'} pair={open} metric={metric} minSample={minSample} screened={screened} onClose={() => setOpen(null)} />
    </div>
  )
}

function Cells({ hook, beats, cell, minSample, selected, onSelect }: { hook: string; beats: string[]; cell: Map<string, PairStat>; minSample: number; selected: PairStat | null; onSelect: (p: PairStat) => void }) {
  return (
    <>
      <div className="pr-2 text-right font-mono text-xs">{hook}</div>
      {beats.map((b) => {
        const p = cell.get(`${hook}|${b}`)
        const n = p?.n ?? 0
        const m = p?.posterior.mean ?? 0
        const op = Math.min(1, n / (2 * minSample))
        const bg = n === 0 ? EMPTY : rampAt(m)
        const ink = n > 0 && op > 0.6 && m > 0.35 ? '#fff' : '#0a0a0a'
        const ring = selected === p && p ? { outline: '2px solid #0a0a0a', outlineOffset: -2 } : {}
        return (
          <button
            key={b}
            type="button"
            disabled={!p}
            onClick={() => p && onSelect(p)}
            className="relative h-10 w-16 rounded disabled:cursor-default"
            style={{ background: bg, ...ring }}
          >
            <div className="absolute inset-0 rounded" style={{ background: bg, opacity: n === 0 ? 1 : op }} />
            <div className="absolute inset-0 rounded bg-white" style={{ opacity: n === 0 ? 0 : (1 - op) * 0.85 }} />
            <div className="relative flex h-full flex-col items-center justify-center leading-[1.1]" style={{ color: ink }}>
              {n === 0 ? (
                <span className="text-[10px] text-[#c3c2b7]">—</span>
              ) : (
                <>
                  <div className="text-xs font-semibold tabular-nums">{pct(m)}</div>
                  <div className="text-[10px] tabular-nums opacity-80">{p!.hits}/{n}</div>
                </>
              )}
            </div>
          </button>
        )
      })}
    </>
  )
}

const signed = (x: number, digits: number) => `${x >= 0 ? '+' : ''}${x.toFixed(digits)}`

function CellSheet({ pair, metric, minSample, screened, onClose }: { pair: PairStat | null; metric: Metric; minSample: number; screened: number; onClose: () => void }) {
  const [videos, setVideos] = useState<CellVideo[] | null>(null)
  const [pending, start] = useTransition()
  useEffect(() => {
    // Remounted via key when the pair changes, so no reset needed here.
    if (!pair) return
    cellVideos(pair.a.value, pair.b.value, metric).then(setVideos, (e) => toast.error('Could not load videos', { description: String(e) }))
  }, [pair, metric])

  const accept = () => {
    if (!pair) return
    const kind = pair.n <= 1 ? 'untested_synergy' : pair.n < minSample ? 'high_uncertainty' : 'confirmation'
    const s: Suggestion = { kind, pair, rationale: `Accepted from the heatmap: ${pct(pair.posterior.mean)} (${pair.hits}/${pair.n}) on ${metric}.`, target_n: TARGET_N }
    start(async () => {
      try {
        await acceptSuggestion(s)
        toast.success('Hypothesis added')
        onClose()
      } catch (e) {
        toast.error('Could not accept', { description: e instanceof Error ? e.message : String(e) })
      }
    })
  }

  const p = pair
  const synergyNote = !p ? '' : p.synergy > 0.3 ? 'synergy' : p.synergy < -0.3 ? 'synergy (redundant)' : 'synergy (≈ additive)'
  return (
    <Sheet open={!!pair} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-[480px] gap-0 sm:max-w-[480px]">
        {p && (
          <>
            <div className="flex flex-col gap-2 border-b px-5 py-4 pr-12">
              <SheetTitle className="flex items-center gap-1.5 font-normal">
                <span className={CHIP}>{chipText(p.a)}</span>
                <span className="text-muted-foreground">×</span>
                <span className={CHIP}>{chipText(p.b)}</span>
              </SheetTitle>
              <SheetDescription className="sr-only">Videos in this combination</SheetDescription>
              <div className="flex gap-4 text-xs">
                <Stat v={pct(p.posterior.mean)} l="posterior hit rate" />
                <Stat v={`${p.hits}/${p.n}`} l="hits" />
                <Stat v={`${Math.round(p.posterior.lo * 100)}–${pct(p.posterior.hi)}`} l="90% interval" />
              </div>
              <div className="flex gap-4 text-xs">
                <Stat v={`${signed(p.conditional_gain.mean * 100, 0)} pts`} l={`vs ${p.a.value} alone`} />
                <Stat v={signed(p.synergy, 1)} l={synergyNote} />
                <Stat v={p.wracc.toFixed(3)} l="WRAcc" />
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" onClick={accept} disabled={pending}>Accept as hypothesis</Button>
                <span className="text-xs text-muted-foreground">1 of {screened} screened combinations</span>
              </div>
            </div>
            <div className="flex flex-col overflow-y-auto px-5 py-2">
              <div className="flex h-8 items-center text-xs text-muted-foreground">
                {videos ? `${videos.length} videos · sorted by ${metric} vs baseline` : 'Loading…'}
              </div>
              {videos?.map((v) => (
                <div key={v.video_id} className="flex items-center gap-3 border-b py-2.5 last:border-b-0">
                  <div className={THUMB} />
                  <div className="min-w-0 grow">
                    <div className="truncate font-medium">“{v.hook_text}”</div>
                    <div className="text-xs text-muted-foreground">{shortDate(v.posted_at)} · {compact(v.value)} {metric}</div>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="font-semibold tabular-nums">{mult(v.log_ratio)}</span>
                    <Badge variant="outline" className={v.hit ? '' : 'text-muted-foreground'}>{v.hit ? 'Hit' : '—'}</Badge>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}

const Stat = ({ v, l }: { v: string; l: string }) => (
  <span>
    <b className="font-semibold">{v}</b> <span className="text-muted-foreground">{l}</span>
  </span>
)
