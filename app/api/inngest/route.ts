import { serve } from 'inngest/next'
import { inngest } from '@/inngest/client'
import { backfill, processVideo } from '@/inngest/functions'

// Dev server needs no keys; in prod INNGEST_EVENT_KEY / INNGEST_SIGNING_KEY are read from env by the SDK.
export const { GET, POST, PUT } = serve({ client: inngest, functions: [backfill, processVideo] })
