'use client'
// Client islands for /videos/[id]. ponytail: one file, no Toaster in the app layout yet so each page mounts its own.
import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Script from 'next/script'
import { RefreshCwIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Toaster } from '@/components/ui/sonner'
import { triggerVideoRefresh } from '@/lib/pipeline/actions'
import { BEATS, HOOK_DEVICES } from '@/lib/labeler/types'
import { addToHypothesis, relabel, updateLabels } from '@/app/(app)/videos/[id]/actions'

export { Toaster }

declare global {
  interface Window { instgrm?: { Embeds: { process(): void } } }
}

export function Embed({ permalink }: { permalink: string }) {
  useEffect(() => window.instgrm?.Embeds.process(), [permalink])
  return (
    <>
      <blockquote
        className="instagram-media flex h-[640px] w-[360px] items-center justify-center rounded-lg bg-muted text-xs text-muted-foreground ring-1 ring-foreground/10"
        data-instgrm-permalink={permalink}
        data-instgrm-version="14"
        style={{ margin: 0, minWidth: 0 }}
      >
        Loading Instagram embed…
      </blockquote>
      <Script src="https://www.instagram.com/embed.js" strategy="afterInteractive" onLoad={() => window.instgrm?.Embeds.process()} />
    </>
  )
}

const run = async (fn: () => Promise<unknown>, ok: string, router: ReturnType<typeof useRouter>) => {
  try { await fn(); toast.success(ok); router.refresh() } catch (e) { toast.error(e instanceof Error ? e.message : String(e)) }
}

export function RefreshButton({ videoId }: { videoId: string }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  return (
    <Button variant="outline" disabled={pending} onClick={() => start(() => run(() => triggerVideoRefresh(videoId), 'Refresh queued', router))}>
      <RefreshCwIcon data-icon="inline-start" /> Refresh metrics
    </Button>
  )
}

export function EditLabels({ videoId, label }: { videoId: string; label: { codebook_version: number; hook_device: string; beats: string[]; broad_topic: string; specific_topic: string | null; notes: string | null } }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, start] = useTransition()
  const beats = BEATS.join(', ')
  return (
    <div className="flex gap-2">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger render={<Button variant="outline" size="sm" />}>Edit labels</DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit labels</DialogTitle>
            <DialogDescription>Edits overwrite the model output for codebook v{label.codebook_version}.</DialogDescription>
          </DialogHeader>
          <form
            className="grid gap-3"
            action={(fd) => start(() => run(() => updateLabels(videoId, fd), 'Labels saved', router).then(() => setOpen(false)))}
          >
            <input type="hidden" name="codebook_version" value={label.codebook_version} />
            <div className="grid gap-1">
              <Label>Hook device</Label>
              <Select name="hook_device" defaultValue={label.hook_device}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>{HOOK_DEVICES.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid gap-1">
              <Label htmlFor="beats">Beats, comma-separated</Label>
              <Input id="beats" name="beats" defaultValue={label.beats.join(', ')} required />
              <span className="text-[10px] text-muted-foreground">{beats}</span>
            </div>
            <div className="grid gap-1"><Label htmlFor="broad_topic">Broad topic</Label><Input id="broad_topic" name="broad_topic" defaultValue={label.broad_topic} required /></div>
            <div className="grid gap-1"><Label htmlFor="specific_topic">Specific topic</Label><Input id="specific_topic" name="specific_topic" defaultValue={label.specific_topic ?? ''} /></div>
            <div className="grid gap-1"><Label htmlFor="notes">Notes</Label><Input id="notes" name="notes" defaultValue={label.notes ?? ''} /></div>
            <DialogFooter><Button type="submit" disabled={pending}>Save</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <Button variant="ghost" size="sm" disabled={pending} onClick={() => start(() => run(() => relabel(videoId), 'Label removed, re-label queued', router))}>
        Re-label with current codebook
      </Button>
    </div>
  )
}

export function AddToHypothesis({ videoId, options }: { videoId: string; options: { id: string; name: string }[] }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  return (
    <Select
      value={null}
      disabled={pending || !options.length}
      onValueChange={(id) => id && start(() => run(() => addToHypothesis(videoId, id), 'Tagged', router))}
    >
      <SelectTrigger className="min-w-[150px]"><SelectValue placeholder="Add to hypothesis">Add to hypothesis</SelectValue></SelectTrigger>
      <SelectContent align="end">{options.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}</SelectContent>
    </Select>
  )
}
