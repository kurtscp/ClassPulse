-- Create sessions table to track active classes and their settings
create table sessions (
    id uuid primary key default gen_random_uuid(),
    instructor_id uuid not null references auth.users(id) default auth.uid(),
    class_name text not null,
    meet_link text,
    class_code text not null unique,
    status text not null default 'live' check (status in ('live','ended')),
    settings jsonb not null default '{}'::jsonb,
    started_at timestamptz not null default now(),
    ended_at timestamptz
);

-- Create participants table to hold student attendance and live status
create table participants (
    id uuid primary key default gen_random_uuid(),
    session_id uuid not null references sessions(id) on delete cascade,
    student_name text not null,
    joined_at timestamptz not null default now(),
    last_seen_at timestamptz,
    meet_tab_open boolean not null default false,
    meet_tab_focused boolean not null default false,
    system_state text not null default 'active' check (system_state in ('active','idle','locked')),
    unfocused_since timestamptz,
    idle_since timestamptz
);

-- Add index on participants for fast lookups by session
create index idx_participants_session_id on participants(session_id);

-- Create participant_tokens table to store secret authentication tokens for students
-- (Secret; no one except security-definer functions may read it)
create table participant_tokens (
    participant_id uuid primary key references participants(id) on delete cascade,
    token uuid not null unique default gen_random_uuid()
);

-- Create heartbeats table to log historical activity of participants over time
create table heartbeats (
    id bigint generated always as identity primary key,
    participant_id uuid not null references participants(id) on delete cascade,
    session_id uuid not null references sessions(id) on delete cascade,
    meet_tab_open boolean not null,
    meet_tab_focused boolean not null,
    system_state text not null check (system_state in ('active','idle','locked')),
    created_at timestamptz not null default now()
);

-- Indexes for heartbeats to optimize time-series queries
create index idx_heartbeats_participant_id_created_at on heartbeats(participant_id, created_at);
create index idx_heartbeats_session_id_created_at on heartbeats(session_id, created_at);

-- Create checkins table for periodic attention checks initiated by instructors
create table checkins (
    id uuid primary key default gen_random_uuid(),
    session_id uuid not null references sessions(id) on delete cascade,
    sent_at timestamptz not null default now(),
    expires_at timestamptz not null default now() + interval '2 minutes'
);

-- Create checkin_responses table to record when a student acknowledges a checkin
create table checkin_responses (
    checkin_id uuid references checkins(id) on delete cascade,
    participant_id uuid references participants(id) on delete cascade,
    responded_at timestamptz not null default now(),
    primary key (checkin_id, participant_id)
);
