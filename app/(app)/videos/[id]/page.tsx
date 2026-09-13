import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/server'
import { AddToHypothesis, EditLabels, Embed, RefreshButton } from '@/components/video/client'
import { Chip, Dot, METRICS, cap, labelEntries, fmtDate, fmtNum, fmtRatio, timeAgo, type Row, type View } from '@/components/video/format'

const STEPS = ['metrics', 'transcribe', 'label'] as const
const hypName = (h: { labels: unknown }, i: number) =>
  `H-${String(i + 1).padStart(2, '0')} · ${labelEntries(h.labels).map(([, v]) => v).join(' × ')}`

export default async function VideoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const [video, metrics, transcript, labels, score, steps, tags, hyps] = await Promise.all([
    supabase.from('videos').select('*').eq('id', id).maybeSingle(),
    supabase.from('video_metrics').select('*').eq('video_id', id).maybeSingle(),
    supabase.from('transcripts').select('*').eq('video_id', id).maybeSingle(),
    supabase.from('script_labels').select('*').eq('video_id', id).order('codebook_version', { ascending: false }).limit(1),
    supabase.from('v_video_scores').select('*').eq('video_id', id).maybeSingle(),
    supabase.from('pipeline_steps').select('*').eq('video_id', id).order('finished_at', { ascending: false }),
    supabase.from('hypothesis_videos').select('hypothesis_id').eq('video_id', id),
    supabase.from('hypotheses').select('id, labels, status, created_at').order('created_at'),
  ])
  const v = video.data as Row<'videos'> | null
  if (!v) notFound()
  const m = metrics.data as Row<'video_metrics'> | null
  const t = transcript.data as Row<'transcripts'> | null
  const label = (labels.data?.[0] ?? null) as Row<'script_labels'> | null
  const s = score.data as View<'v_video_scores'> | null
  const latestStep = Object.fromEntries(STEPS.map((k) => [k, (steps.data as Row<'pipeline_steps'>[] | null)?.find((r) => r.step === k)])) as Record<(typeof STEPS)[number], Row<'pipeline_steps'> | undefined>
  const all = (hyps.data ?? []) as Pick<Row<'hypotheses'>, 'id' | 'labels' | 'status' | 'created_at'>[]
  const tagged = new Set((tags.data ?? []).map((r: { hypothesis_id: string }) => r.hypothesis_id))
  const named = all.map((h, i) => ({ ...h, name: hypName(h, i) }))
  const title = label?.hook_text ?? v.caption ?? 'Untitled reel'

  const stepNote = {
    metrics: m ? timeAgo(m.fetched_at) : 'not run',
    transcribe: t ? `${t.model ?? t.status} · ${fmtDate(t.created_at)}` : 'not run',
    label: label ? `${label.model?.split('-').slice(1, 2)[0] ?? 'model'} · v${label.codebook_version} · ${fmtDate(label.created_at)}` : 'not run',
  }
  const stepColor = (st?: string) => (st === 'done' ? 'green' : st === 'failed' ? 'red' : 'grey')

  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs text-muted-foreground"><Link href="/videos">Videos</Link> / {v.ig_media_id}</div>
          <h1 className="text-lg font-semibold">“{title}”</h1>
          <div className="text-xs text-muted-foreground">
            Posted {fmtDate(v.posted_at)}{v.duration_s != null && ` · ${Math.round(v.duration_s)} s`} ·{' '}
            <a href={v.permalink} target="_blank" rel="noreferrer" className="text-foreground underline-offset-2 hover:underline">open on Instagram</a>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline">{label ? `Labelled · codebook v${label.codebook_version}` : 'Not labelled'}</Badge>
          <RefreshButton videoId={id} />
        </div>
      </div>

      <div className="grid items-start gap-6 md:grid-cols-[360px_minmax(0,1fr)]">
        <div className="flex flex-col gap-4">
          <Embed permalink={v.permalink} />
          <Card>
            <CardHeader><CardTitle>Pipeline</CardTitle></CardHeader>
            <CardContent className="flex flex-col gap-2 text-xs">
              {STEPS.map((k) => (
                <div key={k} className="flex items-center justify-between">
                  <span className="flex items-center gap-2"><Dot color={stepColor(latestStep[k]?.status)} />{k}</span>
                  <span className="text-muted-foreground" title={latestStep[k]?.error ?? undefined}>
                    {latestStep[k]?.status === 'failed' ? `failed · ${latestStep[k]!.error ?? 'error'}` : stepNote[k]}
                  </span>
                </div>
              ))}
              <div className="text-muted-foreground">Refresh only re-fetches metrics. Transcript and labels are kept unless the codebook version changes.</div>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {METRICS.map((k) => (
              <Card key={k} size="sm">
                <CardContent className="flex flex-col">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{cap(k)}</span>
                    <Badge variant="outline" className="h-[18px] text-[10px]">{s?.[`${k}_hit`] ? 'Hit' : '—'}</Badge>
                  </div>
                  <div className="text-xl font-semibold tabular-nums">{fmtNum(m?.[k])}</div>
                  <div className="text-xs text-muted-foreground">{fmtRatio(s?.[`${k}_log_ratio`])}</div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Script labels</CardTitle>
              <CardDescription>Produced by Claude Haiku under codebook v{label?.codebook_version ?? '—'}. Edit if wrong; edits are kept separately from model output.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3.5">
              {label ? (
                <>
                  <Field name="Hook (verbatim)"><div className="text-sm font-medium">“{label.hook_text}”</div></Field>
                  <div className="grid gap-3.5 sm:grid-cols-2">
                    <Field name="Hook device"><div><Chip>{label.hook_device}</Chip></div></Field>
                    <Field name="Hook template"><div className="font-mono text-xs">{label.hook_template}</div></Field>
                    <Field name="Broad topic"><div><Chip>{label.broad_topic}</Chip></div></Field>
                    <Field name="Specific topic"><div>{label.specific_topic ?? '—'}</div></Field>
                  </div>
                  <Field name="Beats, in order">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {label.beats.map((b, i) => (
                        <span key={i} className="contents">{i > 0 && <span className="text-muted-foreground">→</span>}<Chip>{b}</Chip></span>
                      ))}
                    </div>
                  </Field>
                  <Field name="Notes"><div className="text-muted-foreground">{label.notes ?? '—'}</div></Field>
                  <EditLabels videoId={id} label={label} />
                </>
              ) : (
                <div className="text-muted-foreground">Not labelled yet.</div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="grid-cols-[1fr_auto]">
              <div>
                <CardTitle>Hypotheses</CardTitle>
                <CardDescription>Tag this reel as a test video for an active hypothesis.</CardDescription>
              </div>
              <AddToHypothesis videoId={id} options={named.filter((h) => h.status === 'active' && !tagged.has(h.id))} />
            </CardHeader>
            <CardContent className="flex flex-wrap items-center gap-2">
              {named.filter((h) => tagged.has(h.id)).map((h) => (
                <Link key={h.id} href={`/hypotheses?open=${h.id}`}><Badge variant="secondary">{h.name}</Badge></Link>
              ))}
              <span className="text-xs text-muted-foreground">{tagged.size ? 'counts once mature' : 'Not tagged to any hypothesis.'}</span>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Transcript</CardTitle>
              {t?.status === 'ok' && <CardDescription>{t.model ?? '—'} · {t.language ?? '—'} · {t.duration_s != null ? `${Math.round(t.duration_s)} s` : '—'}</CardDescription>}
            </CardHeader>
            <CardContent className="text-[13px] leading-relaxed">
              {t?.status === 'skipped_too_large' ? (
                <Alert>
                  <AlertTitle>Not transcribed: file too large</AlertTitle>
                  <AlertDescription>Whisper accepts uploads up to 25 MB and this reel&apos;s MP4 is bigger. It stays visible without a transcript or labels.</AlertDescription>
                </Alert>
              ) : t?.status === 'ok' ? t.text : (
                <span className="text-muted-foreground">{t?.status === 'failed' ? 'Transcription failed.' : 'Not transcribed yet'}</span>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  )
}

const Field = ({ name, children }: { name: string; children: React.ReactNode }) => (
  <div className="flex flex-col gap-1"><span className="text-xs text-muted-foreground">{name}</span>{children}</div>
)
