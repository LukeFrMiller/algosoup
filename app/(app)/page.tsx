// Dashboard. Server component: fetch once with the RLS client, compute stats for every metric, hand to the client for instant switching.
import { DashboardClient } from '@/components/dashboard/dashboard-client'
import { loadDashboard } from '@/lib/dashboard-data'
import { SuggestionCards } from '@/components/dashboard/suggestion-cards'
import { suggest, type Labels } from '@/lib/suggestions'
import { createClient } from '@/lib/supabase/server'

const DISMISS_DAYS = 30

export default async function Page() {
  const supabase = await createClient()
  const since = dismissedSince()
  const [{ data, settings, pairsFor, p0 }, hypQ] = await Promise.all([
    loadDashboard(supabase, ['views']),
    supabase.from('hypotheses').select('labels,status,created_at'),
  ])
  const hyps = (hypQ.data ?? []) as { labels: Labels; status: string; created_at: string }[]
  const views = data.views!
  const suggestions = suggest(
    pairsFor.views!,
    views.singles,
    hyps.filter((h) => h.status !== 'abandoned'),
    hyps.filter((h) => h.status === 'abandoned' && h.created_at > since),
    settings,
  )

  return (
    <>
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-lg leading-tight font-semibold">What to test next</h1>
          <div className="text-xs text-muted-foreground">Ranked by Thompson draw × coverage. These are hypotheses, not findings. Accepting one tracks it on the Hypotheses page.</div>
        </div>
      </div>
      <SuggestionCards suggestions={suggestions} />
      <DashboardClient initial={views} p0={p0} minSample={settings.min_sample} />
    </>
  )
}

const dismissedSince = () => new Date(Date.now() - DISMISS_DAYS * 864e5).toISOString()
