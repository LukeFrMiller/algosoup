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

export async function triggerBackfill(): Promise<{ run_id: string }> {
  const { supabase, ownerId } = await ownerDb()
  const { data, error } = await supabase.from('pipeline_runs').insert({ owner_id: ownerId, kind: 'backfill' }).select('id').single()
  if (error) throw error
  await inngest.send({ name: 'backfill.requested', data: { owner_id: ownerId, run_id: data.id } })
  return { run_id: data.id }
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
