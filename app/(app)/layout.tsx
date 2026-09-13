import { Nav } from '@/components/app-shell/nav'
import { BackfillButton } from '@/components/dashboard/backfill-button'
import { relative } from '@/components/dashboard/format'
import { Toaster } from '@/components/ui/sonner'
import { createClient } from '@/lib/supabase/server'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const [account, run] = await Promise.all([
    supabase.from('instagram_accounts').select('username').maybeSingle(),
    supabase.from('pipeline_runs').select('id,status,started_at,finished_at').order('started_at', { ascending: false }).limit(1).maybeSingle(),
  ])
  return (
    <>
      <Nav
        status={`${account.data ? `@${account.data.username}` : 'no account'} · last refreshed ${relative(run.data?.finished_at)}`}
        action={<BackfillButton activeRunId={run.data?.status === 'running' && Date.parse(run.data.started_at) > Date.now() - 2 * 3600e3 ? run.data.id : null} />}
      />
      <main className="mx-auto flex max-w-[1440px] flex-col gap-6 p-6">{children}</main>
      <Toaster />
    </>
  )
}
