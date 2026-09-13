-- Append-only column changes so create or replace works.
create or replace view public.v_top_videos with (security_invoker = true) as
select s.video_id, v.permalink, s.posted_at, l.hook_text, l.hook_device, s.owner_id,
  s.views, s.views_baseline, s.views_log_ratio, s.views_hit,
  s.saves, s.saves_baseline, s.saves_log_ratio, s.saves_hit,
  s.shares, s.shares_baseline, s.shares_log_ratio, s.shares_hit,
  s.engagement, s.engagement_baseline, s.engagement_log_ratio, s.engagement_hit,
  v.thumbnail_url
from public.v_video_scores s
join public.videos v on v.id = s.video_id
left join public.script_labels l on l.video_id = s.video_id
  and l.codebook_version = (select max(version) from public.codebooks);

create or replace view public.v_video_list with (security_invoker = true) as
select v.id, v.owner_id, v.caption, v.posted_at, v.permalink, v.thumbnail_url,
  m.views, m.saves, m.shares, m.engagement,
  s.views_log_ratio, s.saves_log_ratio,
  l.hook_text, l.hook_device, l.codebook_version,
  t.status as transcript_status,
  concat_ws(' ', v.caption, l.hook_text, l.specific_topic, t.text) as search_text
from public.videos v
left join public.video_metrics m on m.video_id = v.id
left join public.v_video_scores s on s.video_id = v.id
left join lateral (
  select hook_text, hook_device, codebook_version, specific_topic from public.script_labels
  where video_id = v.id order by codebook_version desc limit 1
) l on true
left join public.transcripts t on t.video_id = v.id;
