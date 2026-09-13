-- 1. Full-text search index on transcripts; v_video_list exposes a tsvector so search hits the index.
alter table public.transcripts add column search tsvector
  generated always as (to_tsvector('english', coalesce(text, ''))) stored;
create index transcripts_search_idx on public.transcripts using gin (search);

create or replace view public.v_video_list with (security_invoker = true) as
select v.id, v.owner_id, v.caption, v.posted_at, v.permalink, v.thumbnail_url,
  m.views, m.saves, m.shares, m.engagement,
  s.views_log_ratio, s.saves_log_ratio,
  l.hook_text, l.hook_device, l.codebook_version,
  t.status as transcript_status,
  concat_ws(' ', v.caption, l.hook_text, l.specific_topic, t.text) as search_text,
  to_tsvector('english', concat_ws(' ', v.caption, l.hook_text, l.specific_topic)) || coalesce(t.search, ''::tsvector) as search_tsv
from public.videos v
left join public.video_metrics m on m.video_id = v.id
left join public.v_video_scores s on s.video_id = v.id
left join lateral (
  select hook_text, hook_device, codebook_version, specific_topic from public.script_labels
  where video_id = v.id order by codebook_version desc limit 1
) l on true
left join public.transcripts t on t.video_id = v.id;

-- 2. v_pair_counts computed the scores view three times (once per referenced view). CTEs compute it once.
create or replace view public.v_pair_counts with (security_invoker = true) as
with h as materialized (select video_id, metric, hit from public.v_video_hits),
lab as materialized (
  select video_id, dimension, value from public.v_label_long
  where dimension in ('hook_device', 'beat') and value <> 'hook'
),
dc as materialized (
  select l.dimension, l.value, h.metric, count(*)::int as n, count(*) filter (where h.hit)::int as hits
  from lab l join h on h.video_id = l.video_id
  group by 1, 2, 3
),
vals as (select distinct dimension, value from lab),
cand as (
  select a.dimension as dim_a, a.value as val_a, b.dimension as dim_b, b.value as val_b
  from vals a join vals b on
    (a.dimension = 'hook_device' and b.dimension = 'beat')
    or (a.dimension = 'beat' and b.dimension = 'beat' and a.value < b.value)
),
pc as materialized (
  select a.dimension as dim_a, a.value as val_a, b.dimension as dim_b, b.value as val_b, h.metric,
    count(*)::int as n, count(*) filter (where h.hit)::int as hits
  from lab a
  join lab b on b.video_id = a.video_id
  join h on h.video_id = a.video_id
  group by 1, 2, 3, 4, 5
)
select c.dim_a, c.val_a, c.dim_b, c.val_b, da.metric,
  coalesce(pc.n, 0) as n, coalesce(pc.hits, 0) as hits,
  da.n as n_a, da.hits as hits_a, db.n as n_b, db.hits as hits_b
from cand c
join dc da on da.dimension = c.dim_a and da.value = c.val_a
join dc db on db.dimension = c.dim_b and db.value = c.val_b and db.metric = da.metric
left join pc on pc.dim_a = c.dim_a and pc.val_a = c.val_a and pc.dim_b = c.dim_b and pc.val_b = c.val_b and pc.metric = da.metric;
