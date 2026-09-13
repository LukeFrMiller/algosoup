/* eslint-disable @typescript-eslint/no-explicit-any */
import type { SupabaseClient } from '@supabase/supabase-js'
import { env } from '@/lib/env'
import { decrypt, encrypt, fromBytea, toBytea } from './crypto'
import type { IgClient, IgInsights, IgReel } from './types'

// ponytail: version pinned by hand; docs currently show v25.0. Bump when Meta deprecates.
const GRAPH = 'https://graph.instagram.com/v25.0'
const METRICS = ['views', 'saved', 'shares', 'likes', 'comments', 'reach']

async function getJson<T = any>(url: string, params: Record<string, string>): Promise<T> {
  const res = await fetch(url + '?' + new URLSearchParams(params))
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(`IG ${res.status}: ${body?.error?.message ?? JSON.stringify(body)}`)
  return body
}

export function createIgClient(accessToken: string): IgClient {
  const get = <T = any>(path: string, params: Record<string, string> = {}) =>
    getJson<T>(GRAPH + path, { ...params, access_token: accessToken })

  return {
    async listReels() {
      const reels: IgReel[] = []
      let url: string | undefined = GRAPH + '/me/media?' + new URLSearchParams({
        fields: 'id,media_type,media_product_type,permalink,caption,timestamp,thumbnail_url',
        limit: '100',
        access_token: accessToken,
      })
      while (url) {
        const page: any = await getJson(url, {})
        for (const m of page.data ?? []) {
          if (m.media_product_type !== 'REELS') continue
          reels.push({
            ig_media_id: m.id,
            permalink: m.permalink,
            caption: m.caption ?? null,
            posted_at: new Date(m.timestamp).toISOString(),
            thumbnail_url: m.thumbnail_url ?? null,
          })
        }
        url = page.paging?.next
      }
      return reels.sort((a, b) => b.posted_at.localeCompare(a.posted_at))
    },

    async getInsights(igMediaId) {
      const out: IgInsights = { views: null, saves: null, shares: null, likes: null, comments: null, reach: null }
      let data: { name: string; values?: { value: number }[] }[]
      try {
        data = (await get(`/${igMediaId}/insights`, { metric: METRICS.join(',') })).data
      } catch (e) {
        // Older media rejects `views`; retry without it. Anything else propagates.
        if (!/views/i.test(String(e))) throw e
        data = (await get(`/${igMediaId}/insights`, { metric: METRICS.filter((m) => m !== 'views').join(',') })).data
      }
      for (const m of data ?? []) {
        const v = m.values?.[0]?.value
        if (typeof v !== 'number') continue
        const key = (m.name === 'saved' ? 'saves' : m.name) as keyof IgInsights
        if (key in out) out[key] = v
      }
      return out
    },

    async getMediaUrl(igMediaId) {
      const { media_url } = await get(`/${igMediaId}`, { fields: 'media_url' })
      if (!media_url) throw new Error(`no media_url for ${igMediaId}`)
      return media_url
    },

    async getProfile() {
      const p = await get('/me', { fields: 'user_id,username,followers_count' })
      return { ig_user_id: String(p.user_id), username: p.username, followers_count: p.followers_count ?? null }
    },
  }
}

// --- OAuth / token lifecycle ---

/** code → short-lived → long-lived token. */
export async function exchangeCode(code: string): Promise<{ access_token: string; expires_in: number }> {
  const res = await fetch('https://api.instagram.com/oauth/access_token', {
    method: 'POST',
    body: new URLSearchParams({
      client_id: env('INSTAGRAM_APP_ID'),
      client_secret: env('INSTAGRAM_APP_SECRET'),
      grant_type: 'authorization_code',
      redirect_uri: env('INSTAGRAM_REDIRECT_URI'),
      code,
    }),
  })
  const short = await res.json().catch(() => ({}))
  if (!res.ok || !short.access_token) throw new Error(`IG short-lived: ${JSON.stringify(short)}`)
  return getJson('https://graph.instagram.com/access_token', {
    grant_type: 'ig_exchange_token',
    client_secret: env('INSTAGRAM_APP_SECRET'),
    access_token: short.access_token,
  })
}

/** Long-lived token refresh. Token must be ≥24h old and unexpired. */
export function refreshToken(accessToken: string): Promise<{ access_token: string; expires_in: number }> {
  return getJson('https://graph.instagram.com/refresh_access_token', {
    grant_type: 'ig_refresh_token',
    access_token: accessToken,
  })
}

/** Encrypted token columns for an instagram_accounts write. */
export function tokenColumns(accessToken: string, expiresIn: number) {
  const { ciphertext, iv } = encrypt(accessToken)
  const now = new Date()
  return {
    token_ciphertext: toBytea(ciphertext),
    token_iv: toBytea(iv),
    token_expires_at: new Date(now.getTime() + expiresIn * 1000).toISOString(),
    token_refreshed_at: now.toISOString(),
  }
}

type AccountRow = {
  token_ciphertext: string
  token_iv: string
  token_expires_at: string
  token_refreshed_at: string | null
  connected_at: string
}

async function loadToken(supabase: SupabaseClient, ownerId: string) {
  const { data, error } = await supabase
    .from('instagram_accounts')
    .select('token_ciphertext,token_iv,token_expires_at,token_refreshed_at,connected_at')
    .eq('owner_id', ownerId)
    .maybeSingle<AccountRow>()
  if (error) throw error
  if (!data) throw new Error('no instagram account connected')
  return { row: data, token: decrypt(fromBytea(data.token_ciphertext), fromBytea(data.token_iv)) }
}

/** Refresh + persist. `force` skips the age/expiry gate (manual button). Returns new expiry ISO. */
export async function refreshOwnerToken(supabase: SupabaseClient, ownerId: string, force = false) {
  const { row, token } = await loadToken(supabase, ownerId)
  const day = 86_400_000
  const ageMs = Date.now() - new Date(row.token_refreshed_at ?? row.connected_at).getTime()
  const leftMs = new Date(row.token_expires_at).getTime() - Date.now()
  if (!force && !(ageMs > day && leftMs < 14 * day)) return { token, token_expires_at: row.token_expires_at }
  const fresh = await refreshToken(token)
  const cols = tokenColumns(fresh.access_token, fresh.expires_in)
  const { error } = await supabase.from('instagram_accounts').update(cols).eq('owner_id', ownerId)
  if (error) throw error
  return { token: fresh.access_token, token_expires_at: cols.token_expires_at }
}

/** Service-role client in, ready IgClient out. Refreshes the token when due. */
export async function getOwnerClient(supabase: SupabaseClient, ownerId: string): Promise<IgClient> {
  const { token } = await refreshOwnerToken(supabase, ownerId)
  return createIgClient(token)
}
