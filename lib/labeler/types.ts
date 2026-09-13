// Contract between package E (labeler) and package D (pipeline). Frozen.
export const HOOK_DEVICES = [
  'question', 'bold_claim', 'negative_warning', 'curiosity_gap', 'contrarian',
  'direct_address', 'story_open', 'list_promise', 'demonstration', 'social_proof',
] as const
export const BEATS = [
  'hook', 'context', 'problem', 'counter_positioning', 'proof', 'steps',
  'example', 'payoff', 'cta', 'aside',
] as const
export type HookDevice = (typeof HOOK_DEVICES)[number]
export type Beat = (typeof BEATS)[number]

export type ScriptLabel = {
  hook_text: string
  hook_device: HookDevice
  hook_template: string
  beats: Beat[]
  broad_topic: string // free text in codebook v1; frozen enum in v2
  specific_topic: string
  notes: string | null
}

export type LabelResult = {
  label: ScriptLabel
  codebook_version: number
  model: string
  raw: unknown
}

/** Implemented in lib/labeler/index.ts as `labelTranscript(transcript: string): Promise<LabelResult>` */
