// Deterministic fake-data generator. `node supabase/seed/gen.mjs > supabase/seed.sql`
// ponytail: all numbers hand-tuned for an interesting dashboard, not for realism.
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

let seed = 42
const rnd = () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
const pick = (a) => a[Math.floor(rnd() * a.length)]
const between = (lo, hi) => lo + rnd() * (hi - lo)
const gauss = () => Math.sqrt(-2 * Math.log(1 - rnd())) * Math.cos(2 * Math.PI * rnd())
const uuid = (n, tag) => `${tag}0000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const q = (s) => s == null ? 'null' : `'${String(s).replace(/'/g, "''")}'`
const ts = (d) => `'${d.toISOString()}'`

const OWNER = '00000000-0000-0000-0000-000000000001'
const N = 140, LABELED = 130, SKIPPED = 2 // 130 ok transcripts+labels, 2 too large, 8 untouched (newest)
const NOW = Date.now(), DAY = 86400e3
const TOPICS = ['productivity', 'ai_tools', 'career', 'content_creation', 'health', 'money']
const TOPIC_WORDS = {
  productivity: { thing: 'your to-do list', action: 'time blocking', outcome: 'a calm week', number: '3' },
  ai_tools: { thing: 'ChatGPT', action: 'prompting from scratch', outcome: 'a usable draft', number: '5' },
  career: { thing: 'your resume', action: 'applying on LinkedIn', outcome: 'a real interview', number: '4' },
  content_creation: { thing: 'your hook', action: 'posting daily', outcome: 'ten thousand views', number: '7' },
  health: { thing: 'your sleep', action: 'skipping breakfast', outcome: 'stable energy', number: '2' },
  money: { thing: 'your savings rate', action: 'budgeting apps', outcome: 'an extra grand a month', number: '6' },
}
const HOOKS = { // device -> [template] ; weights uneven
  question: ['Why does {thing} keep failing you?', 'What if {action} is the reason you never get {outcome}?'],
  bold_claim: ['{action} is the single fastest path to {outcome}.', 'You can fix {thing} in {number} days.'],
  negative_warning: ['Stop {action} right now if you want {outcome}.', 'Never touch {thing} before you hear this.'],
  curiosity_gap: ['Nobody talks about the {number}-second trick for {thing}.', 'There is one thing about {action} I wish I knew earlier.'],
  contrarian: ['{action} is a scam and everyone is doing it anyway.', 'Forget {thing}. It does not matter.'],
  direct_address: ['If you are still stuck on {thing}, this one is for you.', 'You, yes you, need to stop obsessing over {thing}.'],
  story_open: ['Last year {action} nearly broke me.', 'I spent {number} months on {thing} and learned one thing.'],
  list_promise: ['{number} ways to fix {thing} this week.', 'Here are {number} rules for {action} that actually work.'],
}
const DEVICE_WEIGHTS = { question: 22, bold_claim: 22, curiosity_gap: 18, direct_address: 15, negative_warning: 14, contrarian: 14, story_open: 9, list_promise: 8 }
const BEAT_ORDER = ['context', 'problem', 'counter_positioning', 'proof', 'steps', 'example', 'payoff', 'cta', 'aside']
const BEAT_LINES = {
  context: 'Quick context: I have been doing this for years and I kept getting it wrong.',
  problem: 'The problem is that most advice ignores how {thing} actually behaves.',
  counter_positioning: 'Everyone says to double down on {action}, and that is exactly backwards.',
  proof: 'When I switched, my results went from nothing to {outcome} in {number} weeks.',
  steps: 'Step one, audit {thing}. Step two, cut {action}. Step three, track it for {number} days.',
  example: 'For example, a friend tried this last month and got {outcome} without changing anything else.',
  payoff: 'Do this and {outcome} stops being a goal and becomes your baseline.',
  cta: 'Save this so you actually try it, and follow for part two.',
  aside: 'Side note, this works even if you hate {action}.',
}
const fill = (t, w) => t.replace(/\{(\w+)\}/g, (_, k) => w[k])

const weighted = (w) => { let r = rnd() * Object.values(w).reduce((a, b) => a + b); for (const [k, v] of Object.entries(w)) { if ((r -= v) < 0) return k } }

// --- videos ---
const videos = []
for (let i = 0; i < N; i++) {
  const posted = new Date(NOW - (N - 1 - i) * 3 * DAY - between(0, 1.5) * DAY)
  videos.push({ id: uuid(i, 'a'), i, posted, topic: pick(TOPICS), dur: Math.round(between(18, 75)) })
}
// --- labels (structure baked in) ---
const questionSteps = new Set()
while (questionSteps.size < 4) questionSteps.add(20 + Math.floor(rnd() * (LABELED - 20))) // ≥20 so all 4 are baselined + mature
for (const v of videos.slice(0, LABELED)) {
  const device = questionSteps.has(v.i) ? 'question' : weighted(DEVICE_WEIGHTS)
  let pool = BEAT_ORDER.filter((b) => b !== 'hook')
  if (device === 'negative_warning') pool = pool.filter((b) => b !== 'counter_positioning')
  if (device === 'question') pool = pool.filter((b) => b !== 'steps')
  const k = 2 + Math.floor(rnd() * 4) // 2..5 beats after hook
  const chosen = new Set()
  if (questionSteps.has(v.i)) chosen.add('steps')
  if ((device === 'bold_claim' || device === 'contrarian') && rnd() < 0.6) chosen.add('proof')
  while (chosen.size < k) chosen.add(pick(pool))
  const beats = ['hook', ...BEAT_ORDER.filter((b) => chosen.has(b))]
  const w = TOPIC_WORDS[v.topic]
  const template = pick(HOOKS[device])
  const hook = fill(template, w)
  v.label = { device, beats, template, hook, transcript: [hook, ...beats.slice(1).map((b) => fill(BEAT_LINES[b], w))].join(' ') }
}
// --- metrics: baseline 6K → 20K, lognormal noise, structural boosts ---
for (const v of videos) {
  const base = 6000 * Math.pow(20000 / 6000, v.i / (N - 1))
  let shift = 0
  const l = v.label
  if (l) {
    if (l.device === 'negative_warning' || l.device === 'contrarian') shift += 0.45
    if (l.device === 'bold_claim' && l.beats.includes('proof')) shift += 0.7
    if (l.beats.includes('cta')) shift -= 0.1
  }
  const views = Math.round(base * Math.exp(shift + 0.45 * gauss()))
  const saveShift = l && l.beats.includes('steps') ? 0.4 : 0
  v.m = {
    views,
    saves: Math.round(views * between(0.01, 0.04) * Math.exp(saveShift)),
    shares: Math.round(views * between(0.004, 0.02)),
    likes: Math.round(views * between(0.03, 0.06)),
    comments: Math.round(views * between(0.002, 0.008)),
    reach: Math.round(views * between(0.8, 0.95)),
  }
}

// --- SQL ---
const out = []
out.push(`-- GENERATED by supabase/seed/gen.mjs — do not edit by hand.`)
out.push(`insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change, email_change_token_new)
values ('00000000-0000-0000-0000-000000000000', '${OWNER}', 'authenticated', 'authenticated', 'lukefrmiller@gmail.com', crypt('password123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '');`)
out.push(`insert into auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
values ('${OWNER}', '${OWNER}', '${OWNER}', 'email', '{"sub":"${OWNER}","email":"lukefrmiller@gmail.com","email_verified":true}', now(), now(), now());`)
out.push(`insert into public.settings (id, owner_id) values (1, '${OWNER}');`)
out.push(`insert into public.instagram_accounts (owner_id, ig_user_id, username, token_ciphertext, token_iv, token_expires_at, token_refreshed_at, followers_count)
values ('${OWNER}', '17841400000000001', 'algosoup_dev', decode('deadbeefcafebabe0123456789abcdef', 'hex'), decode('000102030405060708090a0b', 'hex'), now() + interval '45 days', now() - interval '3 days', 48210);`)

const rows = (table, cols, vals) => out.push(`insert into public.${table} (${cols}) values\n${vals.join(',\n')};`)
rows('videos', 'id, owner_id, ig_media_id, permalink, caption, posted_at, duration_s, thumbnail_url', videos.map((v) =>
  `(${q(v.id)}, '${OWNER}', '1790${String(v.i).padStart(13, '0')}', 'https://www.instagram.com/reel/C${v.i.toString(36).toUpperCase().padStart(10, 'x')}/', ${q(`Reel ${v.i + 1} about ${v.topic.replace('_', ' ')}`)}, ${ts(v.posted)}, ${v.dur}, 'https://placehold.co/540x960?text=${v.i + 1}')`))
const mcols = 'video_id, owner_id, views, saves, shares, likes, comments, reach, fetched_at'
const mvals = (v, m, at) => `(${q(v.id)}, '${OWNER}', ${m.views}, ${m.saves}, ${m.shares}, ${m.likes}, ${m.comments}, ${m.reach}, ${ts(at)})`
const fetched = new Date(NOW - 2 * 3600e3)
rows('video_metrics', mcols, videos.map((v) => mvals(v, v.m, fetched)))
rows('video_metric_snapshots', mcols, videos.flatMap((v) => {
  const early = Object.fromEntries(Object.entries(v.m).map(([k, x]) => [k, Math.round(x * 0.6)]))
  const t1 = new Date(v.posted.getTime() + 2 * DAY)
  return t1 < fetched ? [mvals(v, early, t1), mvals(v, v.m, fetched)] : [mvals(v, v.m, fetched)]
}))
rows('transcripts', 'video_id, owner_id, text, language, model, duration_s, status', videos.slice(0, LABELED + SKIPPED).map((v) =>
  v.label ? `(${q(v.id)}, '${OWNER}', ${q(v.label.transcript)}, 'en', 'whisper-1', ${v.dur}, 'ok')`
    : `(${q(v.id)}, '${OWNER}', null, null, 'whisper-1', null, 'skipped_too_large')`))
rows('script_labels', 'video_id, owner_id, codebook_version, hook_text, hook_device, hook_template, beats, broad_topic, specific_topic, notes, model, raw', videos.filter((v) => v.label).map((v) =>
  `(${q(v.id)}, '${OWNER}', 1, ${q(v.label.hook)}, '${v.label.device}', ${q(v.label.template)}, '{${v.label.beats.join(',')}}', '${v.topic}', ${q(TOPIC_WORDS[v.topic].thing)}, null, 'claude-haiku-4-5-20251001', '{"seed":true}')`))

// --- hypotheses ---
const labeled = videos.filter((v) => v.label)
const withPair = (d, b) => labeled.filter((v) => v.label.device === d && v.label.beats.includes(b))
const H = [
  { id: uuid(1, 'b'), kind: 'high_uncertainty', labels: { hook_device: 'contrarian', beat: 'proof' }, status: 'active', prior: 0.25, videos: withPair('contrarian', 'proof').slice(-2), closed: null,
    rationale: 'Contrarian hooks hit well above base rate but you have only paired them with proof twice. Make 6 reels to find out.' },
  { id: uuid(2, 'b'), kind: 'confirmation', labels: { hook_device: 'bold_claim', beat: 'proof' }, status: 'supported', prior: 0.25, videos: withPair('bold_claim', 'proof').slice(-6), closed: new Date(NOW - 20 * DAY),
    rationale: 'Bold claim followed by proof hits roughly twice the base rate. Confirm with 6 more reels.' },
  { id: uuid(3, 'b'), kind: 'high_uncertainty', labels: { hook_device: 'question', beat: 'example' }, status: 'not_supported', prior: 0.25, videos: withPair('question', 'example').slice(-6), closed: new Date(NOW - 60 * DAY),
    rationale: 'Question hooks with a worked example looked promising on 3 reels. Extend to 6.' },
]
rows('hypotheses', 'id, owner_id, kind, labels, metric, rationale, prior_hit_rate, target_n, status, created_at, closed_at', H.map((h) =>
  `(${q(h.id)}, '${OWNER}', '${h.kind}', ${q(JSON.stringify(h.labels))}, 'views', ${q(h.rationale)}, ${h.prior}, 6, '${h.status}', ${ts(new Date(NOW - 90 * DAY))}, ${h.closed ? ts(h.closed) : 'null'})`))
rows('hypothesis_videos', 'hypothesis_id, video_id, owner_id', H.flatMap((h) => h.videos.map((v) => `(${q(h.id)}, ${q(v.id)}, '${OWNER}')`)))

// --- pipeline run ---
const RUN = uuid(1, 'c')
out.push(`insert into public.pipeline_runs (id, owner_id, kind, status, total, done, failed, started_at, finished_at)
values ('${RUN}', '${OWNER}', 'backfill', 'finished', ${N}, ${N}, 0, ${ts(new Date(NOW - 3 * 3600e3))}, ${ts(fetched)});`)
rows('pipeline_steps', 'run_id, video_id, owner_id, step, status, finished_at', videos.flatMap((v) => {
  const s = [['metrics', 'done']]
  if (v.i < LABELED + SKIPPED) s.push(['transcribe', v.label ? 'done' : 'skipped'], ['label', v.label ? 'done' : 'skipped'])
  return s.map(([step, st]) => `('${RUN}', ${q(v.id)}, '${OWNER}', '${step}', '${st}', ${ts(fetched)})`)
}))

writeFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'seed.sql'), out.join('\n\n') + '\n')
