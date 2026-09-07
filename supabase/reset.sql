-- ================================================================
-- RESET SCRIPT — run this FIRST, once, in the SQL Editor.
-- This deletes every table/function this project created (and all
-- data in them) so schema.sql can then be run cleanly from zero,
-- with no leftover/renamed policies causing conflicts.
-- ================================================================

drop table if exists
  admin_actions,
  neighborhood_follows,
  follows,
  bookmarks,
  mutes,
  blocks,
  notifications,
  reports,
  admin_messages,
  direct_messages,
  announcements,
  message_likes,
  app_settings,
  channel_messages,
  likes,
  comments,
  photos,
  neighborhoods,
  profiles
cascade;

drop function if exists public.handle_new_user cascade;
drop function if exists public.notify_new_comment cascade;
drop function if exists public.notify_new_dm cascade;
drop function if exists public.notify_neighborhood_followers cascade;
drop function if exists public.notify_announcement cascade;
drop function if exists public.enforce_post_limit cascade;
drop function if exists public.set_user_ban cascade;
drop function if exists public.notify_new_follow cascade;
drop function if exists public.notify_new_like cascade;
drop function if exists public.is_banned cascade;

-- Storage policies (the buckets themselves are left alone — only the
-- access rules are dropped, since schema.sql recreates them).
drop policy if exists "public can view photo files" on storage.objects;
drop policy if exists "users can upload to their own folder" on storage.objects;
drop policy if exists "users can delete their own photo files" on storage.objects;
drop policy if exists "public can view avatar files" on storage.objects;
drop policy if exists "users can upload their own avatar" on storage.objects;
drop policy if exists "users can replace their own avatar" on storage.objects;
