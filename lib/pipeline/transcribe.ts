import { env } from '@/lib/env'
import { IG_MOCK, MOCK_TRANSCRIPT } from './ig'

export const MAX_BYTES = 25 * 1024 * 1024 // Whisper cap

export type Transcription =
  | { status: 'ok'; text: string; language: string | null; duration_s: number | null; model: string }
  | { status: 'skipped_too_large' }

/** Download the media URL and POST it to the OpenAI-compatible /audio/transcriptions endpoint. */
export async function transcribeUrl(mediaUrl: string): Promise<Transcription> {
  const res = await fetch(mediaUrl)
  if (!res.ok) throw new Error(`media fetch ${res.status}`)
  const len = Number(res.headers.get('content-length'))
  if (len > MAX_BYTES) return { status: 'skipped_too_large' }
  const bytes = await res.arrayBuffer()
  if (bytes.byteLength > MAX_BYTES) return { status: 'skipped_too_large' }

  const model = env('WHISPER_MODEL')
  if (IG_MOCK) return { status: 'ok', text: MOCK_TRANSCRIPT, language: 'en', duration_s: 31, model: 'mock' }

  const form = new FormData()
  form.append('file', new Blob([bytes], { type: res.headers.get('content-type') ?? 'video/mp4' }), 'reel.mp4')
  form.append('model', model)
  form.append('response_format', 'verbose_json')
  form.append('language', 'en') // reels are English; auto-detect mislabels some as Russian
  const w = await fetch(`${env('WHISPER_BASE_URL')}/audio/transcriptions`, {
    method: 'POST',
    headers: { authorization: `Bearer ${env('WHISPER_API_KEY')}` },
    body: form,
  })
  const body = await w.json().catch(() => ({}))
  if (!w.ok) throw new Error(`whisper ${w.status}: ${JSON.stringify(body).slice(0, 500)}`)
  return {
    status: 'ok',
    text: String(body.text ?? '').trim(),
    language: body.language ?? null,
    duration_s: typeof body.duration === 'number' ? body.duration : null,
    model,
  }
}
