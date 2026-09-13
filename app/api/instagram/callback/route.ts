import { createClient as createServiceClient } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'
import { env } from '@/lib/env'
import { createIgClient, exchangeCode, tokenColumns } from '@/lib/instagram/client'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const back = (q: string) => {
    const res = NextResponse.redirect(new URL(`/connect?${q}`, request.url))
    res.cookies.delete('ig_oauth_state')
    return res
  }
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  const ownerId = data?.claims?.sub
  if (!ownerId) return NextResponse.redirect(new URL('/login', request.url))

  const q = request.nextUrl.searchParams
  if (q.get('error')) return back('error=denied')
  const code = q.get('code')
  const state = q.get('state')
  if (!code || !state || state !== request.cookies.get('ig_oauth_state')?.value) return back('error=state')

  try {
    const { access_token, expires_in } = await exchangeCode(code)
    const profile = await createIgClient(access_token).getProfile()
    const db = createServiceClient(env('NEXT_PUBLIC_SUPABASE_URL'), env('SUPABASE_SECRET_KEY'))
    // ponytail: delete+insert instead of upsert so we don't depend on which unique constraint C picked.
    await db.from('instagram_accounts').delete().eq('owner_id', ownerId)
    const { error } = await db.from('instagram_accounts').insert({
      owner_id: ownerId,
      ...profile,
      ...tokenColumns(access_token, expires_in),
      connected_at: new Date().toISOString(),
    })
    if (error) throw error
    return back('connected=1')
  } catch (e) {
    console.error('instagram callback', e)
    return back(`error=${/IG short-lived|IG 4/.test(String(e)) ? 'exchange' : 'store'}`)
  }
}
