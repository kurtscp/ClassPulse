/*
  Security and Permissions Model
  
  Who can do what:
  - anon (unauthenticated students):
      - Cannot read or write directly to any table.
      - Can only access data indirectly by executing security definer functions (join_session, send_heartbeat, respond_checkin).
  - authenticated (instructors):
      - sessions: Can select, insert, update, and delete their own sessions (where instructor_id = auth.uid()).
      - participants: Can select only participants belonging to their own sessions.
      - heartbeats: Can select only heartbeats belonging to their own sessions.
      - checkins: Can select and insert checkins for their own sessions.
      - checkin_responses: Can select only responses to checkins from their own sessions.
  - participant_tokens: No one can read or write directly (accessed solely via security definer functions).
  
  Realtime:
  - sessions, participants, checkins, checkin_responses are broadcasted over supabase_realtime.
  - heartbeats are excluded from realtime to prevent spam.
*/

-- 1. Enable RLS on all tables
alter table sessions enable row level security;
alter table participants enable row level security;
alter table participant_tokens enable row level security;
alter table heartbeats enable row level security;
alter table checkins enable row level security;
alter table checkin_responses enable row level security;

-- 2. Policies for `authenticated` (instructors)

-- Sessions: Full CRUD on own sessions
create policy "Instructors can select their own sessions" 
on sessions for select to authenticated 
using (instructor_id = auth.uid());

create policy "Instructors can insert their own sessions" 
on sessions for insert to authenticated 
with check (instructor_id = auth.uid());

create policy "Instructors can update their own sessions" 
on sessions for update to authenticated 
using (instructor_id = auth.uid()) 
with check (instructor_id = auth.uid());

create policy "Instructors can delete their own sessions" 
on sessions for delete to authenticated 
using (instructor_id = auth.uid());

-- Participants: Select own session's participants
create policy "Instructors can select participants of their sessions" 
on participants for select to authenticated 
using (exists (
    select 1 from sessions 
    where sessions.id = participants.session_id 
      and sessions.instructor_id = auth.uid()
));

-- Heartbeats: Select own session's heartbeats
create policy "Instructors can select heartbeats of their sessions" 
on heartbeats for select to authenticated 
using (exists (
    select 1 from sessions 
    where sessions.id = heartbeats.session_id 
      and sessions.instructor_id = auth.uid()
));

-- Checkins: Select and Insert on own session's checkins
create policy "Instructors can select checkins of their sessions" 
on checkins for select to authenticated 
using (exists (
    select 1 from sessions 
    where sessions.id = checkins.session_id 
      and sessions.instructor_id = auth.uid()
));

create policy "Instructors can insert checkins for their sessions" 
on checkins for insert to authenticated 
with check (exists (
    select 1 from sessions 
    where sessions.id = checkins.session_id 
      and sessions.instructor_id = auth.uid()
));

-- Checkin Responses: Select responses for checkins of own sessions
create policy "Instructors can select checkin responses of their sessions" 
on checkin_responses for select to authenticated 
using (exists (
    select 1 from checkins
    join sessions on sessions.id = checkins.session_id
    where checkins.id = checkin_responses.checkin_id 
      and sessions.instructor_id = auth.uid()
));

-- 3. Revoke all table privileges from anon on every table
revoke all on table sessions from anon;
revoke all on table participants from anon;
revoke all on table participant_tokens from anon;
revoke all on table heartbeats from anon;
revoke all on table checkins from anon;
revoke all on table checkin_responses from anon;

-- 4. Enable realtime on specific tables
alter publication supabase_realtime add table sessions, participants, checkins, checkin_responses;
