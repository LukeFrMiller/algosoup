import { CODEBOOK_VERSION, SYSTEM_PROMPT, codebookDefinition } from '@/lib/labeler/codebook'
import { labelTranscript } from '@/lib/labeler/index'
import type { Json } from '@/lib/db/types'
import { getIgClient } from '@/lib/pipeline/ig'
import { transcribeUrl } from '@/lib/pipeline/transcribe'
import { inngest, serviceDb, type BackfillRequested, type VideoProcess } from './client'

type StepName = 'metrics' | 'transcribe' | 'label'
type StepStatus = 'done' | 'skipped'

// Throw on PostgREST error. `opt` allows a null row (maybeSingle); `must` does not.
const opt = <T>({ data, error }: { data: T; error: unknown }): T => {
  if (error) throw error instanceof Error ? error : new Error(JSON.stringify(error))
  return data
}
const must = <T>(r: { data: T; error: unknown }): NonNullable<T> => {
  const d = opt(r)
  if (d == null) throw new Error('row not found')
  return d
}

// ---------------------------------------------------------------------------
// backfill: coordinator. One run, fan out one video.process per reel.
// ---------------------------------------------------------------------------
export const backfill = inngest.createFunction(
  { id: 'backfill', triggers: [{ event: 'backfill.requested' }], retries: 3 },
  async ({ event, step }) => {
    const { owner_id, run_id } = event.data as BackfillRequested

    await step.run('codebook', async () => {
      // Migration inserted a placeholder prompt; make the row match the code.
      opt(
        await serviceDb()
          .from('codebooks')
          .upsert({ version: CODEBOOK_VERSION, system_prompt: SYSTEM_PROMPT, definition: codebookDefinition as Json }),
      )
    })

    // ponytail: token refresh + listReels in one step. IgClient isn't serializable, so a separate
    // "get client" step would just re-run getOwnerClient here anyway.
    const videoIds = await step.run('reels', async () => {
      const db = serviceDb()
      const ig = await getIgClient(db, owner_id)
      const reels = await ig.listReels()
      if (reels.length === 0) return [] as string[]
      const rows = must(
        await db
          .from('videos')
          .upsert(reels.map((r) => ({ ...r, owner_id })), { onConflict: 'ig_media_id' })
          .select('id'),
      )
      return rows.map((r) => r.id)
    })

    const events = await step.run('split', async () => {
      const db = serviceDb()
      const labeled = new Set(
        must(await db.from('script_labels').select('video_id').eq('owner_id', owner_id).eq('codebook_version', CODEBOOK_VERSION)).map(
          (r) => r.video_id,
        ),
      )
      const total = videoIds.length
      opt(
        await db
          .from('pipeline_runs')
          .update(total === 0 ? { total, status: 'finished', finished_at: new Date().toISOString() } : { total })
          .eq('id', run_id),
      )
      return videoIds.map((video_id) => ({
        name: 'video.process' as const,
        data: { owner_id, run_id, video_id, mode: labeled.has(video_id) ? 'metrics_only' : 'full' } satisfies VideoProcess,
      }))
    })

    if (events.length) await step.sendEvent('fan-out', events)
    return { total: events.length }
  },
)

// ---------------------------------------------------------------------------
// process-video: metrics → transcribe → label. Each step idempotent; each records a pipeline_steps row.
// ---------------------------------------------------------------------------
export const processVideo = inngest.createFunction(
  {
    id: 'process-video',
    triggers: [{ event: 'video.process' }],
    concurrency: { limit: 5, key: 'event.data.owner_id' },
    retries: 3,
  },
  async ({ event, step }) => {
    const { owner_id, run_id, video_id, mode } = event.data as VideoProcess

    const recordStep = (db: ReturnType<typeof serviceDb>, name: StepName, status: StepStatus | 'failed', error?: string) =>
      db.from('pipeline_steps').insert({ run_id, video_id, owner_id, step: name, status, error: error ?? null }).then(opt)

    // Runs `body` as a durable step and records its outcome. Inngest retries the step on throw;
    // once retries are exhausted the StepError lands here and we record `failed`. Returns false on failure.
    const run = async (name: StepName, body: (db: ReturnType<typeof serviceDb>) => Promise<StepStatus>) => {
      try {
        await step.run(name, async () => {
          const db = serviceDb()
          const status = await body(db)
          await recordStep(db, name, status)
          return status
        })
        return true
      } catch (e) {
        await step.run(`${name}-failed`, async () => {
          const db = serviceDb()
          await recordStep(db, name, 'failed', String((e as Error)?.message ?? e))
          if (name === 'transcribe') await db.from('transcripts').upsert({ video_id, owner_id, status: 'failed' })
        })
        return false
      }
    }

    const ok =
      (await run('metrics', async (db) => {
        const { ig_media_id } = must(await db.from('videos').select('ig_media_id').eq('id', video_id).single())
        const ig = await getIgClient(db, owner_id)
        const m = await ig.getInsights(ig_media_id)
        const fetched_at = new Date().toISOString()
        opt(await db.from('video_metrics').upsert({ video_id, owner_id, ...m, fetched_at }))
        opt(await db.from('video_metric_snapshots').insert({ video_id, owner_id, ...m, fetched_at }))
        return 'done'
      })) &&
      (await run('transcribe', async (db) => {
        if (mode === 'metrics_only') return 'skipped'
        const existing = opt(await db.from('transcripts').select('status').eq('video_id', video_id).maybeSingle())
        if (existing?.status === 'ok') return 'skipped'
        const { ig_media_id } = must(await db.from('videos').select('ig_media_id').eq('id', video_id).single())
        const ig = await getIgClient(db, owner_id)
        // Signed URL is short-lived: fetch + transcribe inside this same step.
        const t = await transcribeUrl(await ig.getMediaUrl(ig_media_id))
        opt(
          await db.from('transcripts').upsert(
            t.status === 'ok'
              ? { video_id, owner_id, status: 'ok', text: t.text, language: t.language, model: t.model, duration_s: t.duration_s }
              : { video_id, owner_id, status: 'skipped_too_large', text: null, language: null, model: null, duration_s: null },
          ),
        )
        if (t.status === 'ok' && t.duration_s != null) opt(await db.from('videos').update({ duration_s: t.duration_s }).eq('id', video_id))
        return 'done'
      })) &&
      (await run('label', async (db) => {
        const existing = opt(
          await db.from('script_labels').select('id').eq('video_id', video_id).eq('codebook_version', CODEBOOK_VERSION).maybeSingle(),
        )
        if (existing) return 'skipped'
        const t = opt(await db.from('transcripts').select('status,text').eq('video_id', video_id).maybeSingle())
        if (t?.status !== 'ok' || !t.text) return 'skipped'
        const { label, codebook_version, model, raw } = await labelTranscript(t.text)
        opt(await db.from('script_labels').insert({ video_id, owner_id, codebook_version, model, raw: raw as Json, ...label }))
        return 'done'
      }))

    await step.run('finalize', async () => {
      const db = serviceDb()
      // A video is complete when it has a `label` row (always last) or any failed row.
      const rows = must(await db.from('pipeline_steps').select('video_id,step,status').eq('run_id', run_id))
      const failedIds = new Set(rows.filter((r) => r.status === 'failed').map((r) => r.video_id))
      const doneIds = new Set(rows.filter((r) => r.step === 'label' && !failedIds.has(r.video_id)).map((r) => r.video_id))
      const { total } = must(await db.from('pipeline_runs').select('total').eq('id', run_id).single())
      const done = doneIds.size, failed = failedIds.size
      const finished = done + failed >= total
      // ponytail: no atomic increment via PostgREST; counts are recomputed and the filter makes
      // the write monotonic, so a stale concurrent writer can't overwrite a fresher count.
      opt(
        await db
          .from('pipeline_runs')
          .update({ done, failed, ...(finished ? { status: 'finished', finished_at: new Date().toISOString() } : {}) })
          .eq('id', run_id)
          .or(`done.lt.${done},failed.lt.${failed}`),
      )
      return { done, failed, total }
    })

    return { ok }
  },
)
