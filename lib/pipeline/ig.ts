import type { SupabaseClient } from '@supabase/supabase-js'
import { getOwnerClient } from '@/lib/instagram/client'
import type { IgClient } from '@/lib/instagram/types'

export const IG_MOCK = process.env.IG_MOCK === '1'

// ponytail: local-only fake. 3 fixed reels; media URL is a public sample mp4 (no speech, so under
// IG_MOCK transcribe.ts substitutes MOCK_TRANSCRIPT instead of calling Whisper).
const MOCK_IDS = ['mock_reel_1', 'mock_reel_2', 'mock_reel_3']
export const MOCK_TRANSCRIPT =
  "Stop using ChatGPT like a search engine. Most people type one question and take the first answer. Here's what actually works: give it your role, your goal, and one example of the output you want. Then ask it to critique its own answer before you read it. I did this for a week and my drafts went from useless to publishable. Try it on your next email and tell me what changed."

const mockClient: IgClient = {
  async listReels() {
    return MOCK_IDS.map((id, i) => ({
      ig_media_id: id,
      permalink: `https://www.instagram.com/reel/${id}/`,
      caption: `Mock reel ${i + 1}`,
      posted_at: new Date(Date.UTC(2026, 8, 1 + i)).toISOString(),
      thumbnail_url: null,
    }))
  },
  async getInsights(id) {
    const n = MOCK_IDS.indexOf(id) + 1
    return { views: 1000 * n, saves: 10 * n, shares: 5 * n, likes: 50 * n, comments: 3 * n, reach: 800 * n }
  },
  async getMediaUrl() {
    // IG_MOCK_MEDIA_URL lets a local test point at a 404 to exercise the failed-step path.
    return process.env.IG_MOCK_MEDIA_URL ?? 'https://www.w3schools.com/html/mov_bbb.mp4'
  },
  async getProfile() {
    return { ig_user_id: 'mock', username: 'mock', followers_count: 1 }
  },
}

/** Real client (token refreshed if due) or the mock under IG_MOCK=1. */
export function getIgClient(db: SupabaseClient, ownerId: string): Promise<IgClient> {
  return IG_MOCK ? Promise.resolve(mockClient) : getOwnerClient(db, ownerId)
}
