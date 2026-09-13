'use client'
// Metric/dimension switching is client-side: the server pre-computes every metric once per page load.
import Link from 'next/link'
import { useState } from 'react'
import { Explorer } from './explorer'
import { Heatmap } from './heatmap'
import { CHIP, compact, DIMENSIONS, METRICS, mult, pct, plain, shortDate } from './format'
import { Thumb } from '@/components/video/thumb'
import { captionTitle } from '@/components/video/format'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { Dimension, LabelStat, Metric, PairStat } from '@/lib/stats/types'

export type TopVideo = { video_id: string; permalink: string; thumbnail_url: string | null; caption: string | null; posted_at: string; hook_text: string | null; hook_device: string | null; value: number; log_ratio: number; saves: number }
export type PerMetric = {
  singles: LabelStat[]
  hookBeat: PairStat[]
  hooks: string[]
  beats: string[]
  top: TopVideo[]
  stats: [string, string, string][]
  screened: number
}
type Props = { data: Record<Metric, PerMetric>; p0: number; minSample: number }

function Pick<T extends string>({ value, options, onChange }: { value: T; options: Record<T, string>; onChange: (v: T) => void }) {
  return (
    <Select value={value} items={options} onValueChange={(v) => onChange(v as T)}>
      <SelectTrigger className="min-w-[150px] bg-background"><SelectValue /></SelectTrigger>
      <SelectContent>{(Object.entries(options) as [T, string][]).map(([k, label]) => <SelectItem key={k} value={k}>{label}</SelectItem>)}</SelectContent>
    </Select>
  )
}

export function DashboardClient({ data, p0, minSample }: Props) {
  const [metric, setMetric] = useState<Metric>('views')
  const [dim, setDim] = useState<Dimension>('hook_device')
  const d = data[metric]
  const byMean = (a: LabelStat, b: LabelStat) => b.posterior.mean - a.posterior.mean
  const explorerRows = d.singles.filter((s) => s.dimension === dim && s.value !== 'hook').sort(byMean)

  return (
    <>
      <div className="flex gap-4">
        {d.stats.map(([label, value, sub]) => (
          <Card key={label} className="flex-1 gap-0.5 px-4 py-3.5">
            <div className="text-xs text-muted-foreground">{label}</div>
            <div className="text-xl leading-tight font-semibold">{value}</div>
            <div className="text-xs text-muted-foreground">{sub}</div>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="flex items-start justify-between">
          <div>
            <CardTitle className="text-[13px] font-semibold">Hit rate by label</CardTitle>
            <CardDescription>Posterior mean with 90% interval. Bars under {minSample} videos are dimmed. Dashed line is the {pct(p0)} base rate.</CardDescription>
          </div>
          <div className="flex gap-2">
            <Pick value={dim} options={DIMENSIONS} onChange={setDim} />
            <Pick value={metric} options={METRICS} onChange={setMetric} />
          </div>
        </CardHeader>
        <CardContent><Explorer rows={explorerRows} p0={p0} minSample={minSample} /></CardContent>
      </Card>

      <Card>
        <CardHeader className="flex items-start justify-between">
          <div>
            <CardTitle className="text-[13px] font-semibold">Hook device × beat</CardTitle>
            <CardDescription>Colour is the posterior hit rate on {metric}, opacity is how many videos back it. Pale cells are coverage gaps. Click a cell to see its videos.</CardDescription>
          </div>
          <Pick value={metric} options={METRICS} onChange={setMetric} />
        </CardHeader>
        <CardContent>
          {d.hooks.length && d.beats.length ? (
            <Heatmap key={metric} hooks={d.hooks} beats={d.beats} pairs={d.hookBeat} metric={metric} minSample={minSample} screened={d.screened} />
          ) : (
            <p className="text-xs text-muted-foreground">No labelled reels yet. Run a backfill.</p>
          )}
        </CardContent>
      </Card>

      <Card className="pb-0">
        <CardHeader className="flex items-start justify-between">
          <div>
            <CardTitle className="text-[13px] font-semibold">Best performing reels</CardTitle>
            <CardDescription>By {metric} relative to the baseline at the time of posting. Read the hooks side by side.</CardDescription>
          </div>
          <div className="flex gap-2">
            <Pick value={metric} options={METRICS} onChange={setMetric} />
            <Link href="/videos" className={buttonVariants({ variant: 'outline' })}>All videos</Link>
          </div>
        </CardHeader>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8">#</TableHead>
              <TableHead>Hook</TableHead>
              <TableHead>Device</TableHead>
              <TableHead className="text-right">{METRICS[metric]}</TableHead>
              <TableHead className="text-right">vs baseline</TableHead>
              {metric !== 'saves' && <TableHead className="text-right">Saves</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {d.top.map((v, i) => (
              <TableRow key={v.video_id}>
                <TableCell className="text-right text-muted-foreground tabular-nums">{i + 1}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2.5">
                    <Link href={`/videos/${v.video_id}`}><Thumb src={v.thumbnail_url} /></Link>
                    <div className="min-w-0">
                      <Link href={`/videos/${v.video_id}`} className="block max-w-[520px] truncate font-medium hover:underline">{v.hook_text ? `“${v.hook_text}”` : (captionTitle(v.caption) || 'No speech, no caption')}</Link>
                      <div className="text-xs text-muted-foreground">
                        {shortDate(v.posted_at)} ·{' '}
                        <a href={v.permalink} target="_blank" rel="noreferrer" className="hover:text-foreground">open on Instagram</a>
                      </div>
                    </div>
                  </div>
                </TableCell>
                <TableCell>{v.hook_device && <span className={CHIP}>{v.hook_device}</span>}</TableCell>
                <TableCell className="text-right tabular-nums">{compact(v.value)}</TableCell>
                <TableCell className="text-right font-semibold tabular-nums">{mult(v.log_ratio)}</TableCell>
                {metric !== 'saves' && <TableCell className="text-right tabular-nums">{plain(v.saves)}</TableCell>}
              </TableRow>
            ))}
            {!d.top.length && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">No baselined reels yet.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Card>
    </>
  )
}
