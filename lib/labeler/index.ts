import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'
import { env } from '@/lib/env'
import { CODEBOOK_VERSION, SYSTEM_PROMPT } from './codebook'
import { BEATS, HOOK_DEVICES, type LabelResult } from './types'

export const MODEL = 'claude-haiku-4-5-20251001'

const LabelSchema = z.object({
  hook_text: z.string().min(1).max(200),
  hook_device: z.enum(HOOK_DEVICES),
  hook_template: z.string().min(1),
  beats: z.array(z.enum(BEATS)).min(2).max(8),
  broad_topic: z.string().min(1),
  specific_topic: z.string().min(1).max(60),
  notes: z.string().nullable().default(null),
})

const tool: Anthropic.Tool = {
  name: 'label_script',
  description: 'Record the labels for one reel transcript according to the codebook.',
  input_schema: {
    type: 'object',
    additionalProperties: false,
    required: ['hook_text', 'hook_device', 'hook_template', 'beats', 'broad_topic', 'specific_topic'],
    properties: {
      hook_text: { type: 'string', maxLength: 200 },
      hook_device: { type: 'string', enum: [...HOOK_DEVICES] },
      hook_template: { type: 'string' },
      beats: { type: 'array', items: { type: 'string', enum: [...BEATS] }, minItems: 2, maxItems: 8 },
      broad_topic: { type: 'string' },
      specific_topic: { type: 'string', maxLength: 60 },
      notes: { type: 'string' },
    },
  },
}

let client: Anthropic | undefined

// ponytail: no retries here on purpose; the pipeline (package D) retries failed steps.
export async function labelTranscript(transcript: string): Promise<LabelResult> {
  client ??= new Anthropic({ apiKey: env('ANTHROPIC_API_KEY'), maxRetries: 0 })
  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    temperature: 0,
    system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
    tools: [tool],
    tool_choice: { type: 'tool', name: 'label_script' },
    messages: [{ role: 'user', content: transcript }],
  })
  const use = res.content.find((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use')
  if (!use) throw new Error(`labeler: no tool_use block (stop_reason=${res.stop_reason})`)
  // Haiku occasionally overruns the length caps; clamp rather than fail the whole video.
  const raw = use.input as Record<string, unknown>
  const clamp = (k: string, n: number) => { if (typeof raw[k] === 'string') raw[k] = (raw[k] as string).slice(0, n) }
  clamp('hook_text', 200); clamp('specific_topic', 60)
  const parsed = LabelSchema.safeParse(raw)
  if (!parsed.success) throw new Error(`labeler: ${parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ').slice(0, 300)}`)
  const label = parsed.data
  if (label.beats[0] !== 'hook') throw new Error('labeler: beats[0] must be "hook"')
  return { label, codebook_version: CODEBOOK_VERSION, model: res.model, raw: res }
}
