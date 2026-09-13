import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { createClient } from '@/lib/supabase/server'
import { cn } from '@/lib/utils'
import { fmtDate, fmtNum, ratio, type View } from '@/components/video/format'

const PAGE = 50
const SORTS = { posted: 'posted_at', views: 'views', saves: 'saves', ratio: 'views_log_ratio' } as const
type Sort = keyof typeof SORTS

export default async function VideosPage({ searchParams }: { searchParams: Promise<{ sort?: string; dir?: string; page?: string }> }) {
  const sp = await searchParams
  const sort: Sort = sp.sort && sp.sort in SORTS ? (sp.sort as Sort) : 'posted'
  const asc = sp.dir === 'asc'
  const page = Math.max(1, Number(sp.page) || 1)
  const supabase = await createClient()
  // ponytail: one query; the view joins metrics, latest label, transcript status and score.
  const { data, count } = await supabase
    .from('v_video_list')
    .select('*', { count: 'exact' })
    .order(SORTS[sort], { ascending: asc, nullsFirst: false })
    .order('posted_at', { ascending: false })
    .range((page - 1) * PAGE, page * PAGE - 1)
  const rows = (data ?? []) as View<'v_video_list'>[]
  const total = count ?? 0
  const pages = Math.max(1, Math.ceil(total / PAGE))
  const href = (q: Partial<{ sort: Sort; dir: string; page: number }>) => {
    const u = new URLSearchParams({ sort, dir: asc ? 'asc' : 'desc', page: String(page), ...Object.fromEntries(Object.entries(q).map(([k, v]) => [k, String(v)])) })
    return `/videos?${u}`
  }
  const status = (v: View<'v_video_list'>) =>
    v.codebook_version ? `Labelled v${v.codebook_version}` : v.transcript_status === 'ok' ? 'Transcribed' : v.transcript_status === 'skipped_too_large' ? 'Too large' : 'Pending'

  return (
    <>
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-lg font-semibold">Videos</h1>
          <div className="text-xs text-muted-foreground">{total} reels · page {page} of {pages}</div>
        </div>
        <div className="flex items-center gap-1 text-xs">
          {(Object.keys(SORTS) as Sort[]).map((k) => (
            <Link key={k} href={href({ sort: k, page: 1, dir: k === sort && !asc ? 'asc' : 'desc' })} className={cn('rounded-md px-2 py-1 text-muted-foreground', sort === k && 'bg-muted text-foreground')}>
              {k === 'ratio' ? 'vs baseline' : k[0].toUpperCase() + k.slice(1)}{sort === k ? (asc ? ' ↑' : ' ↓') : ''}
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
              const r = ratio(v.views_log_ratio)
              return (
                <TableRow key={v.id}>
                  <TableCell><div className="h-12 w-9 rounded bg-border" /></TableCell>
                  <TableCell>
                    <Link href={`/videos/${v.id}`} className="font-medium hover:underline">{v.hook_text ?? v.caption ?? 'Untitled reel'}</Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{fmtDate(v.posted_at)}</TableCell>
                  <TableCell><Badge variant="outline">{status(v)}</Badge></TableCell>
                  <TableCell className="text-right tabular-nums">{fmtNum(v.views)}</TableCell>
                  <TableCell className="text-right tabular-nums">{r == null ? <span className="text-muted-foreground">—</span> : `${r.toFixed(1)}×`}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmtNum(v.saves)}</TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{total === 0 ? '' : `${(page - 1) * PAGE + 1}–${Math.min(page * PAGE, total)} of ${total}`}</span>
        <div className="flex gap-2">
          <Link aria-disabled={page <= 1} href={href({ page: page - 1 })} className={cn(buttonVariants({ variant: 'outline' }), page <= 1 && 'pointer-events-none opacity-50')}>Previous</Link>
          <Link aria-disabled={page >= pages} href={href({ page: page + 1 })} className={cn(buttonVariants({ variant: 'outline' }), page >= pages && 'pointer-events-none opacity-50')}>Next</Link>
        </div>
      </div>
    </>
  )
}
