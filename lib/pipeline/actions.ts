'use server'
// Contract between package D (pipeline) and packages G/H (UI).
import { inngest } from '@/inngest/client'
import { CODEBOOK_VERSION } from '@/lib/labeler/codebook'
import { createClient } from '@/lib/supabase/server'

// Runs as the signed-in user; RLS scopes pipeline_runs/videos/script_labels to the owner.
async function ownerDb() {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  const ownerId = data?.claims?.sub
  if (!ownerId) throw new Error('unauthorized')
  return { supabase, ownerId }
}

/** The most recent run still in progress (started in the last 2h), if any. */
export async function activeRun(): Promise<{ run_id: string } | null> {
  const { supabase } = await ownerDb()
  const since = new Date(Date.now() - 2 * 3600e3).toISOString()
  const { data } = await supabase.from('pipeline_runs').select('id').eq('status', 'running').gt('started_at', since).order('started_at', { ascending: false }).limit(1).maybeSingle()
  return data ? { run_id: data.id } : null
}

/** Starts a backfill, or returns the one already running so the UI attaches to it instead of double-queuing. */
export async function triggerBackfill(): Promise<{ run_id: string; attached: boolean }> {
  const existing = await activeRun()
  if (existing) return { ...existing, attached: true }
  const { supabase, ownerId } = await ownerDb()
  const { data, error } = await supabase.from('pipeline_runs').insert({ owner_id: ownerId, kind: 'backfill' }).select('id').single()
  if (error) throw error
  await inngest.send({ name: 'backfill.requested', data: { owner_id: ownerId, run_id: data.id } })
  return { run_id: data.id, attached: false }
}

/** Re-runs every video that has a failed step in `runId`, as a new run. */
export async function retryFailed(runId: string): Promise<{ run_id: string; count: number }> {
  const { supabase, ownerId } = await ownerDb()
  const { data: steps, error: e1 } = await supabase.from('pipeline_steps').select('video_id').eq('run_id', runId).eq('status', 'failed')
  if (e1) throw e1
  const ids = [...new Set((steps ?? []).map((s) => s.video_id))]
  if (!ids.length) throw new Error('nothing to retry')
  const { data: labelled, error: e2 } = await supabase.from('script_labels').select('video_id').in('video_id', ids).eq('codebook_version', CODEBOOK_VERSION)
  if (e2) throw e2
  const has = new Set((labelled ?? []).map((l) => l.video_id))
  const { data: run, error: e3 } = await supabase.from('pipeline_runs').insert({ owner_id: ownerId, kind: 'backfill', total: ids.length }).select('id').single()
  if (e3) throw e3
  await inngest.send(ids.map((video_id) => ({ name: 'video.process' as const, data: { owner_id: ownerId, run_id: run.id, video_id, mode: has.has(video_id) ? 'metrics_only' : 'full' } })))
  return { run_id: run.id, count: ids.length }
}

export async function triggerVideoRefresh(videoId: string): Promise<{ run_id: string }> {
  const { supabase, ownerId } = await ownerDb()
  const { data: label, error: labelErr } = await supabase
    .from('script_labels')
    .select('id')
    .eq('video_id', videoId)
    .eq('codebook_version', CODEBOOK_VERSION)
    .maybeSingle()
  if (labelErr) throw labelErr
  const { data, error } = await supabase
    .from('pipeline_runs')
    .insert({ owner_id: ownerId, kind: 'refresh_video', total: 1 })
    .select('id')
    .single()
  if (error) throw error
  await inngest.send({
    name: 'video.process',
    data: { owner_id: ownerId, run_id: data.id, video_id: videoId, mode: label ? 'metrics_only' : 'full' },
  })
  return { run_id: data.id }
}
