'use server'
import { revalidatePath } from 'next/cache'
import { triggerVideoRefresh } from '@/lib/pipeline/actions'
import { createClient } from '@/lib/supabase/server'

const str = (fd: FormData, k: string) => String(fd.get(k) ?? '').trim()

export async function updateLabels(videoId: string, formData: FormData) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('script_labels')
    .update({
      hook_device: str(formData, 'hook_device'),
      beats: str(formData, 'beats').split(',').map((b) => b.trim()).filter(Boolean),
      broad_topic: str(formData, 'broad_topic'),
      specific_topic: str(formData, 'specific_topic') || null,
      notes: str(formData, 'notes') || null,
    })
    .eq('video_id', videoId)
    .eq('codebook_version', Number(formData.get('codebook_version')))
  if (error) throw new Error(error.message)
  revalidatePath(`/videos/${videoId}`)
}

// Drop the label row so the next pipeline run re-labels under the current codebook.
export async function relabel(videoId: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('script_labels').delete().eq('video_id', videoId)
  if (error) throw new Error(error.message)
  revalidatePath(`/videos/${videoId}`)
  return triggerVideoRefresh(videoId)
}

export async function addToHypothesis(videoId: string, hypothesisId: string) {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  const { error } = await supabase
    .from('hypothesis_videos')
    .insert({ hypothesis_id: hypothesisId, video_id: videoId, owner_id: String(data?.claims.sub) })
  if (error) throw new Error(error.message)
  revalidatePath(`/videos/${videoId}`)
}
