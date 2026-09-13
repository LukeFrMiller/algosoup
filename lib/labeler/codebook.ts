import { BEATS, HOOK_DEVICES, type Beat, type HookDevice } from './types'

export const CODEBOOK_VERSION = 1

type Entry = { def: string; pos: string; neg: string }

// Each `neg` names the value a careless reader would confuse it with and where it actually belongs.
const HOOK_DEFS: Record<HookDevice, Entry> = {
  question: {
    def: 'Opens with a genuine interrogative aimed at the viewer whose answer is left open (the viewer is meant to self-identify or wonder). Decision rule: the hook ends on the "?" with the answer left to the viewer. If the speaker answers their own question within hook_text or in the very next sentence ("Why X? Because Y."), the "?" is decoration and the label is bold_claim, never question.',
    pos: '"Do you ever open Instagram to post and then just... scroll for forty minutes?"',
    neg: '"Why do 90% of creators fail? Because they post without a hook." — the question is answered instantly with an assertion → bold_claim.',
  },
  bold_claim: {
    def: 'Opens with a confident, surprising assertion of fact or outcome stated as settled truth ("X is the reason...", "This one change doubled..."). Includes rhetorical questions that are immediately answered by a claim ("Why X? Because Y." is a bold_claim about Y). Decision rule: the hook asserts something; it does not warn, invert consensus, or withhold. A leading "?" does not change this.',
    pos: '"Your first three seconds decide 80% of your reach."',
    neg: '"Everyone says post daily. That advice is killing your account." — the claim exists only to reverse a stated common belief → contrarian.',
  },
  negative_warning: {
    def: 'Opens by telling the viewer to STOP or AVOID a specific action, or by naming a mistake they are probably making, framed as loss or harm to them. Decision rule: imperative "stop/don\'t/never/avoid" or "the mistake you\'re making", and the target is a behaviour, not a belief.',
    pos: '"Stop putting your call to action at the end of the video."',
    neg: '"Everyone says you need a CTA. You don\'t." — it attacks a common opinion rather than a viewer behaviour → contrarian.',
  },
  curiosity_gap: {
    def: 'Opens by explicitly promising information it deliberately withholds ("the one thing nobody tells you", "wait until you see #3"). Decision rule: the hook signals that a secret/reveal is coming and does not state it yet; no claim is made about what the answer is.',
    pos: '"There\'s a setting buried in Instagram that most people never touch, and it changed my views overnight."',
    neg: '"Here are 3 settings to change today." — the count and the content are announced up front, nothing withheld → list_promise.',
  },
  contrarian: {
    def: 'Opens by naming a widely-held belief or common advice and rejecting it ("everyone says X, X is wrong"). Decision rule: a consensus is quoted or implied AND then negated. If no consensus is referenced, it is bold_claim or negative_warning.',
    pos: '"Posting every day is the worst advice in this industry."',
    neg: '"Never post before 6am." — a plain instruction to avoid a behaviour, no consensus quoted → negative_warning.',
  },
  direct_address: {
    def: 'Opens by singling out the viewer or a named segment in second person ("If you\'re a..." / "This is for the people who...") as the primary device. Decision rule: the first sentence\'s job is to say who this is for; it is not itself a question, claim, or warning.',
    pos: '"If you run a small bakery and you\'re posting reels nobody watches, this is for you."',
    neg: '"You\'re making this mistake in every reel." — second person is present but the sentence functions as a warning about a behaviour → negative_warning.',
  },
  story_open: {
    def: 'Opens in narrative mode: a specific past moment with a person (often "I"), a time, and an event ("Last Tuesday I..."). Decision rule: the first sentence is an anecdote with a temporal anchor or scene, not a fact about the world.',
    pos: '"Two years ago I posted a reel from my kitchen floor that got four views."',
    neg: '"Most bakeries lose money on custom cakes." — a general fact about a situation, no scene, no time → bold_claim (background like this later in the script is the context beat).',
  },
  list_promise: {
    def: 'Opens by promising an enumerated set ("3 ways", "five tools", "every mistake") that the script will deliver. Decision rule: a number or "all/every" plus a plural noun in the first sentence.',
    pos: '"Here are the 4 hooks I use on every single reel."',
    neg: '"The one thing I do before every reel." — a single withheld item, no enumeration → curiosity_gap.',
  },
  demonstration: {
    def: 'Opens by showing rather than telling: narrating an action in progress or describing what is on screen ("watch this", "I\'m going to do X right now", "here\'s what happens when..."). Decision rule: present-tense action the viewer is invited to watch.',
    pos: '"Watch what happens when I add a caption in the first frame."',
    neg: '"Last week I tested captions in the first frame." — past-tense anecdote, not an action being shown now → story_open.',
  },
  social_proof: {
    def: 'Opens by citing results, numbers, or endorsements attached to a person or group ("this got 2M views", "my client went from...", "the top 1% of creators all do..."). Decision rule: a specific result or crowd behaviour is the lead, cited as evidence that something works.',
    pos: '"This exact script got me 1.2 million views in a week."',
    neg: '"Reels with captions get 40% more watch time." — a general claim about the world, no attributed result → bold_claim.',
  },
}

const BEAT_DEFS: Record<Beat, Entry> = {
  hook: {
    def: 'The opening attention-grab, always the first beat. Covers the sentence(s) in hook_text and nothing more.',
    pos: '"Stop putting your call to action at the end of the video."',
    neg: 'A second attention-grab mid-script ("and here\'s the part nobody expects") is not a second hook → aside or payoff depending on function.',
  },
  context: {
    def: 'Neutral background the viewer needs to follow the rest: who the speaker is, what the situation is, definitions. Decision rule: it informs, it does not identify a pain or take a side.',
    pos: '"For those who don\'t know, I run a two-person bakery and post three reels a week."',
    neg: '"For two years I posted daily and nothing worked." — background that names the pain → problem.',
  },
  problem: {
    def: 'Names the pain, mistake, or obstacle the script is about to solve. Decision rule: something is wrong, and it is framed as a cost to the viewer.',
    pos: '"Most of you are losing viewers in the first second because the text is too small to read."',
    neg: '"The gurus tell you to post daily; that\'s exactly why you\'re burnt out." — the problem is attributed to a rival approach → counter_positioning.',
  },
  counter_positioning: {
    def: 'Contrasts the speaker\'s approach against a named alternative (gurus, common advice, the old way) to make the alternative look wrong. Decision rule: an "us vs them" or "instead of X" framing.',
    pos: '"Everyone tells you to batch ten reels a day. I do the opposite: one reel, one idea."',
    neg: '"The problem is you have no system." — names the pain without a rival approach → problem.',
  },
  proof: {
    def: 'Evidence that the claim or method works: numbers, screenshots, results, credentials, testimonials. Decision rule: it answers "why should I believe you".',
    pos: '"That change took my average watch time from 4 seconds to 11."',
    neg: '"Here\'s a reel I made last month using this idea." — a concrete instance to illustrate the method, not evidence of results → example.',
  },
  steps: {
    def: 'The how-to: an ordered or enumerated set of actions the viewer should take. Decision rule: two or more instructions in sequence ("first... then...", "step one...").',
    pos: '"First, write your hook. Second, cut everything before it. Third, put the CTA in the middle."',
    neg: '"Here\'s what I did on Tuesday: I posted at 6am and it flopped." — a single narrated instance, not instructions → example.',
  },
  example: {
    def: 'A concrete illustration of the idea in action (a specific reel, client, moment) used to make it vivid. Decision rule: one specific case, told to illustrate rather than to instruct or to prove results.',
    pos: '"Take my pretzel reel: the hook was "this is the wrong way to twist", and that\'s the whole video."',
    neg: '"My pretzel reel got 800k views." — the case is cited for its result → proof.',
  },
  payoff: {
    def: 'The reveal or key takeaway that resolves the hook: the answer, the punchline, the "so what". Decision rule: if the viewer could stop after this and feel the hook was satisfied, it is the payoff.',
    pos: '"So the real reason your reels flop isn\'t the hook, it\'s that you never pause."',
    neg: '"And that\'s how I got to 100k." — a closing result citation, not a resolution of the hook\'s promise → proof.',
  },
  cta: {
    def: 'An explicit ask of the viewer: follow, comment, save, share, DM, buy, click. Decision rule: an imperative directed at the viewer about engagement or a next step, usually at the end.',
    pos: '"Comment BAKE and I\'ll send you the template."',
    neg: '"Go try this on your next reel." — an instruction to apply the method, not an engagement ask → steps (or payoff if it is the closing takeaway).',
  },
  aside: {
    def: 'A tangent, joke, self-correction, or meta remark that does not advance the argument. Decision rule: it could be deleted without changing what the viewer learns.',
    pos: '"Ignore the flour on my shirt, it\'s been a day."',
    neg: '"And by the way, this is exactly why your engagement dropped." — framed as a tangent but it names the pain → problem.',
  },
}

const render = (name: string, defs: Record<string, Entry>) =>
  Object.entries(defs)
    .map(([k, e]) => `### ${k}\n${e.def}\nPositive: ${e.pos}\nNegative boundary: ${e.neg}`)
    .join('\n\n')

export const SYSTEM_PROMPT = `You are a labeler for short-form video (reel) transcripts. You will receive one transcript as the user message and must call the label_script tool exactly once with your labels. Follow this codebook strictly; when two values seem to fit, apply the decision rule and pick exactly one.

# Output fields

- hook_text: copied VERBATIM from the transcript. The first 1–2 sentences that function as the attention-grab. Do not paraphrase, do not fix typos, do not exceed 200 characters. If the transcript opens with filler ("hey guys", "okay so"), skip the filler and start at the first sentence that does work.
- hook_device: exactly one value from the hook_device enum below. Classify the hook_text alone, not the whole script.
- hook_template: hook_text with the specifics replaced by {snake_case_slots}, e.g. "Stop doing {common_action} if you want {outcome}". Keep the sentence structure; only swap the nouns/verbs that are specific to this video. Use a slot name that names the ROLE of the thing replaced.
- beats: the script's structure in order of appearance, 2–8 items. The first item is always "hook". Collapse consecutive duplicates (context, context, problem → context, problem). A beat may reappear later if a different beat sits between.
- broad_topic: 2–3 lowercase words joined by underscores naming the subject area (e.g. "content_strategy", "sourdough_baking", "small_business_pricing"). Free text in this codebook version.
- specific_topic: what this particular video is about, ≤ 60 characters, plain lowercase phrase.
- notes: only for things the schema cannot capture (e.g. "transcript is cut off mid-sentence", "hook is in Spanish"). Otherwise omit.

# hook_device (choose one)

${render('hook_device', HOOK_DEFS)}

# beats (ordered list)

${render('beat', BEAT_DEFS)}
`

/** Enums + one-line definitions, stored in codebooks.definition by the pipeline. */
export const codebookDefinition = {
  version: CODEBOOK_VERSION,
  hook_device: Object.fromEntries(HOOK_DEVICES.map((k) => [k, HOOK_DEFS[k].def])),
  beat: Object.fromEntries(BEATS.map((k) => [k, BEAT_DEFS[k].def])),
}
