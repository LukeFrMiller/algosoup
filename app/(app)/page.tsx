// Dashboard. Server component: fetch once with the RLS client, compute stats for every metric, hand to the client for instant switching.
import { DashboardClient, type PerMetric, type TopVideo } from '@/components/dashboard/dashboard-client'
import { SuggestionCards } from '@/components/dashboard/suggestion-cards'
import { compact, METRICS, pct, plain } from '@/components/dashboard/format'
import { labelStats, multipleComparisons, pairStats, type BaseRateRow, type DimensionCountRow, type PairCountRow } from '@/lib/stats'
import type { Metric, Settings } from '@/lib/stats/types'
import { suggest, type Labels } from '@/lib/suggestions'
import { createClient } from '@/lib/supabase/server'

const BEAT_ORDER = ['context', 'problem', 'counter_positioning', 'proof', 'steps', 'example', 'payoff', 'cta', 'aside']
const DISMISS_DAYS = 30
const ALL = Object.keys(METRICS) as Metric[]

type Score = { posted_at: string; views_log_ratio: number | null; saves_log_ratio: number | null; shares_log_ratio: number | null; engagement_log_ratio: number | null; views_baseline: number | null; saves_baseline: number | null; shares_baseline: number | null; engagement_baseline: number | null }
type TopRow = { video_id: string; permalink: string; thumbnail_url: string | null; caption: string | null; posted_at: string; hook_text: string | null; hook_device: string | null; saves: number | null } & Score & Record<Metric, number | null>

export default async function Page() {
  const supabase = await createClient()
  const since = dismissedSince()

  const [settingsQ, baseQ, dimsQ, pairsQ, scoresQ, topQ, hypQ, videoCountQ] = await Promise.all([
    supabase.from('settings').select('maturity_days,min_sample,baseline_window,hit_quantile').eq('id', 1).maybeSingle(),
    supabase.from('v_base_rate').select('*'),
    supabase.from('v_dimension_counts').select('*'),
    supabase.from('v_pair_counts').select('*'),
    supabase.from('v_video_scores').select('posted_at,views_log_ratio,saves_log_ratio,shares_log_ratio,engagement_log_ratio,views_baseline,saves_baseline,shares_baseline,engagement_baseline').order('posted_at', { ascending: false }),
    // ponytail: top 10 per metric from one fetch of every scored reel (≤ a few thousand rows).
    supabase.from('v_top_videos').select('video_id,permalink,thumbnail_url,caption,posted_at,hook_text,hook_device,saves,views,shares,engagement,views_log_ratio,saves_log_ratio,shares_log_ratio,engagement_log_ratio'),
    supabase.from('hypotheses').select('labels,status,created_at'),
    supabase.from('videos').select('*', { count: 'exact', head: true }),
  ])
  const settings: Settings = settingsQ.data ?? { maturity_days: 7, min_sample: 5, baseline_window: 20, hit_quantile: 0.75 }
  const base = (baseQ.data ?? []) as BaseRateRow[]
  const dims = (dimsQ.data ?? []) as DimensionCountRow[]
  const pairRows = (pairsQ.data ?? []) as PairCountRow[]
  const scores = (scoresQ.data ?? []) as Score[]
  const topRows = (topQ.data ?? []) as unknown as TopRow[]
  const hyps = (hypQ.data ?? []) as { labels: Labels; status: string; created_at: string }[]
  const p0 = 1 - settings.hit_quantile
  const immature = (videoCountQ.count ?? 0) - scores.length
  const byMean = (a: { posterior: { mean: number } }, b: { posterior: { mean: number } }) => b.posterior.mean - a.posterior.mean

  const perMetric = (metric: Metric): PerMetric => {
    const singles = labelStats(dims.filter((r) => r.metric === metric), base)
    const pairs = pairStats(pairRows.filter((r) => r.metric === metric), base)
    const ratios = scores.map((s) => s[`${metric}_log_ratio`]).filter((r): r is number => r != null).sort((a, b) => a - b)
    const analysed = ratios.length
    const noBaseline = scores.length - analysed
    const latest = scores.find((s) => s[`${metric}_baseline`] != null)
    const threshold = analysed ? Math.exp(ratios[Math.ceil(settings.hit_quantile * (analysed - 1))]) : null
    const baseRate = base.find((b) => b.metric === metric)
    const screened = pairs.filter((p) => p.n > 0).length
    const mc = multipleComparisons(screened)
    const top: TopVideo[] = topRows
      .filter((r) => r[`${metric}_log_ratio`] != null)
      .sort((a, b) => (b[`${metric}_log_ratio`] ?? 0) - (a[`${metric}_log_ratio`] ?? 0))
      .slice(0, 10)
      .map((r) => ({ video_id: r.video_id, permalink: r.permalink, thumbnail_url: r.thumbnail_url, caption: r.caption, posted_at: r.posted_at, hook_text: r.hook_text, hook_device: r.hook_device, value: r[metric] ?? 0, log_ratio: r[`${metric}_log_ratio`] ?? 0, saves: r.saves ?? 0 }))
    return {
      singles,
      hookBeat: pairs.filter((p) => p.a.dimension === 'hook_device' && p.b.dimension === 'beat'),
      hooks: singles.filter((s) => s.dimension === 'hook_device').sort(byMean).map((s) => s.value),
      beats: singles.filter((s) => s.dimension === 'beat' && s.value !== 'hook').map((s) => s.value)
        .sort((a, b) => (BEAT_ORDER.indexOf(a) + 1 || 99) - (BEAT_ORDER.indexOf(b) + 1 || 99) || a.localeCompare(b)),
      top,
      screened,
      stats: [
        ['Reels analysed', plain(analysed), `${immature + noBaseline} excluded: ${immature} under ${settings.maturity_days} days, ${noBaseline} without baseline`],
        [`Baseline (median of last ${settings.baseline_window})`, latest ? `${compact(latest[`${metric}_baseline`])} ${metric}` : '—', `saves ${compact(latest?.saves_baseline)} · shares ${compact(latest?.shares_baseline)}`],
        ['Hit threshold', threshold ? `≥ ${threshold.toFixed(1)}× baseline` : '—', `top ${Math.round((1 - settings.hit_quantile) * 100)}% of log ratio`],
        ['Base hit rate', baseRate ? pct(baseRate.hits / baseRate.n) : pct(p0), baseRate ? `${baseRate.hits}/${baseRate.n} · by construction` : 'by construction'],
        ['Combinations screened', plain(mc.screened), `~${mc.expectedFalsePositives} will look good by chance`],
      ],
    }
  }
  const data = Object.fromEntries(ALL.map((m) => [m, perMetric(m)])) as Record<Metric, PerMetric>

  // Suggestions are ranked on views. Active + judged hypotheses are excluded; dismissed ones for 30 days.
  const views = data.views
  const suggestions = suggest(
    pairStats(pairRows.filter((r) => r.metric === 'views'), base),
    views.singles,
    hyps.filter((h) => h.status !== 'abandoned'),
    hyps.filter((h) => h.status === 'abandoned' && h.created_at > since),
    settings,
  )

  return (
    <>
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-lg leading-tight font-semibold">What to test next</h1>
          <div className="text-xs text-muted-foreground">Ranked by Thompson draw × coverage. These are hypotheses, not findings. Accepting one tracks it on the Hypotheses page.</div>
        </div>
      </div>
      <SuggestionCards suggestions={suggestions} />
      <DashboardClient data={data} p0={p0} minSample={settings.min_sample} />
    </>
  )
}

const dismissedSince = () => new Date(Date.now() - DISMISS_DAYS * 864e5).toISOString()
