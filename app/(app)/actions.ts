'use server'
// Dashboard server actions (package G).
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { Metric, Suggestion } from '@/lib/stats/types'
import type { Labels } from '@/lib/suggestions'
import { loadDashboard } from '@/lib/dashboard-data'
import type { PerMetric } from '@/components/dashboard/dashboard-client'

const owner = async (supabase: Awaited<ReturnType<typeof createClient>>) => {
  const { data } = await supabase.auth.getClaims()
  const id = data?.claims.sub
  if (!id) throw new Error('not signed in')
  return id
}

const labelsOf = (s: Pick<Suggestion, 'pair'>): Labels => ({ [s.pair.a.dimension]: s.pair.a.value, [s.pair.b.dimension]: s.pair.b.value })

export async function acceptSuggestion(s: Suggestion) {
  const supabase = await createClient()
  const { error } = await supabase.from('hypotheses').insert({
    owner_id: await owner(supabase),
    kind: s.kind,
    labels: labelsOf(s),
    metric: s.pair.metric,
    rationale: s.rationale,
    prior_hit_rate: s.predicted ?? s.pair.posterior.mean,
    target_n: s.target_n,
    status: 'active',
  })
  if (error) throw new Error(error.message)
  revalidatePath('/')
}

// ponytail: no dismissed table — an 'abandoned' hypothesis row is the dismissal; suggest() excludes it for 30 days.
export async function dismissSuggestion(s: Suggestion) {
  const supabase = await createClient()
  const { error } = await supabase.from('hypotheses').insert({
    owner_id: await owner(supabase),
    kind: s.kind,
    labels: labelsOf(s),
    metric: s.pair.metric,
    rationale: 'dismissed',
    target_n: s.target_n,
    status: 'abandoned',
    closed_at: new Date().toISOString(),
  })
  if (error) throw new Error(error.message)
  revalidatePath('/')
}

export type CellVideo = { video_id: string; permalink: string; thumbnail_url: string | null; hook_text: string | null; posted_at: string; value: number; log_ratio: number | null; hit: boolean | null }

export async function cellVideos(hook: string, beat: string, metric: Metric): Promise<CellVideo[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('v_top_videos')
    .select(`video_id,permalink,thumbnail_url,hook_text,posted_at,value:${metric},log_ratio:${metric}_log_ratio,hit:${metric}_hit,script_labels!inner(beats)`)
    .eq('hook_device', hook)
    .contains('script_labels.beats', [beat])
    .not(`${metric}_log_ratio`, 'is', null)
    .order(`${metric}_log_ratio`, { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as unknown as CellVideo[]
}

/** Lazy dashboard data for one metric; the page ships only `views` to keep first load small. */
export async function metricData(metric: Metric): Promise<PerMetric> {
  const supabase = await createClient()
  const { data } = await loadDashboard(supabase, [metric])
  return data[metric]!
}
