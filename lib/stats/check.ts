// Self-check: `bun lib/stats/check.ts`
import assert from 'node:assert/strict'
import { labelStats, mean, mulberry32, multipleComparisons, pairStats, posterior, toPosterior, type PairCountRow } from './index'
import { evaluateHypothesis, suggest } from '../suggestions'

const p0 = 0.25
const base = [{ metric: 'views' as const, n: 100, hits: 25 }]
const settings = { maturity_days: 7, min_sample: 5, baseline_window: 20, hit_quantile: 0.75 }

// shrinkage: 2/3 hits → mean < 0.5 and > p0
const m23 = mean(posterior(2, 3, p0))
assert.ok(m23 < 0.5 && m23 > p0, `shrinkage ${m23}`)
console.log('shrinkage: 2/3 →', m23.toFixed(3))

// interval narrows with n
const w = (h: number, n: number) => { const p = toPosterior(posterior(h, n, p0), mulberry32(1)); return p.hi - p.lo }
assert.ok(w(20, 40) < w(2, 4), 'interval narrows')
console.log('width 2/4 =', w(2, 4).toFixed(3), ' 20/40 =', w(20, 40).toFixed(3))

const pair = (n: number, hits: number, extra: Partial<PairCountRow> = {}): PairCountRow => ({
  dim_a: 'hook_device', val_a: 'negative_warning', dim_b: 'beat', val_b: 'counter_positioning', metric: 'views',
  n, hits, n_a: 22, hits_a: 11, n_b: 16, hits_b: 9, ...extra,
})
// synergy sign: A≈0.46, B≈0.5 → independence ≈ 0.72; pair at 95% is positive, at 20% negative
const [hi, lo] = pairStats([pair(20, 19), pair(20, 4)], base)
assert.ok(hi.synergy > 0, `synergy+ ${hi.synergy}`)
assert.ok(lo.synergy < 0, `synergy- ${lo.synergy}`)
console.log('synergy: 19/20 →', hi.synergy.toFixed(2), ' 4/20 →', lo.synergy.toFixed(2))
assert.ok(hi.conditional_gain.mean > 0 && lo.conditional_gain.mean < 0, 'conditional gain sign')

// wracc: 20% coverage at moderate lift beats 2 videos at huge lift
const [moderate, tiny] = pairStats([pair(20, 8), pair(2, 2)], base)
assert.ok(moderate.wracc > tiny.wracc, `wracc ${moderate.wracc} vs ${tiny.wracc}`)
console.log('wracc: 8/20 →', moderate.wracc.toFixed(3), ' 2/2 →', tiny.wracc.toFixed(3))

assert.deepEqual(multipleComparisons(40), { screened: 40, expectedFalsePositives: 2 })

// suggest(): synthetic input with many candidates of each kind
const singles = labelStats(
  [
    { dimension: 'hook_device', value: 'negative_warning', metric: 'views', n: 22, hits: 11 },
    { dimension: 'hook_device', value: 'bold_claim', metric: 'views', n: 30, hits: 14 },
    { dimension: 'beat', value: 'counter_positioning', metric: 'views', n: 16, hits: 9 },
    { dimension: 'beat', value: 'reveal', metric: 'views', n: 25, hits: 12 },
  ],
  base,
)
const pairs = pairStats(
  [
    pair(0, 0), // untested
    pair(1, 1, { val_a: 'bold_claim', n_a: 30, hits_a: 14 }), // untested
    pair(1, 0, { val_b: 'reveal', n_b: 25, hits_b: 12 }), // untested
    pair(3, 3, { val_a: 'bold_claim', val_b: 'reveal', n_a: 30, hits_a: 14, n_b: 25, hits_b: 12 }), // high_uncertainty
    pair(12, 8, { dim_a: 'beat', val_a: 'reveal', n_a: 25, hits_a: 12 }), // confirmation
    pair(10, 7, { dim_a: 'beat', val_a: 'reveal', val_b: 'reveal' }), // confirmation, but active hypothesis
  ],
  base,
)
const active = [{ labels: { beat: 'reveal' } }]
const out = suggest(pairs, singles, active, [], settings, mulberry32(9))
assert.ok(out.length <= 3, 'top 3')
for (const k of ['untested_synergy', 'high_uncertainty', 'confirmation'] as const)
  assert.ok(out.filter((s) => s.kind === k).length <= 2, `≤2 of ${k}`)
assert.ok(out.some((s) => s.kind === 'untested_synergy' && s.predicted! > 0.4), 'independence prediction')
for (const s of out) console.log(`[${s.kind}] ${s.rationale}`)

// evaluateHypothesis verdicts
assert.equal(evaluateHypothesis(2, 3, 6, p0, 0.5).verdict, 'In progress, 3/6')
assert.equal(evaluateHypothesis(5, 6, 6, p0, 0.5).status, 'supported')
assert.equal(evaluateHypothesis(0, 6, 6, p0, 0.5).status, 'not_supported')
assert.equal(evaluateHypothesis(2, 6, 6, p0, 0.5).verdict, 'Inconclusive, extend to 8')
console.log('all checks passed')
