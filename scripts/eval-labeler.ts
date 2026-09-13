// bun scripts/eval-labeler.ts [--runs N]
import { labelTranscript } from '@/lib/labeler'
import type { Beat, ScriptLabel } from '@/lib/labeler/types'
import raw from '../eval/ground_truth.json'

const truth = raw as { items: { id: string; transcript: string; hook_text: string; hook_device: string; beats: Beat[] }[] }

const runs = Number(process.argv[process.argv.indexOf('--runs') + 1]) || 3

const jaccard = (a: string[], b: string[]) => {
  const A = new Set(a), B = new Set(b)
  const inter = [...A].filter((x) => B.has(x)).length
  return inter / (A.size + B.size - inter || 1)
}
const mode = (xs: string[]) =>
  [...new Set(xs)].sort((a, b) => xs.filter((x) => x === b).length - xs.filter((x) => x === a).length)[0]
const meanPairwiseJaccard = (bs: Beat[][]) => {
  const ps: number[] = []
  for (let i = 0; i < bs.length; i++) for (let j = i + 1; j < bs.length; j++) ps.push(jaccard(bs[i], bs[j]))
  return ps.length ? ps.reduce((a, b) => a + b) / ps.length : 1
}

const rows = []
const byDevice: Record<string, number[]> = {} // truth device -> per-run match flags
const byBeat: Record<string, number[]> = {} // truth beat -> per-run presence flags
for (const item of truth.items) {
  const labels: ScriptLabel[] = []
  for (let i = 0; i < runs; i++) labels.push((await labelTranscript(item.transcript)).label)
  const devices = labels.map((l) => l.hook_device)
  const modal = mode(devices)
  const devAgree = devices.filter((d) => d === item.hook_device).length / runs
  const beatsJ = labels.map((l) => jaccard(l.beats, item.beats)).reduce((a, b) => a + b) / runs
  ;(byDevice[item.hook_device] ??= []).push(...devices.map((d) => +(d === modal)))
  for (const b of item.beats) {
    const flags = labels.map((l) => +l.beats.includes(b))
    const m = flags.reduce((a, x) => a + x) / runs >= 0.5 ? 1 : 0
    ;(byBeat[b] ??= []).push(...flags.map((f) => +(f === m)))
  }
  rows.push({
    id: item.id,
    truth_device: item.hook_device,
    got: [...new Set(devices)].join('|'),
    device_agree: devAgree.toFixed(2),
    beats_jaccard: beatsJ.toFixed(2),
    self_device: (devices.filter((d) => d === modal).length / runs).toFixed(2),
    self_beats: meanPairwiseJaccard(labels.map((l) => l.beats)).toFixed(2),
    hook_text_ok: labels.every((l) => l.hook_text === item.hook_text) ? 'y' : 'n',
  })
}
console.table(rows)

const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length
const weak = [
  ...Object.entries(byDevice).map(([k, v]) => [`hook_device:${k}`, avg(v)] as const),
  ...Object.entries(byBeat).map(([k, v]) => [`beat:${k}`, avg(v)] as const),
].filter(([, c]) => c < 0.8)
console.log(
  weak.length
    ? `Self-consistency < 0.8 (tighten these definitions):\n` + weak.map(([k, c]) => `  ${k} ${c.toFixed(2)}`).join('\n')
    : 'All enum values self-consistent (>= 0.8).',
)
