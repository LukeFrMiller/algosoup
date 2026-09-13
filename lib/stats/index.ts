// Package F: label/pair statistics from the SQL count views (PRD §9).
import { draws, mean, mulberry32, posterior, summarize, toPosterior, type Rng } from './beta'
import type { Dimension, LabelStat, Metric, PairStat } from './types'

export * from './beta'
export type * from './types'

// Row shapes of the package-C views.
export type BaseRateRow = { metric: Metric; n: number; hits: number }
export type DimensionCountRow = { dimension: Dimension; value: string; metric: Metric; n: number; hits: number }
export type PairCountRow = {
  dim_a: Dimension; val_a: string; dim_b: Dimension; val_b: string; metric: Metric
  n: number; hits: number; n_a: number; hits_a: number; n_b: number; hits_b: number
}

export const logit = (p: number) => Math.log(p / (1 - p))
export const sigmoid = (x: number) => 1 / (1 + Math.exp(-x))

export const baseRates = (base: BaseRateRow[]) => {
  const out = {} as Record<Metric, { p0: number; N: number }>
  for (const r of base) out[r.metric] = { p0: r.n ? r.hits / r.n : 0.25, N: r.n }
  return out
}
const baseFor = (b: ReturnType<typeof baseRates>, m: Metric) => b[m] ?? { p0: 0.25, N: 0 }

export const labelStats = (rows: DimensionCountRow[], base: BaseRateRow[], rng: Rng = mulberry32(1)): LabelStat[] => {
  const b = baseRates(base)
  return rows.map((r) => ({
    dimension: r.dimension,
    value: r.value,
    metric: r.metric,
    n: r.n,
    hits: r.hits,
    posterior: toPosterior(posterior(r.hits, r.n, baseFor(b, r.metric).p0), rng),
  }))
}

export const pairStats = (rows: PairCountRow[], base: BaseRateRow[], rng: Rng = mulberry32(2)): PairStat[] => {
  const b = baseRates(base)
  return rows.map((r) => {
    const { p0, N } = baseFor(b, r.metric)
    const ab = posterior(r.hits, r.n, p0)
    const a = posterior(r.hits_a, r.n_a, p0)
    const bb = posterior(r.hits_b, r.n_b, p0)
    const dAB = draws(ab, rng)
    const dA = draws(a, rng)
    return {
      a: { dimension: r.dim_a, value: r.val_a },
      b: { dimension: r.dim_b, value: r.val_b },
      metric: r.metric,
      n: r.n,
      hits: r.hits,
      posterior: summarize(dAB, mean(ab)),
      conditional_gain: summarize(dAB.map((x, i) => x - dA[i])),
      synergy: logit(mean(ab)) - logit(mean(a)) - logit(mean(bb)) + logit(p0),
      wracc: N ? (r.n / N) * (mean(ab) - p0) : 0,
    }
  })
}

export const multipleComparisons = (numCandidates: number) => ({
  screened: numCandidates,
  expectedFalsePositives: Math.round(numCandidates * 0.05),
})
