'use server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function extendTarget(id: string, current: number) {
  const supabase = await createClient()
  const { error } = await supabase.from('hypotheses').update({ target_n: current + 2, status: 'active', closed_at: null }).eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/hypotheses')
}

export async function closeHypothesis(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('hypotheses').update({ status: 'abandoned', closed_at: new Date().toISOString() }).eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/hypotheses')
}

export async function createHypothesis(formData: FormData) {
  const hook_device = String(formData.get('hook_device') ?? '')
  const beat = String(formData.get('beat') ?? '')
  const metric = String(formData.get('metric') ?? 'views')
  const target_n = Math.max(1, Number(formData.get('target_n')) || 6)
  if (!hook_device || !beat) throw new Error('Pick a hook device and a beat')

  const supabase = await createClient()
  const [{ data: claims }, pair, base] = await Promise.all([
    supabase.auth.getClaims(),
    supabase.from('v_pair_counts').select('n, hits').match({ dim_a: 'hook_device', val_a: hook_device, dim_b: 'beat', val_b: beat, metric }).maybeSingle(),
    supabase.from('v_base_rate').select('n, hits').eq('metric', metric).maybeSingle(),
  ])
  const rate = (r: { n: number | null; hits: number | null } | null) => (r?.n ? (r.hits ?? 0) / r.n : null)
  const prior_hit_rate = rate(pair.data) ?? rate(base.data) ?? 0.25

  const { data, error } = await supabase
    .from('hypotheses')
    .insert({ owner_id: String(claims?.claims.sub), kind: 'confirmation', labels: { hook_device, beat }, metric, target_n, prior_hit_rate,
      rationale: `Manually created: ${hook_device} hooks with ${beat} beats on ${metric}.` })
    .select('id')
    .single()
  if (error) throw new Error(error.message)
  revalidatePath('/hypotheses')
  redirect(`/hypotheses?open=${data.id}`)
}
