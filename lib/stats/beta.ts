// Beta posterior + sampler. No stats deps: Marsaglia–Tsang gamma over a seeded mulberry32 PRNG.
import type { Posterior } from './types'

export type Rng = () => number
export type BetaParams = { a: number; b: number }

export const DRAWS = 4000

export const mulberry32 = (seed: number): Rng => () => {
  seed = (seed + 0x6d2b79f5) | 0
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

const normal = (rng: Rng) =>
  Math.sqrt(-2 * Math.log(1 - rng())) * Math.cos(2 * Math.PI * rng())

const gamma = (shape: number, rng: Rng): number => {
  if (shape < 1) return gamma(shape + 1, rng) * Math.pow(rng(), 1 / shape)
  const d = shape - 1 / 3
  const c = 1 / Math.sqrt(9 * d)
  for (;;) {
    const x = normal(rng)
    const v = Math.pow(1 + c * x, 3)
    if (v <= 0) continue
    const u = rng()
    if (Math.log(u) < 0.5 * x * x + d - d * v + d * Math.log(v)) return d * v
  }
}

export const sampleBeta = (a: number, b: number, rng: Rng) => {
  const x = gamma(a, rng)
  return x / (x + gamma(b, rng))
}

export const draws = (p: BetaParams, rng: Rng, k = DRAWS) =>
  Array.from({ length: k }, () => sampleBeta(p.a, p.b, rng))

/** Prior Beta(strength·p0, strength·(1−p0)) updated with hits/n. */
export const posterior = (hits: number, n: number, p0: number, strength = 4): BetaParams => ({
  a: strength * p0 + hits,
  b: strength * (1 - p0) + (n - hits),
})

export const mean = ({ a, b }: BetaParams) => a / (a + b)

/** mean + 90% interval from a sample; mean is the sample mean unless an analytic one is given. */
export const summarize = (xs: number[], analyticMean?: number): Posterior => {
  const s = [...xs].sort((p, q) => p - q)
  const q = (f: number) => s[Math.floor(f * (s.length - 1))]
  return { mean: analyticMean ?? s.reduce((t, x) => t + x, 0) / s.length, lo: q(0.05), hi: q(0.95) }
}

export const toPosterior = (p: BetaParams, rng: Rng): Posterior => summarize(draws(p, rng), mean(p))
