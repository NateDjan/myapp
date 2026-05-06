create extension if not exists pgcrypto;

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  google_id text unique,
  email text unique not null,
  display_name text not null,
  avatar_url text,
  google_access_token text,
  google_refresh_token text,
  google_token_expiry timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  name text not null,
  hourly_rate_cents integer not null check (hourly_rate_cents >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, name)
);

create table if not exists participants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  email text not null,
  display_name text not null,
  role_id uuid references roles(id) on delete set null,
  hourly_rate_cents integer check (hourly_rate_cents >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, email)
);

create table if not exists meetings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  google_event_id text,
  title text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  budget_cents integer not null default 0 check (budget_cents >= 0),
  status text not null default 'scheduled' check (status in ('scheduled', 'live', 'ended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, google_event_id)
);

create table if not exists meeting_participants (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid references meetings(id) on delete cascade,
  participant_id uuid references participants(id) on delete cascade,
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  is_present boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (meeting_id, participant_id)
);

create table if not exists agenda_blocks (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid references meetings(id) on delete cascade,
  title text not null,
  position integer not null,
  planned_minutes integer not null check (planned_minutes > 0),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (meeting_id, position)
);

create table if not exists agenda_block_participants (
  id uuid primary key default gen_random_uuid(),
  agenda_block_id uuid references agenda_blocks(id) on delete cascade,
  participant_id uuid references participants(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (agenda_block_id, participant_id)
);

create table if not exists departure_events (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid references meetings(id) on delete cascade,
  participant_id uuid references participants(id) on delete cascade,
  agenda_block_id uuid references agenda_blocks(id) on delete set null,
  suggested_at timestamptz not null default now(),
  validated_at timestamptz,
  potential_savings_cents integer not null default 0 check (potential_savings_cents >= 0),
  status text not null default 'suggested' check (status in ('suggested', 'validated', 'dismissed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_meetings_user_starts_at on meetings(user_id, starts_at);
create index if not exists idx_meeting_participants_meeting on meeting_participants(meeting_id);
create index if not exists idx_agenda_blocks_meeting_position on agenda_blocks(meeting_id, position);
