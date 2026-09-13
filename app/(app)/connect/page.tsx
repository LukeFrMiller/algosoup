import { revalidatePath } from 'next/cache'
import { InfoIcon } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/server'
import { Disconnect, RefreshToken } from '@/components/video/connect'
import { Chip, Dot, fmtDate, fmtDateTime, fmtNum, type Row } from '@/components/video/format'

const ERRORS: Record<string, string> = {
  denied: 'You cancelled the Instagram authorisation.',
  state: 'The sign-in link expired or was tampered with. Try again.',
  exchange: 'Instagram rejected the authorisation code. Try again.',
  store: 'Connected to Instagram but the token could not be saved.',
}

export default async function ConnectPage({ searchParams }: { searchParams: Promise<{ connected?: string; error?: string }> }) {
  const { connected, error } = await searchParams
  const supabase = await createClient()
  const { data } = await supabase.from('instagram_accounts').select('username, followers_count, token_expires_at, token_refreshed_at, connected_at').limit(1).maybeSingle()
  const acct = data as Pick<Row<'instagram_accounts'>, 'username' | 'followers_count' | 'token_expires_at' | 'token_refreshed_at' | 'connected_at'> | null

  async function disconnect() {
    'use server'
    const supabase = await createClient()
    const { data } = await supabase.auth.getClaims()
    const { error } = await supabase.from('instagram_accounts').delete().eq('owner_id', String(data?.claims.sub))
    if (error) throw new Error(error.message)
    revalidatePath('/connect')
  }

  const now = Date.now() // eslint-disable-line react-hooks/purity -- server component, rendered per request
  const daysLeft = acct ? Math.ceil((new Date(acct.token_expires_at).getTime() - now) / 86_400_000) : 0
  const healthy = daysLeft >= 14

  return (
    <div className="flex max-w-[720px] flex-col gap-6">
      <div>
        <h1 className="text-lg font-semibold">Connect Instagram</h1>
        <div className="text-xs text-muted-foreground">AlgoSoup reads your reels and their insights. It never posts, comments, or stores video files.</div>
      </div>

      {connected && <Alert><AlertTitle>Instagram connected</AlertTitle><AlertDescription>Run a backfill from the dashboard to pull your reels.</AlertDescription></Alert>}
      {error && <Alert variant="destructive"><AlertTitle>Connection failed</AlertTitle><AlertDescription>{ERRORS[error] ?? `Unexpected error (${error}).`}</AlertDescription></Alert>}

      {acct ? (
        <Card>
          <CardHeader className="grid-cols-[1fr_auto]">
            <div>
              <CardTitle>@{acct.username}</CardTitle>
              <CardDescription>Professional account · {fmtNum(acct.followers_count)} followers · connected {fmtDate(acct.connected_at)}</CardDescription>
            </div>
            <Badge variant="outline"><Dot color={healthy ? 'green' : 'amber'} className="mr-1" />{healthy ? 'Token healthy' : 'Token expiring soon'}</Badge>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <Stat name="Token expires">{fmtDate(acct.token_expires_at)} <span className="text-muted-foreground">({daysLeft} days)</span></Stat>
              <Stat name="Last refreshed">{fmtDateTime(acct.token_refreshed_at)}</Stat>
              <Stat name="Auto-refresh">before every backfill, once under 14 days left</Stat>
            </div>
            <div className="flex items-center gap-2">
              <RefreshToken />
              <Button variant="ghost" render={<a href="/api/instagram/connect" />}>Reconnect</Button>
              <span className="grow" />
              <Disconnect action={disconnect} />
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>No account connected</CardTitle>
            <CardDescription>You need a Professional (Business or Creator) Instagram account. You will be sent to Instagram to approve two permissions.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-2 text-xs">
              <div className="flex items-center gap-2.5"><Chip>instagram_business_basic</Chip><span className="text-muted-foreground">profile and media list</span></div>
              <div className="flex items-center gap-2.5"><Chip>instagram_business_manage_insights</Chip><span className="text-muted-foreground">views, saves, shares, likes, comments, reach</span></div>
            </div>
            <div><Button size="lg" render={<a href="/api/instagram/connect" />}>Continue with Instagram</Button></div>
            <div className="flex items-start gap-2 rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
              <InfoIcon className="mt-0.5 size-3.5 shrink-0" />
              <span>Instagram redirects to the production URL. Local development reads the stored token from the hosted database.</span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

const Stat = ({ name, children }: { name: string; children: React.ReactNode }) => (
  <div className="flex flex-col gap-0.5"><span className="text-xs text-muted-foreground">{name}</span><span className="font-medium">{children}</span></div>
)
