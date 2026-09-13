'use client'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { RefreshCwIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Progress } from '@/components/ui/progress'
import { triggerBackfill } from '@/lib/pipeline/actions'
import { getRunStatus, type RunStatus } from '@/lib/pipeline/status'

export function BackfillButton({ activeRunId }: { activeRunId?: string | null }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [runId, setRunId] = useState<string | null>(null)
  const [run, setRun] = useState<RunStatus | null>(null)
  const running = !!activeRunId && !runId

  useEffect(() => {
    if (!runId) return
    let stop = false
    const tick = async () => {
      const s = await getRunStatus(runId).catch(() => null)
      if (stop) return
      if (s) setRun(s)
      if (s && s.status !== 'running') { router.refresh(); return }
      setTimeout(tick, 3000)
    }
    tick()
    return () => { stop = true }
  }, [runId, router])

  const onClick = () => {
    if (activeRunId) return setRunId(activeRunId)
    start(async () => {
      try {
        const { run_id } = await triggerBackfill()
        setRunId(run_id)
      } catch (e) {
        toast.error('Backfill failed to start', { description: e instanceof Error ? e.message : String(e) })
      }
    })
  }

  const close = () => { setRunId(null); setRun(null); router.refresh() }
  const pct = run && run.total > 0 ? Math.round(((run.done + run.failed) / run.total) * 100) : 0
  const finished = run?.status !== 'running'

  return (
    <>
      <Button variant="outline" disabled={pending} onClick={onClick}>
        <RefreshCwIcon data-icon="inline-start" className={running ? 'animate-spin' : ''} />
        {running ? 'Backfill running' : 'Backfill'}
      </Button>
      <Dialog open={!!runId} onOpenChange={(o) => { if (!o) close() }}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>{!run ? 'Starting backfill' : finished ? 'Backfill finished' : 'Backfill running'}</DialogTitle>
            <DialogDescription>
              {run ? `Started ${new Date(run.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}. ` : ''}
              Each reel is its own job and goes metrics → transcribe → label. A reel counts as done once it has been through all three.
            </DialogDescription>
          </DialogHeader>
          {run && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Progress value={pct} />
                <div className="flex justify-between text-xs text-muted-foreground tabular-nums">
                  <span>{run.total === 0 ? 'Listing reels…' : `${run.done + run.failed} of ${run.total} reels fully processed`}</span>
                  <span>{run.failed} failed</span>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <Stat label="Metrics" s={run.steps.metrics} total={run.total} />
                <Stat label="Transcribe" s={run.steps.transcribe} total={run.total} />
                <Stat label="Label" s={run.steps.label} total={run.total} />
              </div>
              {run.failures.length > 0 && (
                <div className="flex flex-col gap-1.5 text-xs">
                  {run.failures.map((f) => (
                    <div key={f.video_id + f.step} className="flex justify-between gap-3">
                      <span className="flex items-center gap-2 truncate"><span className="size-2 shrink-0 rounded-full bg-[#d03b3b]" />{f.label} · {f.step}</span>
                      <span className="shrink-0 text-muted-foreground truncate max-w-[240px]">{f.error}</span>
                    </div>
                  ))}
                  {run.failed > run.failures.length && <div className="text-muted-foreground">…and {run.failed - run.failures.length} more. Click Backfill again later to retry.</div>}
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={close}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

function Stat({ label, s, total }: { label: string; s: { done: number; skipped: number; failed: number }; total: number }) {
  const left = Math.max(0, total - s.done - s.skipped - s.failed)
  return (
    <div className="rounded-lg border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold tabular-nums">{s.done} <span className="text-xs font-normal text-muted-foreground">done</span></div>
      <div className="text-xs text-muted-foreground tabular-nums">{s.skipped} skipped · {s.failed} failed · {left} to go</div>
    </div>
  )
}
