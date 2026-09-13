// Package F: suggestion engine + hypothesis evaluation (PRD §10).
import { logit, mulberry32, posterior, sampleBeta, sigmoid, toPosterior, type Rng } from '@/lib/stats'
import type { LabelStat, PairStat, Posterior, Settings, Suggestion, SuggestionKind } from '@/lib/stats/types'

export type Labels = Record<string, string> // hypotheses.labels: {dimension: value}
export const TARGET_N = 6
const PRIOR_STRENGTH = 4
const MAX_PER_KIND = 2
const TOP = 3

const pct = (p: number) => `${Math.round(p * 100)}%`
export const humanise = (s: string) => s.replace(/_/g, ' ')
const NOUN: Record<string, string> = { hook_device: 'hooks', beat: 'beats', broad_topic: 'topics', hook_template: 'hook templates' }
const label = (l: { dimension: string; value: string }) => `${humanise(l.value)} ${NOUN[l.dimension] ?? humanise(l.dimension)}`
const pairKey = (a: { dimension: string; value: string }, b: { dimension: string; value: string }) =>
  [`${a.dimension}=${a.value}`, `${b.dimension}=${b.value}`].sort().join('|')
const labelsKey = (labels: Labels) => Object.entries(labels).map(([d, v]) => `${d}=${v}`).sort().join('|')

const covers = (labels: Labels, p: PairStat) => labels[p.a.dimension] === p.a.value && labels[p.b.dimension] === p.b.value

const rationale: Record<SuggestionKind, (p: Suggestion['pair'], x: { A?: LabelStat; B?: LabelStat; predicted?: number; p0: number }) => string> = {
  untested_synergy: (p, { A, B, predicted }) =>
    `${label(p.a)} hit ${pct(A!.posterior.mean)} (${A!.hits}/${A!.n}) and ${label(p.b)} hit ${pct(B!.posterior.mean)} (${B!.hits}/${B!.n}), but you have never combined them. If the effects are independent the pair should land near ${pct(predicted!)}. Make ${TARGET_N} reels to find out.`,
  high_uncertainty: (p) =>
    `${label(p.a)} with ${label(p.b)} hit ${pct(p.posterior.mean)} (${p.hits}/${p.n}), but with only ${p.n} the 90% interval runs ${pct(p.posterior.lo)}–${pct(p.posterior.hi)}. Make ${TARGET_N} more to pin it down.`,
  confirmation: (p, { p0 }) =>
    `${label(p.a)} with ${label(p.b)} hit ${pct(p.posterior.mean)} (${p.hits}/${p.n}), interval ${pct(p.posterior.lo)}–${pct(p.posterior.hi)}, above the ${pct(p0)} base rate. Track ${TARGET_N} more to see if it holds.`,
}

// Capitalise first letter of a rationale.
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

export const suggest = (
  pairs: PairStat[],
  singles: LabelStat[],
  activeHypotheses: { labels: Labels }[],
  dismissed: { labels: Labels }[],
  settings: Settings,
  rng: Rng = mulberry32(3),
): Suggestion[] => {
  const p0 = 1 - settings.hit_quantile // §9.3: base rate by construction
  const excluded = new Set(dismissed.map((d) => labelsKey(d.labels)))
  // N per metric = videos with a hook_device label (one per video). ponytail: falls back to max single n.
  const N: Record<string, number> = {}
  for (const s of singles) if (s.dimension === 'hook_device') N[s.metric] = (N[s.metric] ?? 0) + s.n
  for (const s of singles) N[s.metric] = Math.max(N[s.metric] ?? 0, s.n)
  const single = (l: { dimension: string; value: string }, metric: string) =>
    singles.find((s) => s.dimension === l.dimension && s.value === l.value && s.metric === metric)

  const scored: { s: Suggestion; score: number }[] = []
  for (const p of pairs) {
    if (excluded.has(pairKey(p.a, p.b)) || activeHypotheses.some((h) => covers(h.labels, p))) continue
    const A = single(p.a, p.metric)
    const B = single(p.b, p.metric)
    const width = p.posterior.hi - p.posterior.lo
    const pair = { a: p.a, b: p.b, metric: p.metric, n: p.n, hits: p.hits, posterior: p.posterior }
    const n = N[p.metric] || 1
    let kind: SuggestionKind | undefined
    let predicted: number | undefined
    let draw: number
    let coverage: number
    if (p.n <= 1 && A && B && A.posterior.lo > p0 && B.posterior.lo > p0) {
      kind = 'untested_synergy'
      predicted = sigmoid(logit(A.posterior.mean) + logit(B.posterior.mean) - logit(p0))
      draw = sampleBeta(PRIOR_STRENGTH * predicted, PRIOR_STRENGTH * (1 - predicted), rng)
      coverage = (A.n / n) * (B.n / n) // expected coverage under independence
    } else if (p.n >= 2 && p.n < settings.min_sample && p.posterior.mean > 1.5 * p0 && width > 0.4) {
      kind = 'high_uncertainty'
    } else if (p.n >= settings.min_sample && p.posterior.lo > p0) {
      kind = 'confirmation'
    }
    if (!kind) continue
    if (kind !== 'untested_synergy') {
      const { a, b } = posterior(p.hits, p.n, p0)
      draw = sampleBeta(a, b, rng)
      coverage = p.n / n
    }
    scored.push({
      s: { kind, pair, predicted, rationale: cap(rationale[kind](pair, { A, B, predicted, p0 })), target_n: TARGET_N },
      score: draw! * Math.sqrt(coverage!),
    })
  }

  scored.sort((x, y) => y.score - x.score)
  const count: Partial<Record<SuggestionKind, number>> = {}
  const out: Suggestion[] = []
  for (const { s } of scored) {
    if (out.length === TOP) break
    if ((count[s.kind] ?? 0) >= MAX_PER_KIND) continue
    count[s.kind] = (count[s.kind] ?? 0) + 1
    out.push(s)
  }
  return out
}

export type HypothesisStatus = 'active' | 'supported' | 'not_supported'

export const evaluateHypothesis = (
  hits: number, n: number, target_n: number, p0: number, prior_mean: number, rng: Rng = mulberry32(4),
): { status: HypothesisStatus; posterior: Posterior; verdict: string } => {
  const post = toPosterior(posterior(hits, n, p0), rng)
  if (n < target_n) return { status: 'active', posterior: post, verdict: `In progress, ${n}/${target_n}` }
  if (post.lo > p0) return { status: 'supported', posterior: post, verdict: 'Supported' }
  if (post.hi < prior_mean) return { status: 'not_supported', posterior: post, verdict: 'Not supported' }
  return { status: 'active', posterior: post, verdict: `Inconclusive, extend to ${target_n + 2}` }
}
