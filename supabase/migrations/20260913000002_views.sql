-- Aggregate views (PRD §6/§9). All security_invoker (RLS of the caller applies),
-- filtered to mature videos and the current codebook version.
-- ponytail: ≤1000 videos, no materialization.

create view public.v_video_scores with (security_invoker = true) as
with s as (select maturity_days, baseline_window, hit_quantile from public.settings where id = 1),
m as (
  select v.id as video_id, v.owner_id, v.posted_at, vm.views, vm.saves, vm.shares, vm.engagement
  from public.videos v
  join public.video_metrics vm on vm.video_id = v.id
),
b as (
  select m.*,
    case when p.n = (select baseline_window from s) then p.views end as views_baseline,
    case when p.n = (select baseline_window from s) then p.saves end as saves_baseline,
    case when p.n = (select baseline_window from s) then p.shares end as shares_baseline,
    case when p.n = (select baseline_window from s) then p.engagement end as engagement_baseline
  from m
  cross join lateral (
    select count(*) as n,
      percentile_cont(0.5) within group (order by q.views) as views,
      percentile_cont(0.5) within group (order by q.saves) as saves,
      percentile_cont(0.5) within group (order by q.shares) as shares,
      percentile_cont(0.5) within group (order by q.engagement) as engagement
    from (
      select * from m q
      where q.owner_id = m.owner_id and q.posted_at < m.posted_at
      order by q.posted_at desc
      limit (select baseline_window from s)
    ) q
  ) p
  where m.posted_at < now() - make_interval(days => (select maturity_days from s))
),
r as (
  select b.*,
    ln(nullif(views, 0) / nullif(views_baseline, 0)) as views_log_ratio,
    ln(nullif(saves, 0) / nullif(saves_baseline, 0)) as saves_log_ratio,
    ln(nullif(shares, 0) / nullif(shares_baseline, 0)) as shares_log_ratio,
    ln(nullif(engagement, 0) / nullif(engagement_baseline, 0)) as engagement_log_ratio
  from b
)
select video_id, owner_id, posted_at,
  views, views_baseline, views_log_ratio,
  case when views_log_ratio is null then null else
    percent_rank() over (partition by owner_id, views_log_ratio is null order by views_log_ratio) >= (select hit_quantile from s) end as views_hit,
  saves, saves_baseline, saves_log_ratio,
  case when saves_log_ratio is null then null else
    percent_rank() over (partition by owner_id, saves_log_ratio is null order by saves_log_ratio) >= (select hit_quantile from s) end as saves_hit,
  shares, shares_baseline, shares_log_ratio,
  case when shares_log_ratio is null then null else
    percent_rank() over (partition by owner_id, shares_log_ratio is null order by shares_log_ratio) >= (select hit_quantile from s) end as shares_hit,
  engagement, engagement_baseline, engagement_log_ratio,
  case when engagement_log_ratio is null then null else
    percent_rank() over (partition by owner_id, engagement_log_ratio is null order by engagement_log_ratio) >= (select hit_quantile from s) end as engagement_hit
from r;

create view public.v_label_long with (security_invoker = true) as
select l.video_id, l.owner_id, d.dimension, d.value
from public.script_labels l
join public.videos v on v.id = l.video_id
cross join lateral (
  values ('hook_device', l.hook_device), ('broad_topic', l.broad_topic), ('hook_template', l.hook_template)
  union
  select 'beat', beat from unnest(l.beats) beat
) d (dimension, value)
where l.codebook_version = (select max(version) from public.codebooks)
  and v.posted_at < now() - make_interval(days => (select maturity_days from public.settings where id = 1));

-- (video, metric, hit) for baselined videos only
create view public.v_video_hits with (security_invoker = true) as
select s.video_id, s.owner_id, m.metric, m.hit
from public.v_video_scores s
cross join lateral (values
  ('views', s.views_hit), ('saves', s.saves_hit), ('shares', s.shares_hit), ('engagement', s.engagement_hit)
) m (metric, hit)
where m.hit is not null;

create view public.v_base_rate with (security_invoker = true) as
select metric, count(*)::int as n, count(*) filter (where hit)::int as hits
from public.v_video_hits
group by metric;

create view public.v_dimension_counts with (security_invoker = true) as
select l.dimension, l.value, h.metric, count(*)::int as n, count(*) filter (where h.hit)::int as hits
from public.v_label_long l
join public.v_video_hits h on h.video_id = l.video_id
group by l.dimension, l.value, h.metric;

-- All candidate pairs (hook_device×beat, beat×beat with val_a < val_b) × metric, including never-co-occurring pairs (n = 0).
-- 'hook' beat is on every video, so it is excluded from pairs.
create view public.v_pair_counts with (security_invoker = true) as
with lab as (
  select video_id, dimension, value from public.v_label_long
  where dimension in ('hook_device', 'beat') and value <> 'hook'
),
vals as (select distinct dimension, value from lab),
cand as (
  select a.dimension as dim_a, a.value as val_a, b.dimension as dim_b, b.value as val_b
  from vals a join vals b on
    (a.dimension = 'hook_device' and b.dimension = 'beat')
    or (a.dimension = 'beat' and b.dimension = 'beat' and a.value < b.value)
),
pc as (
  select a.dimension as dim_a, a.value as val_a, b.dimension as dim_b, b.value as val_b, h.metric,
    count(*)::int as n, count(*) filter (where h.hit)::int as hits
  from lab a
  join lab b on b.video_id = a.video_id
  join public.v_video_hits h on h.video_id = a.video_id
  group by 1, 2, 3, 4, 5
)
select c.dim_a, c.val_a, c.dim_b, c.val_b, da.metric,
  coalesce(pc.n, 0) as n, coalesce(pc.hits, 0) as hits,
  da.n as n_a, da.hits as hits_a, db.n as n_b, db.hits as hits_b
from cand c
join public.v_dimension_counts da on da.dimension = c.dim_a and da.value = c.val_a
join public.v_dimension_counts db on db.dimension = c.dim_b and db.value = c.val_b and db.metric = da.metric
left join pc on pc.dim_a = c.dim_a and pc.val_a = c.val_a and pc.dim_b = c.dim_b and pc.val_b = c.val_b and pc.metric = da.metric;

create view public.v_top_videos with (security_invoker = true) as
select s.video_id, v.permalink, s.posted_at, l.hook_text, l.hook_device, s.owner_id,
  s.views, s.views_baseline, s.views_log_ratio, s.views_hit,
  s.saves, s.saves_baseline, s.saves_log_ratio, s.saves_hit,
  s.shares, s.shares_baseline, s.shares_log_ratio, s.shares_hit,
  s.engagement, s.engagement_baseline, s.engagement_log_ratio, s.engagement_hit
from public.v_video_scores s
join public.videos v on v.id = s.video_id
left join public.script_labels l on l.video_id = s.video_id
  and l.codebook_version = (select max(version) from public.codebooks);

grant select on public.v_video_scores, public.v_label_long, public.v_video_hits, public.v_base_rate,
  public.v_dimension_counts, public.v_pair_counts, public.v_top_videos to authenticated, service_role;
