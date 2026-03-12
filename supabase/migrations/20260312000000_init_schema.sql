-- ============================================================
-- FormCheck — Supabase Schema
-- Run this in the SQL Editor of your Supabase project
-- ============================================================

-- 1. Users
create table if not exists users (
  id           uuid primary key default gen_random_uuid(),
  username     text unique not null,
  password     text not null,
  display_name text not null,
  created_at   timestamptz default now()
);

-- Seed data: insert your user manually via the Supabase SQL Editor

-- 2. Sessions (video analyses)
create table if not exists sessions (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid references users(id) on delete cascade not null,
  exercise       text not null,
  score          int not null,
  previous_score int,
  improvement    int,
  summary        text,
  ai_summary     text,           -- concise AI-generated paragraph for comparison view
  share_text     text,
  frames_data    text[] default '{}',
  analysis_data  jsonb not null default '{}',
  created_at     timestamptz default now()
);
create index if not exists sessions_user_id_idx on sessions(user_id);
create index if not exists sessions_exercise_idx on sessions(exercise);

-- 3. Saved chats
create table if not exists chats (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references users(id) on delete cascade not null,
  title         text not null,
  exercise      text,
  score         int,
  messages      jsonb not null default '[]',
  message_count int default 0,
  created_at    timestamptz default now()
);
create index if not exists chats_user_id_idx on chats(user_id);

-- 4. Training routines
create table if not exists routines (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid references users(id) on delete cascade not null,
  name              text not null,
  week_count        int not null,
  has_deload        boolean default false,
  deload_percentage int default 50,
  start_date        text not null,
  days              jsonb default '[]',
  one_rms           jsonb default '{}',
  raw_text          text,
  created_at        timestamptz default now()
);
create index if not exists routines_user_id_idx on routines(user_id);

-- 5. Weekly training logs
create table if not exists week_logs (
  id          uuid primary key default gen_random_uuid(),
  routine_id  uuid references routines(id) on delete cascade not null,
  user_id     uuid references users(id) on delete cascade not null,
  week_number int not null,
  is_deload   boolean default false,
  days        jsonb not null default '[]',
  created_at  timestamptz default now(),
  unique(routine_id, week_number)
);
create index if not exists week_logs_routine_id_idx on week_logs(routine_id);

-- 6. Goals
create table if not exists goals (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references users(id) on delete cascade not null,
  text          text not null,
  category      text not null,
  target_date   text,
  achieved      boolean default false,
  achieved_date timestamptz,
  created_at    timestamptz default now()
);
create index if not exists goals_user_id_idx on goals(user_id);
