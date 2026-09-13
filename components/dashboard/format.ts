// Formatting helpers for the dashboard. Numbers as in the mockup: 61.2K, 2,140, 2.3×, Aug 2, 2h ago.
import type { Dimension, Metric } from '@/lib/stats/types'

const compactFmt = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 })
const dateFmt = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' })

export const compact = (n: number | null | undefined) => (n == null ? '—' : compactFmt.format(Math.round(n)))
export const plain = (n: number | null | undefined) => (n == null ? '—' : n.toLocaleString('en'))
export const pct = (p: number) => `${Math.round(p * 100)}%`
export const mult = (logRatio: number | null | undefined) => (logRatio == null ? '—' : `${Math.exp(logRatio).toFixed(1)}×`)
export const shortDate = (iso: string) => dateFmt.format(new Date(iso))

export const relative = (iso: string | null | undefined) => {
  if (!iso) return 'never'
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000))
  if (m < 60) return `${m}m ago`
  if (m < 60 * 24) return `${Math.round(m / 60)}h ago`
  return `${Math.round(m / 1440)}d ago`
}

export const METRICS: Record<Metric, string> = { views: 'Views', saves: 'Saves', shares: 'Shares', engagement: 'Engagement' }
export const DIMENSIONS: Record<Dimension, string> = {
  hook_device: 'Hook device',
  beat: 'Beat',
  broad_topic: 'Broad topic',
  hook_template: 'Hook template',
}
export const asMetric = (v: unknown): Metric => (typeof v === 'string' && v in METRICS ? (v as Metric) : 'views')
export const asDimension = (v: unknown): Dimension => (typeof v === 'string' && v in DIMENSIONS ? (v as Dimension) : 'hook_device')

// Chip label prefix: "hook: bold_claim", "beat: proof".
const SHORT: Record<string, string> = { hook_device: 'hook', beat: 'beat', broad_topic: 'topic', hook_template: 'template' }
export const chipText = (l: { dimension: string; value: string }) => `${SHORT[l.dimension] ?? l.dimension}: ${l.value}`
export const CHIP = 'inline-flex h-[22px] items-center rounded-md bg-muted px-2 font-mono text-xs font-medium'
export const THUMB = 'h-12 w-9 shrink-0 rounded bg-border'
