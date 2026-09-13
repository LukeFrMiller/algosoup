// Contract between package F (stats/suggestions) and packages G/H (UI). Frozen.
export type Metric = 'views' | 'saves' | 'shares' | 'engagement'
export type Dimension = 'hook_device' | 'beat' | 'broad_topic' | 'hook_template'

export type Posterior = { mean: number; lo: number; hi: number } // 90% credible interval

export type LabelStat = {
  dimension: Dimension
  value: string
  metric: Metric
  n: number
  hits: number
  posterior: Posterior
}

export type PairStat = {
  a: { dimension: Dimension; value: string }
  b: { dimension: Dimension; value: string }
  metric: Metric
  n: number
  hits: number
  posterior: Posterior
  conditional_gain: Posterior // P(hit|A,B) - P(hit|A)
  synergy: number // log-odds scale; >0 synergy, ~0 additive, <0 redundant
  wracc: number
}

export type SuggestionKind = 'untested_synergy' | 'high_uncertainty' | 'confirmation'
export type Suggestion = {
  kind: SuggestionKind
  pair: Pick<PairStat, 'a' | 'b' | 'metric' | 'n' | 'hits' | 'posterior'>
  predicted?: number // for untested_synergy: independence prediction
  rationale: string
  target_n: number
}

export type Settings = { maturity_days: number; min_sample: number; baseline_window: number; hit_quantile: number }
