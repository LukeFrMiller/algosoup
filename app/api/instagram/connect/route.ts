import { randomBytes } from 'node:crypto'
import { NextResponse } from 'next/server'
import { env } from '@/lib/env'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  if (!data?.claims) return NextResponse.redirect(new URL('/login', request.url))

  const state = randomBytes(16).toString('hex')
  const url = new URL('https://www.instagram.com/oauth/authorize')
  url.search = new URLSearchParams({
    client_id: env('INSTAGRAM_APP_ID'),
    redirect_uri: env('INSTAGRAM_REDIRECT_URI'),
    scope: 'instagram_business_basic,instagram_business_manage_insights',
    response_type: 'code',
    state,
  }).toString()

  const res = NextResponse.redirect(url)
  res.cookies.set('ig_oauth_state', state, { httpOnly: true, secure: true, sameSite: 'lax', path: '/api/instagram', maxAge: 600 })
  return res
}
