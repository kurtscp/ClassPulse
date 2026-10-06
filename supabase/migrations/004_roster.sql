-- 1. Table roster_entries to store the predefined class roster
create table roster_entries (
    id uuid primary key default gen_random_uuid(),
    session_id uuid not null references sessions(id) on delete cascade,
    student_name text not null check (length(trim(student_name)) between 1 and 60),
    participant_id uuid references participants(id) on delete set null,
    claimed_at timestamptz
);

-- Indexes for roster_entries to ensure data integrity and query performance
create unique index idx_roster_entries_session_name on roster_entries(session_id, lower(student_name));
create index idx_roster_entries_session_id on roster_entries(session_id);
create unique index idx_roster_entries_participant_id on roster_entries(participant_id) where participant_id is not null;

-- 2. RLS and Realtime for roster_entries
alter table roster_entries enable row level security;

-- Authenticated instructors can select, insert, update and delete only where the session belongs to them
create policy "Instructors can select their sessions' roster entries"
on roster_entries for select to authenticated
using (exists (select 1 from sessions where id = roster_entries.session_id and instructor_id = auth.uid()));

create policy "Instructors can insert their sessions' roster entries"
on roster_entries for insert to authenticated
with check (exists (select 1 from sessions where id = roster_entries.session_id and instructor_id = auth.uid()));

create policy "Instructors can update their sessions' roster entries"
on roster_entries for update to authenticated
using (exists (select 1 from sessions where id = roster_entries.session_id and instructor_id = auth.uid()))
with check (exists (select 1 from sessions where id = roster_entries.session_id and instructor_id = auth.uid()));

create policy "Instructors can delete their sessions' roster entries"
on roster_entries for delete to authenticated
using (exists (select 1 from sessions where id = roster_entries.session_id and instructor_id = auth.uid()));

-- No anon access allowed natively
revoke all on table roster_entries from anon;

-- Add to Realtime
alter publication supabase_realtime add table roster_entries;

-- 3. get_roster function
create or replace function get_roster(p_class_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_code text := upper(trim(p_class_code));
    v_session record;
    v_has_roster boolean;
    v_entries jsonb;
begin
    select id, status into v_session from sessions where class_code = v_code;

    if not found then
        raise exception 'Session not found';
    end if;

    if v_session.status = 'ended' then
        raise exception 'Session has ended';
    end if;

    select exists(select 1 from roster_entries where session_id = v_session.id) into v_has_roster;

    select coalesce(jsonb_agg(jsonb_build_object('id', id, 'student_name', student_name) order by student_name), '[]'::jsonb)
    into v_entries
    from roster_entries
    where session_id = v_session.id and participant_id is null;

    return jsonb_build_object(
        'has_roster', v_has_roster,
        'entries', v_entries
    );
end;
$$;

revoke execute on function get_roster(text) from public;
grant execute on function get_roster(text) to anon, authenticated;

-- 4. Replace join_session
-- Drop the old 2-argument version to replace it with the 3-argument version
drop function if exists join_session(text, text);

-- Creates a new join_session that handles either free-text names or roster-based joins
create or replace function join_session(
    p_class_code text, 
    p_student_name text, 
    p_roster_entry_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_code text := upper(trim(p_class_code));
    v_name text := trim(p_student_name);
    v_session record;
    v_has_roster boolean;
    v_roster_entry record;
    v_participant_id uuid;
    v_token uuid;
    v_updated_count int;
begin
    select id, class_name, meet_link, status into v_session from sessions where class_code = v_code;

    if not found then
        raise exception 'Session not found';
    end if;

    if v_session.status = 'ended' then
        raise exception 'Session has ended';
    end if;

    -- Check if this session enforces a roster
    select exists(select 1 from roster_entries where session_id = v_session.id) into v_has_roster;

    if v_has_roster then
        if p_roster_entry_id is null then
            raise exception 'Roster entry ID is required for this session';
        end if;

        select id, student_name, participant_id into v_roster_entry 
        from roster_entries 
        where id = p_roster_entry_id and session_id = v_session.id;

        if not found then
            raise exception 'That name was already taken or is not on the roster';
        end if;

        -- Use roster entry name, ignoring whatever typed name they gave
        v_name := v_roster_entry.student_name;
    else
        -- If no roster, ensure the free-text name is valid
        if length(v_name) < 1 or length(v_name) > 60 then
            raise exception 'Student name must be between 1 and 60 characters';
        end if;
    end if;

    -- Create the core participant entry
    insert into participants (session_id, student_name)
    values (v_session.id, v_name)
    returning id into v_participant_id;

    if v_has_roster then
        -- Atomically claim the roster slot
        update roster_entries 
        set participant_id = v_participant_id, claimed_at = now()
        where id = p_roster_entry_id and participant_id is null;

        get diagnostics v_updated_count = row_count;
        if v_updated_count = 0 then
            -- Raising an exception rolls back the whole transaction (including the insert)
            raise exception 'That name was already taken or is not on the roster';
        end if;
    end if;

    -- Create the secure token
    insert into participant_tokens (participant_id)
    values (v_participant_id)
    returning token into v_token;

    return jsonb_build_object(
        'participant_id', v_participant_id,
        'token', v_token,
        'session_id', v_session.id,
        'class_name', v_session.class_name,
        'meet_link', v_session.meet_link
    );
end;
$$;

revoke execute on function join_session(text, text, uuid) from public;
grant execute on function join_session(text, text, uuid) to anon, authenticated;

-- 5. release_roster_entry function
-- Serves as an escape hatch if a student needs to be un-claimed
create or replace function release_roster_entry(p_entry_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
    v_entry record;
begin
    select r.id, r.participant_id into v_entry
    from roster_entries r
    join sessions s on s.id = r.session_id
    where r.id = p_entry_id and s.instructor_id = auth.uid();

    if not found then
        raise exception 'Roster entry not found or unauthorized';
    end if;

    if v_entry.participant_id is not null then
        -- Deleting the participant cascades to heartbeats and participant_tokens
        -- It also natively sets roster_entries.participant_id = null via foreign key constraint
        delete from participants where id = v_entry.participant_id;
        
        update roster_entries set claimed_at = null where id = p_entry_id;
    end if;

    return true;
end;
$$;

revoke execute on function release_roster_entry(uuid) from public;
grant execute on function release_roster_entry(uuid) to authenticated;
