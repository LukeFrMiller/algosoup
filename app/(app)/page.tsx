// Dashboard (package G). Server component: fetch with the RLS client, compute stats with lib/stats + lib/suggestions.
import { Explorer } from '@/components/dashboard/explorer'
import { Heatmap } from '@/components/dashboard/heatmap'
import { ParamSelect } from '@/components/dashboard/param-select'
import { SuggestionCards } from '@/components/dashboard/suggestion-cards'
import { asDimension, asMetric, CHIP, compact, DIMENSIONS, METRICS, mult, pct, plain, shortDate } from '@/components/dashboard/format'
import { Thumb } from '@/components/video/thumb'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { labelStats, multipleComparisons, pairStats, type BaseRateRow, type DimensionCountRow, type PairCountRow } from '@/lib/stats'
import type { Settings } from '@/lib/stats/types'
import { suggest, type Labels } from '@/lib/suggestions'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

// Column order in the mockup; unknown beats go after.
const BEAT_ORDER = ['context', 'problem', 'counter_positioning', 'proof', 'steps', 'example', 'payoff', 'cta', 'aside']
const DISMISS_DAYS = 30

type TopVideo = { video_id: string; permalink: string; thumbnail_url: string | null; posted_at: string; hook_text: string | null; hook_device: string | null; value: number; log_ratio: number; saves: number }

export default async function Page({ searchParams }: { searchParams: Promise<{ dim?: string; metric?: string }> }) {
  const sp = await searchParams
  const metric = asMetric(sp.metric)
  const dim = asDimension(sp.dim)
  const supabase = await createClient()
  const since = dismissedSince()

  const [settingsQ, baseQ, dimsQ, pairsQ, scoresQ, topQ, hypQ, videoCountQ] = await Promise.all([
    supabase.from('settings').select('maturity_days,min_sample,baseline_window,hit_quantile').eq('id', 1).maybeSingle(),
    supabase.from('v_base_rate').select('*'),
    supabase.from('v_dimension_counts').select('*').eq('metric', metric),
    supabase.from('v_pair_counts').select('*').eq('metric', metric),
    supabase.from('v_video_scores').select(`log_ratio:${metric}_log_ratio,baseline:${metric}_baseline,saves_baseline,shares_baseline,posted_at`).order('posted_at', { ascending: false }),
    supabase.from('v_top_videos').select(`video_id,permalink,thumbnail_url,posted_at,hook_text,hook_device,value:${metric},log_ratio:${metric}_log_ratio,saves`).not(`${metric}_log_ratio`, 'is', null).order(`${metric}_log_ratio`, { ascending: false }).limit(10),
    supabase.from('hypotheses').select('labels,status,created_at'),
    supabase.from('videos').select('*', { count: 'exact', head: true }),
  ])
  const settings: Settings = settingsQ.data ?? { maturity_days: 7, min_sample: 5, baseline_window: 20, hit_quantile: 0.75 }
  const base = (baseQ.data ?? []) as BaseRateRow[]
  const singles = labelStats((dimsQ.data ?? []) as DimensionCountRow[], base)
  const pairs = pairStats((pairsQ.data ?? []) as PairCountRow[], base)
  const scores = (scoresQ.data ?? []) as unknown as { log_ratio: number | null; baseline: number | null; saves_baseline: number | null; shares_baseline: number | null }[]
  const top = (topQ.data ?? []) as unknown as TopVideo[]
  const hyps = (hypQ.data ?? []) as { labels: Labels; status: string; created_at: string }[]

  // Stat row
  const ratios = scores.map((s) => s.log_ratio).filter((r): r is number => r != null).sort((a, b) => a - b)
  const analysed = ratios.length
  const immature = (videoCountQ.count ?? 0) - scores.length
  const noBaseline = scores.length - analysed
  const latest = scores.find((s) => s.baseline != null) // baseline = median of the previous 20 for the newest baselined reel
  const threshold = analysed ? Math.exp(ratios[Math.ceil(settings.hit_quantile * (analysed - 1))]) : null
  const baseRate = base.find((b) => b.metric === metric)
  const screened = pairs.filter((p) => p.n > 0).length
  const mc = multipleComparisons(screened)
  const p0 = 1 - settings.hit_quantile

  // Suggestions: active hypotheses are excluded, abandoned ones (= dismissed) for 30 days.
  const suggestions = suggest(
    pairs,
    singles,
    hyps.filter((h) => h.status !== 'abandoned'), // active + judged: never re-suggest a tested pair
    hyps.filter((h) => h.status === 'abandoned' && h.created_at > since),
    settings,
  )

  // Explorer + heatmap. The 'hook' beat is on every video, so it carries no signal.
  const byMean = (a: { posterior: { mean: number } }, b: { posterior: { mean: number } }) => b.posterior.mean - a.posterior.mean
  const explorerRows = singles.filter((s) => s.dimension === dim && s.value !== 'hook').sort(byMean)
  const hooks = singles.filter((s) => s.dimension === 'hook_device').sort(byMean).map((s) => s.value)
  const beats = singles.filter((s) => s.dimension === 'beat' && s.value !== 'hook').map((s) => s.value)
    .sort((a, b) => (BEAT_ORDER.indexOf(a) + 1 || 99) - (BEAT_ORDER.indexOf(b) + 1 || 99) || a.localeCompare(b))
  const hookBeat = pairs.filter((p) => p.a.dimension === 'hook_device' && p.b.dimension === 'beat')

  const stats: [string, string, string][] = [
    ['Reels analysed', plain(analysed), `${immature + noBaseline} excluded: ${immature} under ${settings.maturity_days} days, ${noBaseline} without baseline`],
    [`Baseline (median of last ${settings.baseline_window})`, latest?.baseline != null ? `${compact(latest.baseline)} ${metric}` : '—', `saves ${compact(latest?.saves_baseline)} · shares ${compact(latest?.shares_baseline)}`],
    ['Hit threshold', threshold ? `≥ ${threshold.toFixed(1)}× baseline` : '—', `top ${Math.round((1 - settings.hit_quantile) * 100)}% of log ratio`],
    ['Base hit rate', baseRate ? pct(baseRate.hits / baseRate.n) : pct(p0), baseRate ? `${baseRate.hits}/${baseRate.n} · by construction` : 'by construction'],
    ['Combinations screened', plain(mc.screened), `~${mc.expectedFalsePositives} will look good by chance`],
  ]

  return (
    <>
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-lg leading-tight font-semibold">What to test next</h1>
          <div className="text-xs text-muted-foreground">Ranked by Thompson draw × coverage. These are hypotheses, not findings. Accepting one tracks it on the Hypotheses page.</div>
        </div>
      </div>

      <SuggestionCards suggestions={suggestions} />

      <div className="flex gap-4">
        {stats.map(([label, value, sub]) => (
          <Card key={label} className="flex-1 gap-0.5 px-4 py-3.5">
            <div className="text-xs text-muted-foreground">{label}</div>
            <div className="text-xl leading-tight font-semibold">{value}</div>
            <div className="text-xs text-muted-foreground">{sub}</div>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="flex items-start justify-between">
          <div>
            <CardTitle className="text-[13px] font-semibold">Hit rate by label</CardTitle>
            <CardDescription>Posterior mean with 90% interval. Bars under {settings.min_sample} videos are dimmed. Dashed line is the {pct(p0)} base rate.</CardDescription>
          </div>
          <div className="flex gap-2">
            <ParamSelect name="dim" value={dim} options={DIMENSIONS} />
            <ParamSelect name="metric" value={metric} options={METRICS} />
          </div>
        </CardHeader>
        <CardContent>
          <Explorer rows={explorerRows} p0={p0} minSample={settings.min_sample} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex items-start justify-between">
          <div>
            <CardTitle className="text-[13px] font-semibold">Hook device × beat</CardTitle>
            <CardDescription>Colour is the posterior hit rate on {metric}, opacity is how many videos back it. Pale cells are coverage gaps. Click a cell to see its videos.</CardDescription>
          </div>
          <ParamSelect name="metric" value={metric} options={METRICS} />
        </CardHeader>
        <CardContent>
          {hooks.length && beats.length ? (
            <Heatmap hooks={hooks} beats={beats} pairs={hookBeat} metric={metric} minSample={settings.min_sample} screened={screened} />
          ) : (
            <p className="text-xs text-muted-foreground">No labelled reels yet. Run a backfill.</p>
          )}
        </CardContent>
      </Card>

      <Card className="pb-0">
        <CardHeader className="flex items-start justify-between">
          <div>
            <CardTitle className="text-[13px] font-semibold">Best performing reels</CardTitle>
            <CardDescription>By {metric} relative to the baseline at the time of posting. Read the hooks side by side.</CardDescription>
          </div>
          <div className="flex gap-2">
            <ParamSelect name="metric" value={metric} options={METRICS} />
            <Link href="/videos" className={buttonVariants({ variant: 'outline' })}>All videos</Link>
          </div>
        </CardHeader>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8">#</TableHead>
              <TableHead>Hook</TableHead>
              <TableHead>Device</TableHead>
              <TableHead className="text-right">{METRICS[metric]}</TableHead>
              <TableHead className="text-right">vs baseline</TableHead>
              {metric !== 'saves' && <TableHead className="text-right">Saves</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {top.map((v, i) => (
              <TableRow key={v.video_id}>
                <TableCell className="text-right text-muted-foreground tabular-nums">{i + 1}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2.5">
                    <Link href={`/videos/${v.video_id}`}><Thumb src={v.thumbnail_url} /></Link>
                    <div className="min-w-0">
                      <Link href={`/videos/${v.video_id}`} className="block max-w-[520px] truncate font-medium hover:underline">“{v.hook_text ?? 'untitled'}”</Link>
                      <div className="text-xs text-muted-foreground">
                        {shortDate(v.posted_at)} ·{' '}
                        <a href={v.permalink} target="_blank" rel="noreferrer" className="hover:text-foreground">open on Instagram</a>
                      </div>
                    </div>
                  </div>
                </TableCell>
                <TableCell>{v.hook_device && <span className={CHIP}>{v.hook_device}</span>}</TableCell>
                <TableCell className="text-right tabular-nums">{compact(v.value)}</TableCell>
                <TableCell className="text-right font-semibold tabular-nums">{mult(v.log_ratio)}</TableCell>
                {metric !== 'saves' && <TableCell className="text-right tabular-nums">{plain(v.saves)}</TableCell>}
              </TableRow>
            ))}
            {!top.length && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">No baselined reels yet.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </>
  )
}

const dismissedSince = () => new Date(Date.now() - DISMISS_DAYS * 864e5).toISOString()
