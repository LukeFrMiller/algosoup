'use client'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { TableBody, TableCell, TableRow } from '@/components/ui/table'
import { BEATS, HOOK_DEVICES } from '@/lib/labeler/types'
import { METRICS } from '@/components/video/format'
import { createHypothesis } from '@/app/(app)/hypotheses/actions'

type HypRow = { id: string; muted: boolean; cells: React.ReactNode; detail: React.ReactNode }

// Rows and their detail cards are server-rendered; which one is open is client state (no round trip).
export function HypRows({ rows, initialOpen, empty }: { rows: HypRow[]; initialOpen: string | null; empty: string }) {
  const [open, setOpen] = useState<string | null>(initialOpen)
  const toggle = (id: string) => {
    const next = open === id ? null : id
    setOpen(next)
    window.history.replaceState(null, '', next ? `/hypotheses?open=${next}` : '/hypotheses')
  }
  const current = rows.find((r) => r.id === open)
  return (
    <>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={r.id} onClick={() => toggle(r.id)} data-state={open === r.id ? 'selected' : undefined} className={`cursor-pointer ${r.muted ? 'opacity-60' : ''}`}>
            {r.cells}
            <TableCell><span className="text-xs font-medium">{open === r.id ? 'Close' : 'Open'}</span></TableCell>
          </TableRow>
        ))}
        {!rows.length && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">{empty}</TableCell></TableRow>}
      </TableBody>
      {current && <DetailSlot>{current.detail}</DetailSlot>}
    </>
  )
}

// The detail card must render outside the <table>; a portal target keeps the markup valid.
function DetailSlot({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => { const t = setTimeout(() => setMounted(true), 0); return () => clearTimeout(t) }, [])
  const el = mounted ? document.getElementById('hyp-detail') : null
  return el ? createPortal(children, el) : null
}

const Pick = ({ name, label, options, defaultValue }: { name: string; label: string; options: readonly string[]; defaultValue?: string }) => (
  <div className="grid gap-1">
    <Label>{label}</Label>
    <Select name={name} defaultValue={defaultValue ?? null} required>
      <SelectTrigger className="w-full"><SelectValue placeholder={`Pick a ${label.toLowerCase()}`} /></SelectTrigger>
      <SelectContent>{options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
    </Select>
  </div>
)

export function NewHypothesis() {
  const [open, setOpen] = useState(false)
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" />}>New hypothesis</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New hypothesis</DialogTitle>
          <DialogDescription>Pick a hook device × beat combination to track. Videos you tag after this count once mature.</DialogDescription>
        </DialogHeader>
        <form action={createHypothesis} className="grid gap-3">
          <Pick name="hook_device" label="Hook device" options={HOOK_DEVICES} />
          <Pick name="beat" label="Beat" options={BEATS.filter((b) => b !== 'hook')} />
          <Pick name="metric" label="Metric" options={METRICS} defaultValue="views" />
          <div className="grid gap-1"><Label htmlFor="target_n">Target videos</Label><Input id="target_n" name="target_n" type="number" min={1} defaultValue={6} /></div>
          <DialogFooter><Button type="submit">Create</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
