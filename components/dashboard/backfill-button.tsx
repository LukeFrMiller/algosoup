'use client'
import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { toast } from 'sonner'
import { RefreshCwIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { triggerBackfill } from '@/lib/pipeline/actions'

export function BackfillButton() {
  const router = useRouter()
  const [pending, start] = useTransition()
  return (
    <Button
      variant="outline"
      disabled={pending}
      onClick={() =>
        start(async () => {
          try {
            const { run_id } = await triggerBackfill()
            toast.success('Backfill started', { description: run_id })
            router.refresh()
          } catch (e) {
            toast.error('Backfill failed', { description: e instanceof Error ? e.message : String(e) })
          }
        })
      }
    >
      <RefreshCwIcon data-icon="inline-start" />
      Backfill
    </Button>
  )
}
