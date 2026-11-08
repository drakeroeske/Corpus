-- Corpus Spotters backend. Paste this whole file into Supabase → SQL Editor → Run.
-- Only social data lives here. Training logs, check-ins, meals and photos stay on each phone.

-- ---------- Tables ----------

create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  name text not null default 'Lifter' check (length(name) <= 60),
  gym text not null default '' check (length(gym) <= 80),
  schedule int[] not null default '{}',
  split text not null default '' check (length(split) <= 40),
  body_weight_kg numeric not null default 0,
  sex text check (sex in ('male', 'female')),
  bests jsonb not null default '{}'::jsonb,
  discoverable boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists public.follows (
  follower uuid not null references public.profiles on delete cascade,
  followee uuid not null references public.profiles on delete cascade,
  primary key (follower, followee),
  check (follower <> followee)
);

create table if not exists public.posts (
  id text primary key,
  author_id uuid not null default auth.uid() references public.profiles on delete cascade,
  time timestamptz not null default now(),
  title text not null default 'Workout' check (length(title) <= 80),
  duration_sec int not null default 0,
  top_sets text[] not null default '{}',
  prs text[] not null default '{}'
);
create index if not exists posts_author_time on public.posts (author_id, time desc);

create table if not exists public.likes (
  post_id text not null references public.posts on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles on delete cascade,
  primary key (post_id, user_id)
);

create table if not exists public.comments (
  id text primary key,
  post_id text not null references public.posts on delete cascade,
  author_id uuid not null default auth.uid() references public.profiles on delete cascade,
  time timestamptz not null default now(),
  text text not null check (length(text) between 1 and 500)
);

create table if not exists public.crews (
  id text primary key,
  name text not null check (length(name) <= 60),
  created_by uuid not null default auth.uid() references public.profiles on delete cascade
);

create table if not exists public.crew_members (
  crew_id text not null references public.crews on delete cascade,
  user_id uuid not null references public.profiles on delete cascade,
  primary key (crew_id, user_id)
);

create table if not exists public.training_days (
  user_id uuid not null default auth.uid() references public.profiles on delete cascade,
  date date not null,
  planned boolean not null,
  done boolean not null,
  primary key (user_id, date)
);

create table if not exists public.gym_checkins (
  id text primary key,
  user_id uuid not null default auth.uid() references public.profiles on delete cascade,
  gym text not null check (length(gym) <= 80),
  time timestamptz not null default now()
);
create index if not exists gym_checkins_time on public.gym_checkins (time desc);

-- New sign-ups get a profile row automatically.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id) values (new.id) on conflict do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- Helper checks (security definer so policies don't recurse) ----------

create or replace function public.i_follow(other uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from follows where follower = auth.uid() and followee = other)
$$;

create or replace function public.in_crew(c text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from crew_members where crew_id = c and user_id = auth.uid())
$$;

create or replace function public.is_crewmate(other uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from crew_members a join crew_members b on a.crew_id = b.crew_id
    where a.user_id = auth.uid() and b.user_id = other
  )
$$;

create or replace function public.can_see_post(p text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from posts
    where id = p and (author_id = auth.uid() or public.i_follow(author_id) or public.is_crewmate(author_id))
  )
$$;

create or replace function public.created_crew(c text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from crews where id = c and created_by = auth.uid())
$$;

-- ---------- Access rules ----------

alter table public.profiles enable row level security;
alter table public.follows enable row level security;
alter table public.posts enable row level security;
alter table public.likes enable row level security;
alter table public.comments enable row level security;
alter table public.crews enable row level security;
alter table public.crew_members enable row level security;
alter table public.training_days enable row level security;
alter table public.gym_checkins enable row level security;

-- Profiles: visible if discoverable, yours, someone you follow, someone who follows you, or a crewmate.
drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select to authenticated using (
  discoverable or id = auth.uid() or public.i_follow(id) or public.is_crewmate(id)
  or exists (select 1 from public.follows f where f.follower = profiles.id and f.followee = auth.uid())
);
drop policy if exists profiles_write on public.profiles;
create policy profiles_write on public.profiles for insert to authenticated with check (id = auth.uid());
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- Follows: you manage your own; you can see who follows you.
drop policy if exists follows_read on public.follows;
create policy follows_read on public.follows for select to authenticated using (follower = auth.uid() or followee = auth.uid());
drop policy if exists follows_insert on public.follows;
create policy follows_insert on public.follows for insert to authenticated with check (follower = auth.uid());
drop policy if exists follows_delete on public.follows;
create policy follows_delete on public.follows for delete to authenticated using (follower = auth.uid());

-- Posts: you see your own, people you follow, and crewmates.
drop policy if exists posts_read on public.posts;
create policy posts_read on public.posts for select to authenticated using (
  author_id = auth.uid() or public.i_follow(author_id) or public.is_crewmate(author_id)
);
drop policy if exists posts_insert on public.posts;
create policy posts_insert on public.posts for insert to authenticated with check (author_id = auth.uid());
drop policy if exists posts_update on public.posts;
create policy posts_update on public.posts for update to authenticated using (author_id = auth.uid()) with check (author_id = auth.uid());
drop policy if exists posts_delete on public.posts;
create policy posts_delete on public.posts for delete to authenticated using (author_id = auth.uid());

-- Likes and comments: only on posts you can see.
drop policy if exists likes_read on public.likes;
create policy likes_read on public.likes for select to authenticated using (public.can_see_post(post_id));
drop policy if exists likes_insert on public.likes;
create policy likes_insert on public.likes for insert to authenticated with check (user_id = auth.uid() and public.can_see_post(post_id));
drop policy if exists likes_delete on public.likes;
create policy likes_delete on public.likes for delete to authenticated using (user_id = auth.uid());

drop policy if exists comments_read on public.comments;
create policy comments_read on public.comments for select to authenticated using (public.can_see_post(post_id));
drop policy if exists comments_insert on public.comments;
create policy comments_insert on public.comments for insert to authenticated with check (author_id = auth.uid() and public.can_see_post(post_id));
drop policy if exists comments_update on public.comments;
create policy comments_update on public.comments for update to authenticated using (author_id = auth.uid()) with check (author_id = auth.uid());
drop policy if exists comments_delete on public.comments;
create policy comments_delete on public.comments for delete to authenticated using (author_id = auth.uid());

-- Crews: members see their crews; the creator adds people they follow (max 8 members).
drop policy if exists crews_read on public.crews;
create policy crews_read on public.crews for select to authenticated using (public.in_crew(id) or created_by = auth.uid());
drop policy if exists crews_insert on public.crews;
create policy crews_insert on public.crews for insert to authenticated with check (created_by = auth.uid());
drop policy if exists crews_update on public.crews;
create policy crews_update on public.crews for update to authenticated using (created_by = auth.uid()) with check (created_by = auth.uid());

drop policy if exists crew_members_read on public.crew_members;
create policy crew_members_read on public.crew_members for select to authenticated using (public.in_crew(crew_id) or public.created_crew(crew_id));
drop policy if exists crew_members_insert on public.crew_members;
create policy crew_members_insert on public.crew_members for insert to authenticated with check (
  public.created_crew(crew_id)
  and (user_id = auth.uid() or public.i_follow(user_id))
  and (select count(*) from public.crew_members m where m.crew_id = crew_members.crew_id) < 8
);
drop policy if exists crew_members_delete on public.crew_members;
create policy crew_members_delete on public.crew_members for delete to authenticated using (user_id = auth.uid() or public.created_crew(crew_id));

-- Training days (for crew streaks): yours, and your crewmates'.
drop policy if exists training_days_read on public.training_days;
create policy training_days_read on public.training_days for select to authenticated using (user_id = auth.uid() or public.is_crewmate(user_id));
drop policy if exists training_days_insert on public.training_days;
create policy training_days_insert on public.training_days for insert to authenticated with check (user_id = auth.uid());
drop policy if exists training_days_update on public.training_days;
create policy training_days_update on public.training_days for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Gym check-ins: yours, and people you follow.
drop policy if exists gym_checkins_read on public.gym_checkins;
create policy gym_checkins_read on public.gym_checkins for select to authenticated using (user_id = auth.uid() or public.i_follow(user_id));
drop policy if exists gym_checkins_insert on public.gym_checkins;
create policy gym_checkins_insert on public.gym_checkins for insert to authenticated with check (user_id = auth.uid());

-- ---------- Live updates for the feed ----------
do $$
begin
  alter publication supabase_realtime add table public.posts, public.likes, public.comments;
exception when duplicate_object then null;
end $$;
