-- Append caption so the dashboard can fall back to it for reels with no speech.
create or replace view public.v_top_videos with (security_invoker = true) as
select s.video_id, v.permalink, s.posted_at, l.hook_text, l.hook_device, s.owner_id,
  s.views, s.views_baseline, s.views_log_ratio, s.views_hit,
  s.saves, s.saves_baseline, s.saves_log_ratio, s.saves_hit,
  s.shares, s.shares_baseline, s.shares_log_ratio, s.shares_hit,
  s.engagement, s.engagement_baseline, s.engagement_log_ratio, s.engagement_hit,
  v.thumbnail_url, v.caption
from public.v_video_scores s
join public.videos v on v.id = s.video_id
left join public.script_labels l on l.video_id = s.video_id
  and l.codebook_version = (select max(version) from public.codebooks);
