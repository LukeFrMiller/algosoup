'use server'
import { createClient } from '@/lib/supabase/server'

export type RunStatus = {
  id: string
  kind: string
  status: string
  total: number
  done: number
  failed: number
  started_at: string
  finished_at: string | null
  steps: Record<'metrics' | 'transcribe' | 'label', { done: number; skipped: number; failed: number }>
  failures: { video_id: string; step: string; error: string | null; label: string }[]
}

// ponytail: counts in JS; a run is ≤ ~2k step rows.
export async function getRunStatus(runId: string): Promise<RunStatus | null> {
  const supabase = await createClient()
  const [runQ, stepsQ] = await Promise.all([
    supabase.from('pipeline_runs').select('id,kind,status,total,done,failed,started_at,finished_at').eq('id', runId).maybeSingle(),
    supabase.from('pipeline_steps').select('video_id,step,status,error,videos(caption,permalink)').eq('run_id', runId),
  ])
  if (!runQ.data) return null
  const steps = { metrics: { done: 0, skipped: 0, failed: 0 }, transcribe: { done: 0, skipped: 0, failed: 0 }, label: { done: 0, skipped: 0, failed: 0 } }
  const failures: RunStatus['failures'] = []
  for (const r of stepsQ.data ?? []) {
    const s = steps[r.step as keyof typeof steps]
    if (s) s[r.status as 'done' | 'skipped' | 'failed']++
    if (r.status === 'failed' && failures.length < 200) {
      const v = r.videos as unknown as { caption: string | null; permalink: string } | null
      failures.push({ video_id: r.video_id, step: r.step, error: r.error, label: v?.caption?.slice(0, 60) || v?.permalink || r.video_id })
    }
  }
  return { ...runQ.data, steps, failures }
}
