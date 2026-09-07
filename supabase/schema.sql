-- Run this whole file once in the Supabase SQL Editor (project → SQL Editor → New query).
-- This is a full rewrite — if you ran an older version of this file before,
-- run the commented "drop" block at the very bottom first, then run
-- everything above it again.

create extension if not exists pgcrypto;

-- 1. Profiles ---------------------------------------------------------
-- One row per user, created automatically on signup (see trigger below).
-- This is what lets comments show a username + avatar instead of a raw id.
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  phone text,
  avatar_path text,
  created_at timestamptz not null default now()
);

-- Auto-create a profile row whenever someone signs up. Runs as the
-- database owner (security definer), so it works even before the
-- user's email is confirmed / before they have a client session.
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, username, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', 'user_' || substr(new.id::text, 1, 8)),
    new.raw_user_meta_data->>'phone'
  );
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 2. Neighborhoods -----------------------------------------------------
create table neighborhoods (
  id serial primary key,
  name_fa text not null,
  name_ckb text not null
);

insert into neighborhoods (name_fa, name_ckb) values
  ('مرکز شهر', 'ناوەندی شار'),
  ('کانی زل', 'کانی زەل'),
  ('باغچه', 'باخچە'),
  ('نوروزی', 'نەورۆزی');
-- edit/add your city's real neighborhoods here

-- 3. Photos (and videos) --------------------------------------------------
create table photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  neighborhood_id int references neighborhoods(id),
  image_path text not null,       -- path inside the "photos" storage bucket
  caption text,
  language text,                  -- 'fa' | 'ckb', informational only
  media_type text not null default 'image' check (media_type in ('image', 'video')),
  post_type text not null default 'beauty' check (post_type in ('beauty', 'issue')),
  created_at timestamptz not null default now()
);

-- 4. Comments --------------------------------------------------------------
create table comments (
  id uuid primary key default gen_random_uuid(),
  photo_id uuid not null references photos(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  text text not null,
  created_at timestamptz not null default now()
);

-- 5. Likes --------------------------------------------------------------
create table likes (
  photo_id uuid not null references photos(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (photo_id, user_id)
);

-- 6. City channel — a shared live text chat, separate from per-photo comments
create table channel_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  text text not null,
  created_at timestamptz not null default now()
);

-- 7. Row Level Security ---------------------------------------------------
alter table profiles enable row level security;
alter table neighborhoods enable row level security;
alter table photos enable row level security;
alter table comments enable row level security;
alter table likes enable row level security;
alter table channel_messages enable row level security;

create policy "profiles are publicly readable"
  on profiles for select using (true);
create policy "users can update their own profile"
  on profiles for update using (auth.uid() = id);

create policy "neighborhoods are publicly readable"
  on neighborhoods for select using (true);

create policy "photos are publicly readable"
  on photos for select using (true);
create policy "users can insert their own photos"
  on photos for insert with check (auth.uid() = user_id);
create policy "users can delete their own photos"
  on photos for delete using (auth.uid() = user_id);

create policy "comments are publicly readable"
  on comments for select using (true);
create policy "authenticated users can add comments"
  on comments for insert with check (auth.uid() = user_id);
create policy "users can delete their own comments"
  on comments for delete using (auth.uid() = user_id);

create policy "likes are publicly readable"
  on likes for select using (true);
create policy "authenticated users can like"
  on likes for insert with check (auth.uid() = user_id);
create policy "users can remove their own like"
  on likes for delete using (auth.uid() = user_id);

create policy "channel messages are publicly readable"
  on channel_messages for select using (true);
create policy "authenticated users can post to channel"
  on channel_messages for insert with check (auth.uid() = user_id);

-- Let the city channel update live in every open browser tab without a refresh.
alter publication supabase_realtime add table channel_messages;

-- 8. Storage bucket for photo/video files ---------------------------------
-- file_size_limit is in bytes (500MB) — this is the bucket's hard ceiling
-- for everyone; only admins are allowed anywhere near it (the 30MB cap
-- for regular users is enforced in the browser upload form instead,
-- since Supabase Storage can't vary this limit by user role).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'photos', 'photos', true, 524288000,
  array['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime', 'video/webm']
)
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "public can view photo files"
  on storage.objects for select
  using (bucket_id = 'photos');

create policy "users can upload to their own folder"
  on storage.objects for insert
  with check (
    bucket_id = 'photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "users can delete their own photo files"
  on storage.objects for delete
  using (
    bucket_id = 'photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- 9. Storage bucket for profile photos -------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "public can view avatar files"
  on storage.objects for select
  using (bucket_id = 'avatars');

create policy "users can upload their own avatar"
  on storage.objects for insert
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "users can replace their own avatar"
  on storage.objects for update
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ---------------------------------------------------------------------
-- If you already ran an earlier version of this file and need to start
-- clean, run this first (uncomment), then run everything above again:
--
-- drop table if exists channel_messages, likes, comments, photos,
--   neighborhoods, profiles cascade;
-- drop function if exists public.handle_new_user cascade;

-- =======================================================================
-- SECTION 2 — admin role, channel lock, reactions, announcements,
-- direct messages, and "message the admin". Run this whole section once,
-- in addition to everything above (it does not replace it).
-- =======================================================================

-- Whichever email signs up matching this address automatically becomes
-- the site admin. Change the email below if you typed it wrong, then
-- re-run just this UPDATE (and function) after that user has signed up.
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, username, phone, is_admin)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', 'user_' || substr(new.id::text, 1, 8)),
    new.raw_user_meta_data->>'phone',
    new.email = 'monerhosinpour@gmail.com'
  );
  return new;
end;
$$ language plpgsql security definer set search_path = public;

alter table profiles add column if not exists is_admin boolean not null default false;

-- If the admin already signed up before this ran, promote them manually:
update profiles set is_admin = true
where id = (select id from auth.users where email = 'monerhosinpour@gmail.com');

-- Lock down which profile columns a user can edit themselves — RLS alone
-- can't stop someone from setting their own is_admin to true, so this
-- column-level grant is the actual defense.
revoke update on profiles from authenticated;
grant update (username, avatar_path) on profiles to authenticated;

-- Admins can delete anyone's photo/comment, not just their own.
create policy "admins can delete any photo"
  on photos for delete
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin));
create policy "admins can delete any comment"
  on comments for delete
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin));

-- Site-wide settings (one row) — currently just the channel lock.
create table app_settings (
  id boolean primary key default true,
  channel_locked boolean not null default false,
  check (id)
);
insert into app_settings (id, channel_locked) values (true, false)
on conflict (id) do nothing;

alter table app_settings enable row level security;
create policy "app settings are publicly readable"
  on app_settings for select using (true);
create policy "admins can update app settings"
  on app_settings for update
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin));

-- Replace the channel post policy so a lock actually blocks non-admins.
drop policy if exists "authenticated users can post to channel" on channel_messages;
create policy "authenticated users can post to channel"
  on channel_messages for insert
  with check (
    auth.uid() = user_id
    and (
      not exists (select 1 from app_settings where channel_locked = true)
      or exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin)
    )
  );
create policy "admins can delete channel messages"
  on channel_messages for delete
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin));

-- Reactions (likes) on channel messages.
create table message_likes (
  message_id uuid not null references channel_messages(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (message_id, user_id)
);
alter table message_likes enable row level security;
create policy "message likes are publicly readable"
  on message_likes for select using (true);
create policy "authenticated users can like messages"
  on message_likes for insert with check (auth.uid() = user_id);
create policy "users can remove their own message like"
  on message_likes for delete using (auth.uid() = user_id);
alter publication supabase_realtime add table message_likes;

-- Admin announcements shown at the top of the home page.
create table announcements (
  id uuid primary key default gen_random_uuid(),
  text text not null,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);
alter table announcements enable row level security;
create policy "announcements are publicly readable"
  on announcements for select using (true);
create policy "admins can post announcements"
  on announcements for insert
  with check (exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin));
create policy "admins can delete announcements"
  on announcements for delete
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin));

-- Direct messages between two users, shown on each other's profile page.
create table direct_messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references profiles(id) on delete cascade,
  recipient_id uuid not null references profiles(id) on delete cascade,
  text text not null,
  created_at timestamptz not null default now()
);
alter table direct_messages enable row level security;
create policy "users can read their own conversations"
  on direct_messages for select
  using (auth.uid() = sender_id or auth.uid() = recipient_id);
create policy "users can send direct messages"
  on direct_messages for insert with check (auth.uid() = sender_id);
alter publication supabase_realtime add table direct_messages;

-- "Message the admin" — a simple contact form/inbox.
create table admin_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  text text not null,
  created_at timestamptz not null default now()
);
alter table admin_messages enable row level security;
create policy "users can read their own messages to admin"
  on admin_messages for select
  using (
    auth.uid() = user_id
    or exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin)
  );
create policy "users can message the admin"
  on admin_messages for insert with check (auth.uid() = user_id);

-- =======================================================================
-- SECTION 3 — reporting inappropriate photos, and notifications for
-- new comments on your photos / new direct messages.
-- =======================================================================

-- Reports (flag a photo for the admin to review)
create table reports (
  id uuid primary key default gen_random_uuid(),
  photo_id uuid not null references photos(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table reports enable row level security;
create policy "users can report a photo"
  on reports for insert with check (auth.uid() = user_id);
create policy "admins can view reports"
  on reports for select
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin));
create policy "admins can dismiss reports"
  on reports for delete
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin));

-- Notifications (comment on your photo, or a new direct message)
create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  type text not null check (type in ('comment', 'dm')),
  content text,
  related_id uuid,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);
alter table notifications enable row level security;
create policy "users can read their own notifications"
  on notifications for select using (auth.uid() = user_id);
create policy "users can mark their own notifications read"
  on notifications for update using (auth.uid() = user_id);
alter publication supabase_realtime add table notifications;

-- Auto-notify a photo's owner when someone comments on it (not themself).
-- security definer: the commenter's own role has no insert grant on
-- other people's notification rows, so this needs to run as the owner.
create or replace function public.notify_new_comment()
returns trigger as $$
declare
  photo_owner uuid;
begin
  select user_id into photo_owner from photos where id = new.photo_id;
  if photo_owner is not null and photo_owner <> new.user_id then
    insert into notifications (user_id, type, content, related_id)
    values (photo_owner, 'comment', new.text, new.photo_id);
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger on_comment_created
  after insert on comments
  for each row execute procedure public.notify_new_comment();

-- Auto-notify a user when they receive a direct message.
create or replace function public.notify_new_dm()
returns trigger as $$
begin
  insert into notifications (user_id, type, content, related_id)
  values (new.recipient_id, 'dm', new.text, new.sender_id);
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger on_dm_created
  after insert on direct_messages
  for each row execute procedure public.notify_new_dm();

-- =======================================================================
-- SECTION 4 — blocking/muting, bookmarks, follows (users + neighborhoods),
-- edit-your-own-post/comment, 2-posts/24h limit, temporary bans, and
-- an admin activity log.
-- =======================================================================

alter table profiles add column if not exists banned_until timestamptz;

-- Let notifications also cover "a neighborhood you follow got a new photo".
alter table notifications drop constraint if exists notifications_type_check;
alter table notifications add constraint notifications_type_check
  check (type in ('comment', 'dm', 'neighborhood_photo'));

-- Blocking (stops the blocked person from DMing you; admins can't be blocked).
create table blocks (
  blocker_id uuid not null references profiles(id) on delete cascade,
  blocked_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id)
);
alter table blocks enable row level security;
create policy "users can view their own blocks"
  on blocks for select using (auth.uid() = blocker_id);
create policy "users can block others"
  on blocks for insert
  with check (
    auth.uid() = blocker_id and blocker_id <> blocked_id
    and not exists (select 1 from profiles p where p.id = blocked_id and p.is_admin)
  );
create policy "users can unblock"
  on blocks for delete using (auth.uid() = blocker_id);

-- A block also stops future direct messages in that direction.
drop policy if exists "users can send direct messages" on direct_messages;
create policy "users can send direct messages"
  on direct_messages for insert
  with check (
    auth.uid() = sender_id
    and not exists (select 1 from blocks b where b.blocker_id = recipient_id and b.blocked_id = sender_id)
  );

-- Muting (quietly hides someone's comments/channel messages for you only).
create table mutes (
  muter_id uuid not null references profiles(id) on delete cascade,
  muted_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (muter_id, muted_id)
);
alter table mutes enable row level security;
create policy "users can view their own mutes"
  on mutes for select using (auth.uid() = muter_id);
create policy "users can mute others"
  on mutes for insert with check (auth.uid() = muter_id and muter_id <> muted_id);
create policy "users can unmute"
  on mutes for delete using (auth.uid() = muter_id);

-- Bookmarks (save a photo/video for later).
create table bookmarks (
  user_id uuid not null references profiles(id) on delete cascade,
  photo_id uuid not null references photos(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, photo_id)
);
alter table bookmarks enable row level security;
create policy "users can view their own bookmarks"
  on bookmarks for select using (auth.uid() = user_id);
create policy "users can bookmark a photo"
  on bookmarks for insert with check (auth.uid() = user_id);
create policy "users can remove a bookmark"
  on bookmarks for delete using (auth.uid() = user_id);

-- Following other users.
create table follows (
  follower_id uuid not null references profiles(id) on delete cascade,
  following_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id)
);
alter table follows enable row level security;
create policy "follows are publicly readable"
  on follows for select using (true);
create policy "users can follow others"
  on follows for insert with check (auth.uid() = follower_id and follower_id <> following_id);
create policy "users can unfollow"
  on follows for delete using (auth.uid() = follower_id);

-- Following a neighborhood (get notified when it gets a new photo).
create table neighborhood_follows (
  user_id uuid not null references profiles(id) on delete cascade,
  neighborhood_id int not null references neighborhoods(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, neighborhood_id)
);
alter table neighborhood_follows enable row level security;
create policy "users can view their own neighborhood follows"
  on neighborhood_follows for select using (auth.uid() = user_id);
create policy "users can follow a neighborhood"
  on neighborhood_follows for insert with check (auth.uid() = user_id);
create policy "users can unfollow a neighborhood"
  on neighborhood_follows for delete using (auth.uid() = user_id);

create or replace function public.notify_neighborhood_followers()
returns trigger as $$
begin
  if new.neighborhood_id is not null then
    insert into notifications (user_id, type, content, related_id)
    select nf.user_id, 'neighborhood_photo', new.caption, new.id
    from neighborhood_follows nf
    where nf.neighborhood_id = new.neighborhood_id and nf.user_id <> new.user_id;
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger on_photo_created_notify_neighborhood
  after insert on photos
  for each row execute procedure public.notify_neighborhood_followers();

-- Owners can edit/delete their own post caption and their own comments
-- (delete-your-own already existed from section 1; this adds editing).
create policy "users can update their own photo"
  on photos for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "users can update their own comment"
  on comments for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Limit: at most 2 posts per rolling 24h per user; admins are exempt.
create or replace function public.enforce_post_limit()
returns trigger as $$
declare
  admin_flag boolean;
  recent_count int;
begin
  select is_admin into admin_flag from profiles where id = new.user_id;
  if coalesce(admin_flag, false) then
    return new;
  end if;
  select count(*) into recent_count from photos
    where user_id = new.user_id and created_at > now() - interval '24 hours';
  if recent_count >= 2 then
    raise exception 'post_limit_reached';
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger before_photo_insert_limit
  before insert on photos
  for each row execute procedure public.enforce_post_limit();

-- Temporary bans: only an admin can set/clear banned_until. This runs as
-- a security-definer RPC (not a plain column update) because Supabase's
-- shared "authenticated" role can't be split into "admin vs not" at the
-- column-grant level — the function checks admin status itself instead.
create or replace function public.set_user_ban(target_user uuid, ban_until timestamptz)
returns void as $$
begin
  if not exists (select 1 from profiles where id = auth.uid() and is_admin) then
    raise exception 'not_authorized';
  end if;
  update profiles set banned_until = ban_until where id = target_user;
end;
$$ language plpgsql security definer set search_path = public;

grant execute on function public.set_user_ban(uuid, timestamptz) to authenticated;

-- Admin activity log.
create table admin_actions (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid references profiles(id) on delete set null,
  action text not null,
  target_username text,
  created_at timestamptz not null default now()
);
alter table admin_actions enable row level security;
create policy "admins can view admin actions"
  on admin_actions for select
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin));
create policy "admins can log admin actions"
  on admin_actions for insert
  with check (exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin));

-- Reports get a short reason from the reporter.
alter table reports add column if not exists reason text;

-- Admins can edit/delete announcements they (or another admin) posted.
create policy "admins can update announcements"
  on announcements for update
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin));

-- =======================================================================
-- SECTION 5 — pinning posts, announcement notifications (red badge for
-- everyone), and full name + birthdate at signup.
-- =======================================================================

alter table photos add column if not exists pinned boolean not null default false;
create policy "admins can pin any photo"
  on photos for update
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin))
  with check (exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin));

alter table profiles add column if not exists full_name text;
alter table profiles add column if not exists birthdate date;

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, username, phone, is_admin, full_name, birthdate)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', 'user_' || substr(new.id::text, 1, 8)),
    new.raw_user_meta_data->>'phone',
    new.email = 'monerhosinpour@gmail.com',
    new.raw_user_meta_data->>'full_name',
    nullif(new.raw_user_meta_data->>'birthdate', '')::date
  );
  return new;
end;
$$ language plpgsql security definer set search_path = public;

-- Everyone gets notified (red badge) when the admin posts a new
-- announcement — reuses the same notifications table/badge as comments/DMs.
alter table notifications drop constraint if exists notifications_type_check;
alter table notifications add constraint notifications_type_check
  check (type in ('comment', 'dm', 'neighborhood_photo', 'announcement'));

create or replace function public.notify_announcement()
returns trigger as $$
begin
  insert into notifications (user_id, type, content, related_id)
  select p.id, 'announcement', new.text, new.id
  from profiles p
  where p.id <> new.created_by;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger on_announcement_created
  after insert on announcements
  for each row execute procedure public.notify_announcement();

-- =======================================================================
-- SECTION 6 — separate "Messages" (private chat) from "Notifications":
-- DMs get a read/unread flag + delete-for-everyone instead of a
-- notification row; follows and likes now generate notifications;
-- online/last-seen status; admin can delete contact messages; and the
-- channel-history bug fix (see app/channel/page.tsx comment) pairs with
-- no schema change, just a query-order fix on the frontend.
-- =======================================================================

alter table direct_messages add column if not exists is_read boolean not null default false;

-- The sender can delete their own sent message — since a DM row is
-- shared by both sides, deleting the row removes it from both.
create policy "sender can delete their own direct message"
  on direct_messages for delete using (auth.uid() = sender_id);

-- The recipient can update is_read (used to clear the unread badge).
create policy "recipient can mark a message read"
  on direct_messages for update
  using (auth.uid() = recipient_id) with check (auth.uid() = recipient_id);

-- DMs no longer create a notifications row (they have their own unread
-- badge on the Messages link instead) — stop the old trigger.
drop trigger if exists on_dm_created on public.direct_messages;

alter table notifications drop constraint if exists notifications_type_check;
alter table notifications add constraint notifications_type_check
  check (type in ('comment', 'dm', 'neighborhood_photo', 'announcement', 'follow', 'like'));

create or replace function public.notify_new_follow()
returns trigger as $$
begin
  insert into notifications (user_id, type, content, related_id)
  values (new.following_id, 'follow', null, new.follower_id);
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists on_follow_created on public.follows;
create trigger on_follow_created
  after insert on public.follows
  for each row execute procedure public.notify_new_follow();

create or replace function public.notify_new_like()
returns trigger as $$
declare
  photo_owner uuid;
begin
  select user_id into photo_owner from photos where id = new.photo_id;
  if photo_owner is not null and photo_owner <> new.user_id then
    insert into notifications (user_id, type, content, related_id)
    values (photo_owner, 'like', null, new.photo_id);
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists on_like_created on public.likes;
create trigger on_like_created
  after insert on public.likes
  for each row execute procedure public.notify_new_like();

-- Online / last-seen, with a privacy toggle the user controls.
alter table profiles add column if not exists last_seen_at timestamptz;
alter table profiles add column if not exists show_activity_status boolean not null default true;
grant update (username, avatar_path, last_seen_at, show_activity_status) on profiles to authenticated;

-- Admin was missing a way to delete messages sent to them.
create policy "admins can delete messages sent to them"
  on admin_messages for delete
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin));

-- =======================================================================
-- SECTION 7 — real backend ban enforcement (not just a client-side
-- check), and showing WHO triggered each notification (follow/like/
-- comment), not just a generic message.
-- =======================================================================

create or replace function public.is_banned(check_uid uuid)
returns boolean as $$
  select coalesce((select banned_until > now() from profiles where id = check_uid), false);
$$ language sql stable;

-- Re-create the write policies with a ban check added, so a banned
-- user's still-valid session token can't be used to write directly
-- against Supabase even if the frontend ban check is bypassed.
drop policy if exists "users can insert their own photos" on photos;
create policy "users can insert their own photos"
  on photos for insert
  with check (auth.uid() = user_id and not public.is_banned(auth.uid()));

drop policy if exists "authenticated users can add comments" on comments;
create policy "authenticated users can add comments"
  on comments for insert
  with check (auth.uid() = user_id and not public.is_banned(auth.uid()));

drop policy if exists "authenticated users can like" on likes;
create policy "authenticated users can like"
  on likes for insert
  with check (auth.uid() = user_id and not public.is_banned(auth.uid()));

drop policy if exists "users can send direct messages" on direct_messages;
create policy "users can send direct messages"
  on direct_messages for insert
  with check (
    auth.uid() = sender_id
    and not public.is_banned(auth.uid())
    and not exists (select 1 from blocks b where b.blocker_id = recipient_id and b.blocked_id = sender_id)
  );

drop policy if exists "authenticated users can post to channel" on channel_messages;
create policy "authenticated users can post to channel"
  on channel_messages for insert
  with check (
    auth.uid() = user_id
    and not public.is_banned(auth.uid())
    and (
      not exists (select 1 from app_settings where channel_locked = true)
      or exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin)
    )
  );

-- Notifications now record WHO performed the action, so the UI can show
-- a clickable username instead of a generic message.
alter table notifications add column if not exists actor_id uuid references profiles(id) on delete set null;

create or replace function public.notify_new_comment()
returns trigger as $$
declare
  photo_owner uuid;
begin
  select user_id into photo_owner from photos where id = new.photo_id;
  if photo_owner is not null and photo_owner <> new.user_id then
    insert into notifications (user_id, type, content, related_id, actor_id)
    values (photo_owner, 'comment', new.text, new.photo_id, new.user_id);
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create or replace function public.notify_new_follow()
returns trigger as $$
begin
  insert into notifications (user_id, type, content, related_id, actor_id)
  values (new.following_id, 'follow', null, new.follower_id, new.follower_id);
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create or replace function public.notify_new_like()
returns trigger as $$
declare
  photo_owner uuid;
begin
  select user_id into photo_owner from photos where id = new.photo_id;
  if photo_owner is not null and photo_owner <> new.user_id then
    insert into notifications (user_id, type, content, related_id, actor_id)
    values (photo_owner, 'like', null, new.photo_id, new.user_id);
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;






