-- One row per video with everything the /videos list needs, so the page can sort and paginate in SQL.
create view public.v_video_list with (security_invoker = true) as
select v.id, v.owner_id, v.caption, v.posted_at, v.permalink, v.thumbnail_url,
  m.views, m.saves, m.shares, m.engagement,
  s.views_log_ratio, s.saves_log_ratio,
  l.hook_text, l.hook_device, l.codebook_version,
  t.status as transcript_status
from public.videos v
left join public.video_metrics m on m.video_id = v.id
left join public.v_video_scores s on s.video_id = v.id
left join lateral (
  select hook_text, hook_device, codebook_version from public.script_labels
  where video_id = v.id order by codebook_version desc limit 1
) l on true
left join public.transcripts t on t.video_id = v.id;

grant select on public.v_video_list to authenticated, service_role;
