import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { createClient } from '@/lib/supabase/server'
import { cn } from '@/lib/utils'
import { fmtDate, fmtNum, ratio, type Row, type View } from '@/components/video/format'

const byId = <T extends { video_id: string | null }>(rows: T[] | null) =>
  new Map((rows ?? []).map((r) => [r.video_id, r]))

export default async function VideosPage({ searchParams }: { searchParams: Promise<{ sort?: string }> }) {
  const { sort = 'posted' } = await searchParams
  const supabase = await createClient()
  const [videos, metrics, labels, transcripts, scores] = await Promise.all([
    supabase.from('videos').select('id, caption, posted_at, thumbnail_url').order('posted_at', { ascending: false }),
    supabase.from('video_metrics').select('video_id, views, saves'),
    supabase.from('script_labels').select('video_id, hook_text, codebook_version').order('codebook_version'),
    supabase.from('transcripts').select('video_id, status'),
    supabase.from('v_video_scores').select('video_id, views_log_ratio'),
  ])
  const m = byId(metrics.data as Pick<Row<'video_metrics'>, 'video_id' | 'views' | 'saves'>[])
  const l = byId(labels.data as Pick<Row<'script_labels'>, 'video_id' | 'hook_text' | 'codebook_version'>[]) // last write wins = highest version
  const t = byId(transcripts.data as Pick<Row<'transcripts'>, 'video_id' | 'status'>[])
  const s = byId(scores.data as Pick<View<'v_video_scores'>, 'video_id' | 'views_log_ratio'>[])
  const rows = (videos.data ?? []) as Pick<Row<'videos'>, 'id' | 'caption' | 'posted_at' | 'thumbnail_url'>[]
  if (sort === 'views') rows.sort((a, b) => (m.get(b.id)?.views ?? 0) - (m.get(a.id)?.views ?? 0))

  const status = (id: string) => {
    const lab = l.get(id)
    if (lab) return `Labelled v${lab.codebook_version}`
    const st = t.get(id)?.status
    return st === 'ok' ? 'Transcribed' : st === 'skipped_too_large' ? 'Too large' : 'Pending'
  }

  return (
    <>
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-lg font-semibold">Videos</h1>
          <div className="text-xs text-muted-foreground">{rows.length} reels · newest first</div>
        </div>
        <div className="flex gap-1 text-xs">
          {(['posted', 'views'] as const).map((k) => (
            <Link key={k} href={`/videos?sort=${k}`} className={cn('rounded-md px-2 py-1 text-muted-foreground', sort === k && 'bg-muted text-foreground')}>
              Sort by {k}
            </Link>
          ))}
        </div>
      </div>
      <div className="rounded-lg ring-1 ring-foreground/10">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12" />
              <TableHead>Hook</TableHead>
              <TableHead>Posted</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Views</TableHead>
              <TableHead className="text-right">vs baseline</TableHead>
              <TableHead className="text-right">Saves</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((v) => {
              const r = ratio(s.get(v.id)?.views_log_ratio)
              return (
                <TableRow key={v.id}>
                  <TableCell><div className="h-12 w-9 rounded bg-border" /></TableCell>
                  <TableCell>
                    <Link href={`/videos/${v.id}`} className="font-medium hover:underline">
                      {l.get(v.id)?.hook_text ?? v.caption ?? 'Untitled reel'}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{fmtDate(v.posted_at)}</TableCell>
                  <TableCell><Badge variant="outline">{status(v.id)}</Badge></TableCell>
                  <TableCell className="text-right tabular-nums">{fmtNum(m.get(v.id)?.views)}</TableCell>
                  <TableCell className="text-right tabular-nums">{r == null ? <span className="text-muted-foreground">—</span> : `${r.toFixed(1)}×`}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmtNum(m.get(v.id)?.saves)}</TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </>
  )
}
