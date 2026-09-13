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
    supabase.from('pipeline_steps').select('video_id,step,status,error,finished_at,videos(caption,permalink)').eq('run_id', runId),
  ])
  if (!runQ.data) return null
  const run = { ...runQ.data }
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
  // Recount from step rows (the run row is updated by each job's finalize step, which may never run if
  // the job runner stops), and mark a run finished when every reel has an outcome or nothing has moved in 10 min.
  const byVideo = new Map<string, { failed: boolean; labelled: boolean }>()
  let last = 0
  for (const r of stepsQ.data ?? []) {
    const v = byVideo.get(r.video_id) ?? { failed: false, labelled: false }
    if (r.status === 'failed') v.failed = true
    if (r.step === 'label' && r.status !== 'failed') v.labelled = true
    byVideo.set(r.video_id, v)
    last = Math.max(last, Date.parse(r.finished_at))
  }
  run.failed = [...byVideo.values()].filter((v) => v.failed).length
  run.done = [...byVideo.values()].filter((v) => v.labelled && !v.failed).length
  const stalled = run.status === 'running' && run.total > 0 && Date.now() - Math.max(last, Date.parse(run.started_at)) > 10 * 60e3
  if (run.status === 'running' && (run.done + run.failed >= run.total || stalled)) {
    run.status = 'finished'
    run.finished_at = new Date().toISOString()
    await supabase.from('pipeline_runs').update({ status: 'finished', finished_at: run.finished_at, done: run.done, failed: run.failed }).eq('id', runId)
  }
  return { ...run, steps, failures }
}
