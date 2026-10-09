-- Fix Postgres RLS syntax error for checkins INSERT policy

drop policy if exists "Instructors can insert checkins for their sessions" on checkins;

create policy "Instructors can insert checkins for their sessions" 
on checkins for insert to authenticated 
with check (exists (
    select 1 from sessions 
    where sessions.id = session_id 
      and sessions.instructor_id = auth.uid()
));
