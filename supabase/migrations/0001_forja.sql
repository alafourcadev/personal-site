-- La Forja · R3 · global ranking on Supabase Free.
--
-- The load-bearing security decision of this file (design.md, Trust Boundaries):
-- the anon key is public by design, so it is safe ONLY because the base tables
-- deny anon entirely and the read-only views are the single public surface.
-- Every `grant` below is deliberate; adding one to a base table breaks the model.
--
-- Players sign in anonymously, so `auth.uid()` exists for everyone who plays and
-- these policies work unchanged if that anonymous user later links an email.

-- An extension in `public` shares a namespace with application objects, so its
-- functions can be shadowed through a manipulated search_path. Supabase keeps a
-- dedicated `extensions` schema for exactly this, and columns below qualify the
-- type explicitly so resolution never depends on whose search_path is in play.
create schema if not exists extensions;
create extension if not exists citext with schema extensions;

-- Relocates the extension when an earlier run of this file left it in `public`.
do $$
begin
  if exists (
    select 1
    from pg_extension e
    join pg_namespace n on n.oid = e.extnamespace
    where e.extname = 'citext' and n.nspname = 'public'
  ) then
    alter extension citext set schema extensions;
  end if;
end
$$;

grant usage on schema extensions to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  -- The pseudonym the ranking shows. Bounded because it is rendered publicly
  -- and an unbounded name is a defacement vector on a shared leaderboard.
  display_name extensions.citext unique not null check (
    length(display_name) between 2 and 24
    and display_name ~ '^[[:alnum:]][[:alnum:] _-]*$'
  ),
  locale text not null default 'es',
  is_public boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  exercise_id text not null check (length(exercise_id) between 1 and 128),
  -- RK7: the graph is what gets stored. The score rides along as the engine's
  -- verdict ON that graph, never as a bare number standing on its own. This is
  -- what makes server-side re-evaluation possible later without a migration.
  design jsonb not null,
  score int check (score is null or score between 0 and 100),
  ceiling int not null check (ceiling between 0 and 100),
  legal boolean not null,
  engine_version text not null check (length(engine_version) between 1 and 32),
  is_shared boolean not null default false,
  created_at timestamptz not null default now(),
  -- An unscored attempt is by definition not a legal one; storing a score for
  -- an illegal design would let a broken client poison the ranking.
  constraint scored_attempts_are_legal check (score is null or legal)
);

create index if not exists attempts_user_idx on public.attempts (user_id, created_at desc);
create index if not exists attempts_exercise_score_idx on public.attempts (exercise_id, score desc)
  where score is not null;

-- ---------------------------------------------------------------------------
-- Row level security: own rows only, and anon gets nothing from base tables
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.attempts enable row level security;

drop policy if exists p_own_profile on public.profiles;
create policy p_own_profile on public.profiles
  for all to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists p_own_attempt on public.attempts;
create policy p_own_attempt on public.attempts
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- No policy for `anon` anywhere above is the point: with RLS on and no policy,
-- the base tables are closed to the anon key even though it can reach PostgREST.
revoke all on public.profiles from anon;
revoke all on public.attempts from anon;
grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.attempts to authenticated;

-- ---------------------------------------------------------------------------
-- Public read surface: definer-rights views, the ONLY thing anon may read
-- ---------------------------------------------------------------------------

-- `security_invoker` is deliberately left off (the Postgres default), so these
-- run with the owner's rights and can aggregate across every player's rows.
-- They must therefore never select a column that is not meant to be public.
create or replace view public.leaderboard as
  select
    p.display_name,
    count(distinct a.exercise_id) as exercises_solved,
    sum(a.score) as total_score,
    max(a.created_at) as last_played_at
  from public.attempts a
  join public.profiles p on p.id = a.user_id
  where a.score is not null
    and a.legal
    and p.is_public
  group by p.display_name
  order by total_score desc nulls last, last_played_at asc;

create or replace view public.exercise_best as
  select distinct on (a.exercise_id, p.display_name)
    a.exercise_id,
    p.display_name,
    a.score,
    a.created_at,
    -- Only a design its author explicitly shared is ever published.
    case when a.is_shared then a.design else null end as design
  from public.attempts a
  join public.profiles p on p.id = a.user_id
  where a.score is not null
    and a.legal
    and p.is_public
  order by a.exercise_id, p.display_name, a.score desc, a.created_at asc;

-- Supabase's default privileges grant ALL on newly created objects in `public`
-- to anon and authenticated, views included. Postgres currently refuses writes
-- to these two only because they aggregate, an accident of their shape, not a
-- boundary. Flatten either view later and the write path opens silently, so
-- revoke first and let `select` be the only privilege that survives.
revoke all on public.leaderboard from anon, authenticated;
revoke all on public.exercise_best from anon, authenticated;

grant select on public.leaderboard to anon, authenticated;
grant select on public.exercise_best to anon, authenticated;
