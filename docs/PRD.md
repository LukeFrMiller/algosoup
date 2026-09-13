# AlgoSoup — Reel Script Analytics PRD

Status: design review (v0.1, 2026-09-13). Nothing below is built yet.

## 1. Purpose

Pull the owner's Instagram reels, transcribe them, label each script's structure
with an LLM, and show which hook devices / structural beats correlate with views
and saves. Then propose 2–3 concrete label combinations to test next and track
those tests as hypotheses.

Everything on the dashboard is **hypothesis generation, not findings**. A few
hundred candidate label combinations vs. ~100–300 videos means multiple
comparisons dominate. The UI must say so.

## 2. Non-goals (v1)

- Scheduled refresh (cron). Manual buttons only.
- Webhooks. Pull only.
- Comment sentiment.
- Multi-user / per-user Instagram accounts. Single owner.
- Storing video files. We store metadata, the permalink, and the transcript.

## 3. Decisions already made

| Topic | Decision |
|---|---|
| Instagram auth | Instagram API with Instagram Login (Business Login). Scopes `instagram_business_basic`, `instagram_business_manage_insights`. No Facebook Page in the loop. |
| OAuth redirect | Deploy the callback to Vercel on day one. Redirect URI is `https://<prod-domain>/api/instagram/callback`. Local dev sets `INSTAGRAM_REDIRECT_URI` to the prod URL; the prod callback stores the token in the **hosted** Supabase, and a `scripts/pull-token.ts` copies it into local for dev. (Meta requires an exact HTTPS match; localhost is not prohibited but unverified, so we don't depend on it.) |
| App auth | Supabase email+password. Signups disabled after the owner account exists. Login page = shadcn `login-01`. |
| Token storage | Long-lived token (60d) encrypted at rest with AES-256-GCM using `TOKEN_ENCRYPTION_KEY` (32 bytes, env). Refresh via `graph.instagram.com/refresh_access_token` when age > 24h and expiry < 14d. Refresh runs at the start of every backfill and via a manual button. |
| Jobs | Inngest. Fan-out: one coordinator event per backfill, one event per video. |
| Transcription | OpenAI `whisper-1`, MP4 posted directly (Whisper accepts mp4, 25 MB cap). Media URL fetched inside the same step it's used. >25 MB → step marked `skipped_too_large`, video stays visible without transcript. |
| Labeling | Claude Haiku (`claude-haiku-4-5-20251001`), single forced tool `label_script`, temperature 0. Every labeled row carries `codebook_version`. |
| Aggregates | Postgres views. No jobs, no edge functions. Materialize only if measured slow. |
| Statistics | Binary hit (top quartile of normalized metric) → Beta-Binomial with weak prior. Details §8. |
| Suggestions | Thompson sampling over candidate combinations. Fallback to 80/20 if it proves noisy in eval. |
| UI kit | shadcn (base-mira style, neutral). Charts hand-rolled SVG/CSS with the shadcn tokens; single sequential blue ramp for the heatmap. |

## 4. Open questions (need answers before the relevant package starts)

Resolved 2026-09-13:
1. **Broad topic enum.** Free text on the first labeling pass, then freeze ≤8 values into codebook v1. Owner confirms the list.
2. **Hypothesis target sample size.** Default 6, editable per hypothesis.
3. **Minimum sample to un-dim a bar / cell.** n ≥ 5, editable in settings.
4. **Prod domain.** The default Vercel domain assigned on first deploy.

## 5. Architecture

```
Next.js 16 (app router, RSC)  ──  Supabase (Postgres, Auth)  ──  Inngest (jobs)
        │                                   ▲
        │ server actions / route handlers   │ service-role client (jobs only)
        ▼                                   │
  /api/instagram/{connect,callback,refresh} ─┘
  /api/inngest                                Inngest functions:
                                              - backfill.requested  → coordinator
                                              - video.process       → metrics → transcribe → label
                                              - video.refresh       → same function, single video
External: graph.instagram.com (media, insights, media_url), OpenAI Whisper, Anthropic Haiku.
```

Local dev: `supabase start` (running), `npx inngest-cli@latest dev`, `next dev`.

## 6. Data model (public schema)

All tables `owner_id uuid references auth.users` with RLS `owner_id = auth.uid()`.
Jobs use the service role.

| Table | Purpose | Key columns |
|---|---|---|
| `instagram_accounts` | one row per connected IG account | `ig_user_id`, `username`, `token_ciphertext bytea`, `token_iv bytea`, `token_expires_at`, `token_refreshed_at`, `followers_count`, `connected_at` |
| `videos` | one row per reel | `ig_media_id unique`, `permalink`, `caption`, `posted_at`, `duration_s`, `thumbnail_url` |
| `video_metrics` | latest insight snapshot per video (upsert) | `video_id pk`, `views`, `saves`, `shares`, `likes`, `comments`, `reach`, `engagement = likes+comments` (generated), `fetched_at` |
| `video_metric_snapshots` | append-only history (cheap, enables later curves) | `video_id`, `fetched_at`, same metric cols |
| `transcripts` | one per video | `video_id pk`, `text`, `language`, `model`, `duration_s`, `status` (`ok`, `skipped_too_large`, `failed`), `created_at` |
| `script_labels` | one per video **per codebook_version** | `video_id`, `codebook_version`, `hook_text`, `hook_device`, `hook_template`, `beats text[]`, `broad_topic`, `specific_topic`, `notes`, `model`, `raw jsonb`, `created_at`; unique `(video_id, codebook_version)` |
| `codebooks` | versioned enum definitions | `version pk`, `definition jsonb`, `system_prompt text`, `created_at` |
| `hypotheses` | accepted suggestions | `id`, `kind` (`untested_synergy`, `high_uncertainty`, `confirmation`), `labels jsonb` (e.g. `{"hook_device":"negative_warning","beat":"counter_positioning"}`), `metric`, `rationale`, `prior_hit_rate`, `target_n`, `status` (`active`, `supported`, `not_supported`, `abandoned`), `created_at`, `closed_at` |
| `hypothesis_videos` | tags | `hypothesis_id`, `video_id`, unique |
| `pipeline_runs` | one per backfill / refresh click | `id`, `kind` (`backfill`, `refresh_video`), `status`, `total`, `done`, `failed`, `started_at`, `finished_at` |
| `pipeline_steps` | per video per run | `run_id`, `video_id`, `step` (`metrics`,`transcribe`,`label`), `status` (`done`,`skipped`,`failed`), `error`, `finished_at` |
| `settings` | single row | `maturity_days int default 7`, `min_sample int default 5`, `baseline_window int default 20`, `hit_quantile numeric default 0.75` |

Views (all filtered to mature videos: `posted_at < now() - maturity_days`):

- `v_video_scores` — per video: `log_ratio_views = ln(views / median(views of previous 20 by posted_at))`, same for saves, shares, engagement; `is_hit_views` = top quartile of `log_ratio_views` (percent_rank ≥ hit_quantile), same per metric. Uses window functions; no baseline for the first 20 videos → `NULL`, excluded.
- `v_label_long` — unpivot labels to `(video_id, dimension, value)` rows: `hook_device`, each `beat` (distinct), `broad_topic`, `hook_template`.
- `v_dimension_stats` — group by `(dimension, value, metric)`: `n`, `hits`, plus posterior fields (§8) computed in SQL.
- `v_pair_stats` — group by `(dim_a, val_a, dim_b, val_b, metric)`: `n`, `hits`, `n_a`, `hits_a`, `n_b`, `hits_b`.
- `v_top_videos` — videos ordered by `log_ratio_<metric>` with hook text.

`v_pair_stats` is O(pairs × videos) but pairs ≈ 10 hooks × 12 beats + beat×beat ≈ 200, videos ≤ 1000: trivial.

## 7. Pipeline (Inngest)

### Events
- `backfill.requested {run_id}`
- `video.process {run_id, video_id, mode: "full" | "metrics_only"}`

### `backfill` (coordinator)
1. Refresh IG token if due.
2. Page through `/me/media?fields=id,media_type,media_product_type,permalink,caption,timestamp,thumbnail_url` (reels only: `media_product_type = REELS`). Upsert `videos`.
3. Split: videos with a `script_labels` row at the current `codebook_version` → `metrics_only`; otherwise → `full`.
4. `step.sendEvent` one `video.process` per video. Create `pipeline_runs` row with `total`.

### `process-video` (one per video, concurrency limit 5, retries 3)
Each step checks state first, so a rerun is idempotent:
1. **metrics** — fetch `/{media_id}/insights?metric=views,saved,shares,likes,comments,reach`. Upsert `video_metrics`, append `video_metric_snapshots`. Always runs.
2. **transcribe** — skip if `transcripts.status = ok` or mode is `metrics_only`. Else fetch `/{media_id}?fields=media_url` **and** download **and** POST to Whisper inside this one step. If `content-length > 25 MB` → `skipped_too_large`.
3. **label** — skip if a `script_labels` row exists for the current codebook version, or no `ok` transcript. Else call Haiku with forced tool.
4. Record `pipeline_steps` for each. Failures in one step fail only that step's retries; the run's `failed` count increments; other videos continue.

The single-video **Refresh** button emits the same `video.process` with mode derived from the video's state. Same code path.

Aggregates need no job: they are views over `video_metrics`, so a metrics update is reflected on next page load.

## 8. Labeling (Haiku, forced tool)

Tool `label_script` input schema (all required unless noted):

```
hook_text        string   verbatim first sentence(s) that function as the hook, ≤ 200 chars
hook_device      enum     see codebook
hook_template    string   the hook with specifics replaced by slots, e.g. "Stop doing {common_action} if you want {outcome}"
beats            enum[]   ordered, 2–8 items, first is always "hook"
broad_topic      enum     frozen after first pass (open question 1)
specific_topic   string   ≤ 60 chars
notes            string   optional, anything the schema can't capture
```

Codebook v1 enums (draft; each gets a one-line definition + positive example + negative boundary example in the system prompt):

`hook_device`: `question`, `bold_claim`, `negative_warning`, `curiosity_gap`, `contrarian`, `direct_address`, `story_open`, `list_promise`, `demonstration`, `social_proof`

`beat`: `hook`, `context`, `problem`, `counter_positioning`, `proof`, `steps`, `example`, `payoff`, `cta`, `aside`

Prompt rules: temperature 0; system prompt is the codebook (stored in `codebooks.system_prompt`); the transcript is the only user content; the model must call the tool (`tool_choice: {type: "tool", name: "label_script"}`).

### Eval harness (`scripts/eval-labeler.ts`)
- `eval/ground_truth.json`: ≥5 transcripts with owner-provided labels.
- Runs the labeler N times (default 3) per transcript, reports per-field agreement with ground truth and self-consistency across runs (exact match for enums, Jaccard for beats).
- Any enum with self-consistency < 0.8 flags its definition as overlapping → fix the codebook, bump version.
- Bumping the version does not delete old labels; the backfill re-labels under the new version (the `metrics_only` split keys on the current version).

## 9. Statistics

Per metric M ∈ {views, saves, shares, engagement}:

1. **Normalize.** `r = ln(M_video / median(M of the previous 20 videos by posted_at))`. Handles account growth. First 20 videos have no baseline and are excluded.
2. **Maturity.** Only videos older than `settings.maturity_days` (default 7) count.
3. **Hit.** `hit = r ≥ quantile(r, 0.75)` over mature, baselined videos. Base rate `p0 ≈ 0.25` by construction.
4. **Per-label posterior.** Prior `Beta(α, β)` with `α+β = 4`, `α = 4·p0`. Posterior `Beta(α+hits, β+misses)`. Report mean and 90% credible interval. Two-of-three hits reports ≈ 0.43, not 0.67.
5. **Pairs (A,B).** Monte-Carlo, 4000 draws from each posterior:
   - Conditional gain: `Δ = P(hit|A,B) − P(hit|A)` as a distribution → mean + 90% interval.
   - Interaction: `synergy = logit P(hit|A,B) − logit P(hit|A) − logit P(hit|B) + logit p0`. >0 synergy, ≈0 additive, <0 redundant.
   - Weighted relative accuracy: `WRAcc = (n_AB / N) · (P(hit|A,B) − p0)`. Ranking key.
6. **Multiple comparisons.** Shown on the page, not hidden: "N candidate combinations screened; expect ~k of them to look this good by chance." `k = N × 0.05` at a nominal 90% interval. Nothing is called a finding.

Computed in `lib/stats/` (TypeScript) from the SQL count views. Sampling 200 pairs × 4000 draws is ~1M random numbers: milliseconds.

## 10. Suggestion engine

Candidates: all pairs (hook_device × beat, beat × beat) plus single labels with `n ≥ min_sample` for singles.

Three kinds:
- **untested_synergy** — `P(hit|A) > p0` and `P(hit|B) > p0` with interval lower bound > p0 for both, and `n_AB ≤ 1`.
- **high_uncertainty** — `n_AB` in `[2, min_sample)` and posterior mean > 1.5·p0, interval width > 0.4.
- **confirmation** — `n_AB ≥ min_sample`, interval lower bound > p0, no active hypothesis yet.

Ranking: one Thompson draw per candidate from its posterior (for untested, from the product-independence prior), score = `draw × sqrt(coverage)`; take top 3 across kinds with at most 2 of one kind. Recomputed on every dashboard load (cheap) and cached per run so the cards don't reshuffle on refresh; a "Reshuffle" action re-draws.

Rationale is templated from the numbers, e.g.:
> Negative-warning hooks hit 41% (9/22) and counter-positioning beats hit 38% (6/16), but you've never combined them. Independence predicts ~55%. Make 6 reels to find out.

Accept → `hypotheses` row (status `active`, `target_n` default 6). Dismiss → excluded for 30 days.

Hypothesis evaluation (on every load): tagged videos that are mature → `hits/n` posterior vs the hypothesis's `prior_hit_rate`. When `n ≥ target_n`: `supported` if interval lower bound > p0, `not_supported` if upper bound < prior mean, else stays `active` with "inconclusive, extend to N". Copy says "evidence, not proof".

## 11. UI

Pages (all behind auth):

- `/login` — shadcn login-01.
- `/` — Dashboard: suggestion cards → stat row → dimension explorer → cross-label heatmap → top videos table. Header: last refreshed, **Backfill** button, maturity + min-sample settings popover.
- `/videos/[id]` — embedded reel (Instagram oEmbed / `blockquote.instagram-media`), metrics with normalized ratio, hook + labels, transcript, pipeline step status, **Refresh** button, hypothesis tag picker.
- `/hypotheses` — table: status, labels, prior vs observed, progress `n/target_n`, verdict.
- `/connect` — Instagram connection card: username, token expiry, refresh button; shown automatically when no account is connected.

Visual rules: shadcn tokens only; every bar prints `hits/n`; `n < min_sample` bars at 35% opacity with the count still visible; heatmap color = posterior hit rate (blue ramp), opacity = `min(1, n / (2·min_sample))`, empty cells surface-colored; whiskers = 90% interval.

## 12. Work packages (for parallel sub-agents)

Package C is the only blocking one. Each package owns disjoint paths.

| # | Package | Owns | Depends on | Done when |
|---|---|---|---|---|
| C | Schema + seed | `supabase/migrations/*`, `supabase/seed.sql`, `lib/db/types.ts` (generated) | — | `supabase db reset` loads ~140 fake reels with metrics, transcripts, labels, 2 hypotheses; views return rows |
| A | App auth + shell | `app/login`, `app/(app)/layout.tsx`, `lib/supabase/*`, `middleware.ts`, `components/app-shell/*` | — | login works locally, unauthenticated hits redirect, signup disabled |
| B | Instagram OAuth + token store | `app/api/instagram/*`, `lib/instagram/*`, `scripts/pull-token.ts` | C (accounts table) | connect → callback → encrypted token row on hosted; `lib/instagram/client.ts` can list reels with a real token |
| D | Inngest pipeline | `inngest/*`, `app/api/inngest/route.ts`, `lib/pipeline/*` | C, B's client interface (stub OK), E's `labelTranscript()` (stub OK) | local backfill against a mocked IG client fans out, skips correctly on second run |
| E | Labeler + codebook + eval | `lib/labeler/*`, `eval/*`, `scripts/eval-labeler.ts` | C (codebooks table) | forced-tool call returns schema-valid output; eval script reports consistency |
| F | Stats + suggestions | `lib/stats/*`, `lib/suggestions/*`, view migration `supabase/migrations/*_views.sql` (coordinated with C) | C | unit checks: shrinkage, synergy sign, WRAcc ordering; suggestions computed from seed |
| G | Dashboard UI | `app/(app)/page.tsx`, `components/dashboard/*` | C (seed), F (types) | renders all five sections from seed data |
| H | Video + hypotheses UI | `app/(app)/videos/[id]`, `app/(app)/hypotheses`, `app/(app)/connect`, `components/video/*` | C, F | pages render from seed; refresh button emits event |

Order: **C ∥ A** → **B ∥ D ∥ E ∥ F ∥ G ∥ H** → integration pass (wire real client into D, real labeler into D, real stats into G) → deploy.

Shared contracts frozen before fan-out: the migrations (C), `lib/instagram/client.ts` interface, `lib/labeler/index.ts` signature, `lib/stats/types.ts`.

## 13. Risks

- Meta app review: development mode only allows the app's own testers, which is fine for a single-owner tool. Insights for media older than 2 years unavailable.
- `views` metric semantics changed in 2025 (replaces `plays`); older reels may return partial insights → treat missing as `NULL`, not 0.
- Whisper 25 MB cap: long reels skip transcription. Track how many.
- Haiku label drift between codebook versions: never mix versions in one aggregate (views filter on current version).
