// Contract between package B (client) and package D (pipeline). Frozen.
export type IgReel = {
  ig_media_id: string
  permalink: string
  caption: string | null
  posted_at: string // ISO
  thumbnail_url: string | null
}

export type IgInsights = {
  views: number | null
  saves: number | null
  shares: number | null
  likes: number | null
  comments: number | null
  reach: number | null
}

export interface IgClient {
  /** All reels for the connected account, newest first. Pages internally. */
  listReels(): Promise<IgReel[]>
  /** Insights for one reel. Missing metrics come back null, never 0. */
  getInsights(igMediaId: string): Promise<IgInsights>
  /** Signed, short-lived media URL. Fetch and use inside the same step. */
  getMediaUrl(igMediaId: string): Promise<string>
  /** Fetched from /me. */
  getProfile(): Promise<{ ig_user_id: string; username: string; followers_count: number | null }>
}
