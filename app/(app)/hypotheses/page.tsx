import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { evaluateHypothesis, humanise } from '@/lib/suggestions'
import { createClient } from '@/lib/supabase/server'
import { ClickRow, NewHypothesis } from '@/components/hypotheses/client'
import { Chip, Dot, cap, labelEntries, fmtDate, fmtShortDate, pct, ratio, type Metric, type Row, type View } from '@/components/video/format'
import { closeHypothesis, extendTarget } from './actions'

type Hyp = Row<'hypotheses'>
type Top = View<'v_top_videos'>

export default async function HypothesesPage({ searchParams }: { searchParams: Promise<{ open?: string }> }) {
  const { open } = await searchParams
  const supabase = await createClient()
  const [hyps, tags, base] = await Promise.all([
    supabase.from('hypotheses').select('*').order('created_at'),
    supabase.from('hypothesis_videos').select('hypothesis_id, video_id'),
    supabase.from('v_base_rate').select('*'),
  ])
  const all = (hyps.data ?? []) as Hyp[]
  const tagged = (tags.data ?? []) as { hypothesis_id: string; video_id: string }[]
  const ids = [...new Set(tagged.map((t) => t.video_id))]
  const top = ids.length ? ((await supabase.from('v_top_videos').select('*').in('video_id', ids)).data as Top[] | null) ?? [] : []
  const topById = new Map(top.map((t) => [t.video_id, t]))
  const p0 = Object.fromEntries((base.data as View<'v_base_rate'>[] | null ?? []).map((b) => [b.metric, b.n ? (b.hits ?? 0) / b.n : 0.25])) as Record<string, number>

  const rows = all.map((h, i) => {
    const m = h.metric as Metric
    const vids = tagged.filter((t) => t.hypothesis_id === h.id).map((t) => topById.get(t.video_id) ?? null)
    const mature = vids.filter((v): v is Top => v != null && v[`${m}_hit`] != null)
    const hits = mature.filter((v) => v[`${m}_hit`]).length
    const n = mature.length
    const tooNew = vids.filter((v) => v == null).length
    const base = p0[m] ?? 0.25
    const ev = evaluateHypothesis(hits, n, h.target_n, base, h.prior_hit_rate ?? base)
    const status = h.status === 'active' ? ev.status : h.status
    const labels = labelEntries(h.labels)
    const [color, verdict] =
      status === 'supported' ? (['green', 'Supported'] as const)
      : status === 'not_supported' ? (['red', 'Not supported'] as const)
      : status === 'abandoned' ? (['grey', 'Closed'] as const)
      : n < h.target_n ? (['grey', 'Collecting'] as const)
      : (['amber', ev.verdict] as const)
    return { h, i, name: `H-${String(i + 1).padStart(2, '0')}`, labels, vids: mature.sort((a, b) => a.posted_at!.localeCompare(b.posted_at!)), hits, n, tooNew, base, ev, status, color, verdict, m }
  })

  // Persist verdicts reached on this load (PRD §10: evaluated on every load).
  await Promise.all(rows.filter((r) => r.h.status === 'active' && r.status !== 'active').map((r) =>
    supabase.from('hypotheses').update({ status: r.status, closed_at: new Date().toISOString() }).eq('id', r.h.id)))

  const detail = rows.find((r) => r.h.id === open)

  return (
    <>
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-lg font-semibold">Hypotheses</h1>
          <div className="text-xs text-muted-foreground">Accepted suggestions. A hypothesis is judged on videos you tag after accepting it, once they are older than 7 days. Test videos give evidence, not proof.</div>
        </div>
        <NewHypothesis />
      </div>

      <div className="rounded-lg ring-1 ring-foreground/10">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>#</TableHead><TableHead>Combination</TableHead><TableHead>Kind</TableHead>
              <TableHead className="text-right">Prior hit rate</TableHead><TableHead className="text-right">Observed</TableHead>
              <TableHead className="w-[220px]">Progress</TableHead><TableHead>Verdict</TableHead><TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <ClickRow key={r.h.id} href={`/hypotheses?open=${r.h.id}`} className={r.status === 'active' ? '' : 'opacity-60'} data-state={open === r.h.id ? 'selected' : undefined}>
                <TableCell className="text-muted-foreground">{r.name}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {r.labels.map(([d, v], j) => (
                      <span key={d} className="contents">{j > 0 && <span className="text-muted-foreground">×</span>}<Chip>{d === 'hook_device' ? 'hook' : d}: {v}</Chip></span>
                    ))}
                  </div>
                  <div className="text-xs text-muted-foreground">accepted {fmtDate(r.h.created_at)} · {r.m}</div>
                </TableCell>
                <TableCell><Badge variant="secondary">{cap(humanise(r.h.kind))}</Badge></TableCell>
                <TableCell className="text-right tabular-nums">
                  {r.h.prior_hit_rate != null ? pct(r.h.prior_hit_rate) : '—'}{r.h.kind === 'untested_synergy' && <span className="text-muted-foreground"> predicted</span>}
                </TableCell>
                <TableCell className="text-right tabular-nums">{r.hits}/{r.n}</TableCell>
                <TableCell>
                  <Progress value={Math.min(100, (r.n / r.h.target_n) * 100)} className="gap-1 [&_[data-slot=progress-track]]:h-1.5" />
                  <span className="text-xs text-muted-foreground">{r.n} of {r.h.target_n} mature{r.tooNew > 0 && ` · ${r.tooNew} more posted, too new`}</span>
                </TableCell>
                <TableCell><Badge variant="outline"><Dot color={r.color} className="mr-1" />{r.verdict}</Badge></TableCell>
                <TableCell><Link href={`/hypotheses?open=${r.h.id}`} className="text-xs font-medium hover:underline">Open</Link></TableCell>
              </ClickRow>
            ))}
            {!rows.length && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">No hypotheses yet. Accept a suggestion on the dashboard or create one.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>

      {detail && (
        <Card className="max-w-[720px]">
          <CardHeader>
            <CardTitle>{detail.name} · {detail.labels.map(([, v]) => v).join(' × ')}</CardTitle>
            <CardDescription>
              {detail.verdict}. Prospective hit rate {detail.hits}/{detail.n} (posterior {pct(detail.ev.posterior.mean)}, interval {pct(detail.ev.posterior.lo)}–{pct(detail.ev.posterior.hi)}) against a {pct(detail.base)} base rate.
              {detail.ev.status === 'supported' && ' The lower bound clears the base rate, so this counts as evidence.'}
              {detail.ev.status === 'not_supported' && ' The upper bound sits below the prior, so the combination did not hold up.'}
              {` It is still ${detail.n} video${detail.n === 1 ? '' : 's'}.`}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {detail.vids.map((v) => (
              <div key={v.video_id} className="flex items-center gap-3 text-xs">
                <span className="w-12 text-muted-foreground">{fmtShortDate(v.posted_at!)}</span>
                <Link href={`/videos/${v.video_id}`} className="grow font-medium hover:underline">“{v.hook_text ?? 'Untitled reel'}”</Link>
                <span className="font-semibold tabular-nums">{ratio(v[`${detail.m}_log_ratio`])?.toFixed(1) ?? '—'}×</span>
                <Badge variant="outline" className="h-[18px] w-9 justify-center text-[10px]">{v[`${detail.m}_hit`] ? 'Hit' : '—'}</Badge>
              </div>
            ))}
            {!detail.vids.length && <div className="text-xs text-muted-foreground">No mature tagged videos yet{detail.tooNew > 0 && ` (${detail.tooNew} posted, too new)`}.</div>}
            <div className="mt-2 flex gap-2">
              <form action={extendTarget.bind(null, detail.h.id, detail.h.target_n)}><Button variant="outline" size="sm" type="submit">Extend target</Button></form>
              {detail.status !== 'abandoned' && <form action={closeHypothesis.bind(null, detail.h.id)}><Button variant="ghost" size="sm" type="submit">Close hypothesis</Button></form>}
            </div>
          </CardContent>
        </Card>
      )}
    </>
  )
}
