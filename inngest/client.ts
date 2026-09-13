import { createClient } from '@supabase/supabase-js'
import { Inngest } from 'inngest'
import type { Database } from '@/lib/db/types'
import { env } from '@/lib/env'

export const inngest = new Inngest({ id: 'algosoup' })

export type Mode = 'full' | 'metrics_only'
export type BackfillRequested = { owner_id: string; run_id: string }
export type VideoProcess = { owner_id: string; run_id: string; video_id: string; mode: Mode }

/** Service-role client: bypasses RLS. Jobs + trusted server actions only. */
export const serviceDb = () => createClient<Database>(env('NEXT_PUBLIC_SUPABASE_URL'), env('SUPABASE_SECRET_KEY'))
