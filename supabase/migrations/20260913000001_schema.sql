-- AlgoSoup schema (PRD §6). Single owner; every owner-scoped table has owner_id + RLS.

create table public.codebooks (
  version int primary key,
  definition jsonb not null,
  system_prompt text not null,
  created_at timestamptz not null default now()
);

create table public.settings (
  id int primary key default 1 check (id = 1),
  owner_id uuid not null references auth.users (id) on delete cascade,
  maturity_days int not null default 7,
  min_sample int not null default 5,
  baseline_window int not null default 20,
  hit_quantile numeric not null default 0.75
);

create table public.instagram_accounts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  ig_user_id text not null unique,
  username text not null,
  token_ciphertext bytea not null,
  token_iv bytea not null,
  token_expires_at timestamptz not null,
  token_refreshed_at timestamptz,
  followers_count int,
  connected_at timestamptz not null default now()
);

create unique index instagram_accounts_owner_id_key on public.instagram_accounts (owner_id);

create table public.videos (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  ig_media_id text not null unique,
  permalink text not null,
  caption text,
  posted_at timestamptz not null,
  duration_s numeric,
  thumbnail_url text,
  created_at timestamptz not null default now()
);
create index videos_posted_at_idx on public.videos (posted_at);
create index videos_owner_id_idx on public.videos (owner_id);

create table public.video_metrics (
  video_id uuid primary key references public.videos (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  views int,
  saves int,
  shares int,
  likes int,
  comments int,
  reach int,
  engagement int generated always as (likes + comments) stored,
  fetched_at timestamptz not null default now()
);
create index video_metrics_owner_id_idx on public.video_metrics (owner_id);

create table public.video_metric_snapshots (
  id bigint generated always as identity primary key,
  video_id uuid not null references public.videos (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  views int,
  saves int,
  shares int,
  likes int,
  comments int,
  reach int,
  engagement int generated always as (likes + comments) stored,
  fetched_at timestamptz not null default now()
);
create index video_metric_snapshots_video_fetched_idx on public.video_metric_snapshots (video_id, fetched_at);
create index video_metric_snapshots_owner_id_idx on public.video_metric_snapshots (owner_id);

create table public.transcripts (
  video_id uuid primary key references public.videos (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  text text,
  language text,
  model text,
  duration_s numeric,
  status text not null check (status in ('ok', 'skipped_too_large', 'failed')),
  created_at timestamptz not null default now()
);
create index transcripts_owner_id_idx on public.transcripts (owner_id);

create table public.script_labels (
  id uuid primary key default gen_random_uuid(),
  video_id uuid not null references public.videos (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  codebook_version int not null references public.codebooks (version),
  hook_text text not null,
  hook_device text not null,
  hook_template text not null,
  beats text[] not null,
  broad_topic text not null,
  specific_topic text,
  notes text,
  model text,
  raw jsonb,
  created_at timestamptz not null default now(),
  unique (video_id, codebook_version)
);
create index script_labels_owner_id_idx on public.script_labels (owner_id);

create table public.hypotheses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('untested_synergy', 'high_uncertainty', 'confirmation')),
  labels jsonb not null,
  metric text not null check (metric in ('views', 'saves', 'shares', 'engagement')),
  rationale text,
  prior_hit_rate numeric,
  target_n int not null default 6,
  status text not null default 'active' check (status in ('active', 'supported', 'not_supported', 'abandoned')),
  created_at timestamptz not null default now(),
  closed_at timestamptz
);
create index hypotheses_owner_id_idx on public.hypotheses (owner_id);

create table public.hypothesis_videos (
  hypothesis_id uuid not null references public.hypotheses (id) on delete cascade,
  video_id uuid not null references public.videos (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  primary key (hypothesis_id, video_id)
);
create index hypothesis_videos_video_id_idx on public.hypothesis_videos (video_id);
create index hypothesis_videos_owner_id_idx on public.hypothesis_videos (owner_id);

create table public.pipeline_runs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('backfill', 'refresh_video')),
  status text not null default 'running' check (status in ('running', 'finished', 'failed')),
  total int not null default 0,
  done int not null default 0,
  failed int not null default 0,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);
create index pipeline_runs_owner_id_idx on public.pipeline_runs (owner_id);

create table public.pipeline_steps (
  id bigint generated always as identity primary key,
  run_id uuid not null references public.pipeline_runs (id) on delete cascade,
  video_id uuid not null references public.videos (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  step text not null check (step in ('metrics', 'transcribe', 'label')),
  status text not null check (status in ('done', 'skipped', 'failed')),
  error text,
  finished_at timestamptz not null default now()
);
create index pipeline_steps_run_id_idx on public.pipeline_steps (run_id);
create index pipeline_steps_video_id_idx on public.pipeline_steps (video_id);
create index pipeline_steps_owner_id_idx on public.pipeline_steps (owner_id);

-- RLS: owner sees own rows. Jobs use the service role (bypasses RLS).
alter table public.codebooks enable row level security;
create policy codebooks_read on public.codebooks for select to authenticated using (true);

alter table public.settings enable row level security;
create policy settings_owner on public.settings for all to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
alter table public.instagram_accounts enable row level security;
create policy instagram_accounts_owner on public.instagram_accounts for all to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
alter table public.videos enable row level security;
create policy videos_owner on public.videos for all to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
alter table public.video_metrics enable row level security;
create policy video_metrics_owner on public.video_metrics for all to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
alter table public.video_metric_snapshots enable row level security;
create policy video_metric_snapshots_owner on public.video_metric_snapshots for all to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
alter table public.transcripts enable row level security;
create policy transcripts_owner on public.transcripts for all to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
alter table public.script_labels enable row level security;
create policy script_labels_owner on public.script_labels for all to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
alter table public.hypotheses enable row level security;
create policy hypotheses_owner on public.hypotheses for all to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
alter table public.hypothesis_videos enable row level security;
create policy hypothesis_videos_owner on public.hypothesis_videos for all to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
alter table public.pipeline_runs enable row level security;
create policy pipeline_runs_owner on public.pipeline_runs for all to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
alter table public.pipeline_steps enable row level security;
create policy pipeline_steps_owner on public.pipeline_steps for all to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);

-- Codebook v1: enums from lib/labeler/types.ts. system_prompt is a placeholder (package E replaces it).
insert into public.codebooks (version, definition, system_prompt) values (1, '{
  "hook_device": ["question", "bold_claim", "negative_warning", "curiosity_gap", "contrarian", "direct_address", "story_open", "list_promise", "demonstration", "social_proof"],
  "beat": ["hook", "context", "problem", "counter_positioning", "proof", "steps", "example", "payoff", "cta", "aside"],
  "broad_topic": ["productivity", "ai_tools", "career", "content_creation", "health", "money"]
}', 'PLACEHOLDER: codebook v1 system prompt. Replaced by package E.');

-- Grants: RLS scopes rows; the app hits tables as `authenticated`, jobs as `service_role`. anon gets nothing.
grant usage on schema public to authenticated, service_role;
grant select on public.codebooks to authenticated;
grant select, insert, update, delete on public.settings, public.instagram_accounts, public.videos, public.video_metrics,
  public.video_metric_snapshots, public.transcripts, public.script_labels, public.hypotheses, public.hypothesis_videos,
  public.pipeline_runs, public.pipeline_steps to authenticated;
grant all on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to authenticated, service_role;
