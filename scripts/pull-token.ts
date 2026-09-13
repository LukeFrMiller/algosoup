// Copy the instagram_accounts row from hosted Supabase into local. `bun scripts/pull-token.ts`
// Needs HOSTED_SUPABASE_URL + HOSTED_SUPABASE_SECRET_KEY (hosted) and NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SECRET_KEY (local).
// Optional LOCAL_OWNER_ID; defaults to the single local auth user.
import { createClient } from '@supabase/supabase-js'
import { existsSync, readFileSync } from 'node:fs'
import { env } from '../lib/env'

// ponytail: bun doesn't auto-load .env.development.local; tiny parser instead of dotenv.
for (const f of ['.env.local', '.env.development.local']) {
  if (!existsSync(f)) continue
  for (const line of readFileSync(f, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/)
    if (m) process.env[m[1]] ??= m[2].replace(/^(['"])(.*)\1$/, '$2')
  }
}

const hosted = createClient(env('HOSTED_SUPABASE_URL'), env('HOSTED_SUPABASE_SECRET_KEY'))
const local = createClient(env('NEXT_PUBLIC_SUPABASE_URL'), env('SUPABASE_SECRET_KEY'))

const { data: rows, error } = await hosted.from('instagram_accounts').select('*')
if (error) throw error
if (!rows?.length) throw new Error('no instagram_accounts row on hosted — connect on prod first')
const { owner_id: _hostedOwner, ...row } = rows[0] // eslint-disable-line @typescript-eslint/no-unused-vars

let ownerId = process.env.LOCAL_OWNER_ID
if (!ownerId) {
  const { data, error } = await local.auth.admin.listUsers()
  if (error) throw error
  if (data.users.length !== 1) throw new Error(`local has ${data.users.length} users; set LOCAL_OWNER_ID`)
  ownerId = data.users[0].id
}

await local.from('instagram_accounts').delete().eq('owner_id', ownerId)
const ins = await local.from('instagram_accounts').insert({ ...row, owner_id: ownerId })
if (ins.error) throw ins.error
console.log(`pulled @${row.username} (expires ${row.token_expires_at}) → local owner ${ownerId}`)
