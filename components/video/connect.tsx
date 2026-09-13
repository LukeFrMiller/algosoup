'use client'
// Client islands for /connect.
import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Toaster } from '@/components/ui/sonner'

export { Toaster }

export function RefreshToken() {
  const router = useRouter()
  const [pending, start] = useTransition()
  const refresh = () =>
    start(async () => {
      const res = await fetch('/api/instagram/refresh', { method: 'POST' })
      const body = await res.json().catch(() => ({}))
      if (res.ok) { toast.success('Token refreshed'); router.refresh() }
      else toast.error(body.error ?? `Refresh failed (${res.status})`)
    })
  return <Button variant="outline" disabled={pending} onClick={refresh}>Refresh token now</Button>
}

export function Disconnect({ action }: { action: () => Promise<void> }) {
  return (
    <Dialog>
      <DialogTrigger render={<Button variant="ghost" className="text-destructive" />}>Disconnect</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Disconnect Instagram?</DialogTitle>
          <DialogDescription>The stored token is deleted. Your videos, transcripts and labels stay. Reconnect any time.</DialogDescription>
        </DialogHeader>
        <DialogFooter showCloseButton>
          <form action={action}><Button variant="destructive" type="submit">Disconnect</Button></form>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
