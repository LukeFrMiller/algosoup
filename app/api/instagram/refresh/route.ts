import { createClient as createServiceClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { env } from '@/lib/env'
import { refreshOwnerToken } from '@/lib/instagram/client'
import { createClient } from '@/lib/supabase/server'

export async function POST() {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  const ownerId = data?.claims?.sub
  if (!ownerId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  try {
    const db = createServiceClient(env('NEXT_PUBLIC_SUPABASE_URL'), env('SUPABASE_SECRET_KEY'))
    const { token_expires_at } = await refreshOwnerToken(db, ownerId, true)
    return NextResponse.json({ token_expires_at })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 })
  }
}
