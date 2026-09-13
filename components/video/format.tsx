// ponytail: tiny formatters + two presentational bits shared by package H pages. Fixed locale so SSR output is stable.
import type { Database } from '@/lib/db/types'
import { cn } from '@/lib/utils'

export type Row<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row']
export type View<T extends keyof Database['public']['Views']> = Database['public']['Views'][T]['Row']
export type Metric = 'views' | 'saves' | 'shares' | 'engagement'
export const METRICS: Metric[] = ['views', 'saves', 'shares', 'engagement']

export const fmtNum = (n: number | null | undefined) => (n == null ? '—' : n.toLocaleString('en-US'))
export const fmtDate = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'
export const fmtShortDate = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
export const fmtDateTime = (d: string | null | undefined) =>
  d ? `${fmtDate(d)}, ${new Date(d).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}` : '—'
export const timeAgo = (d: string) => {
  const m = Math.max(0, Math.round((Date.now() - new Date(d).getTime()) / 60000))
  if (m < 60) return `${m}m ago`
  if (m < 60 * 24) return `${Math.round(m / 60)}h ago`
  return `${Math.round(m / 1440)}d ago`
}
export const ratio = (logRatio: number | null | undefined) => (logRatio == null ? null : Math.exp(logRatio))
export const fmtRatio = (logRatio: number | null | undefined) => {
  const r = ratio(logRatio)
  return r == null ? 'no baseline' : `${r.toFixed(1)}× baseline`
}
export const pct = (p: number) => `${Math.round(p * 100)}%`
// jsonb returns keys length-sorted ("beat" before "hook_device"); show hook first.
export const labelEntries = (labels: unknown) =>
  Object.entries(labels as Record<string, string>).sort(([a], [b]) => (a === 'hook_device' ? -1 : b === 'hook_device' ? 1 : a.localeCompare(b)))
export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

export const DOT = { green: '#0ca30c', amber: '#fab219', grey: '#898781', red: '#d03b3b' } as const

export function Chip({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cn('inline-flex h-[22px] items-center rounded-md bg-muted px-2 font-mono text-xs font-medium', className)}>
      {children}
    </span>
  )
}

export function Dot({ color, className }: { color: keyof typeof DOT; className?: string }) {
  return <span className={cn('inline-block size-2 shrink-0 rounded-full', className)} style={{ background: DOT[color] }} />
}
