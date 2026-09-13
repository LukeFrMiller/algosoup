'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { TableRow } from '@/components/ui/table'
import { BEATS, HOOK_DEVICES } from '@/lib/labeler/types'
import { METRICS } from '@/components/video/format'
import { createHypothesis } from '@/app/(app)/hypotheses/actions'

export function ClickRow({ href, ...props }: React.ComponentProps<typeof TableRow> & { href: string }) {
  const router = useRouter()
  return <TableRow {...props} className={`cursor-pointer ${props.className ?? ''}`} onClick={() => router.push(href)} />
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
