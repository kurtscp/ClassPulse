-- =====================================================================
-- CLASSPULSE SMOKE TESTS
-- Paste this entire file into the Supabase SQL Editor.
-- Make sure to replace the placeholder in SECTION 0 with your UUID.
-- Highlight each numbered section and run them one by one to verify.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. PREPARATION
-- ---------------------------------------------------------------------
-- Create a scratch table to hold values across test steps.
create table if not exists public.smoke_vars (
    key text primary key,
    value text
);

-- IMPORTANT: Replace '00000000-0000-0000-0000-000000000000' with your actual test instructor UUID from Auth -> Users
insert into public.smoke_vars (key, value) 
values ('instructor_id', '00000000-0000-0000-0000-000000000000') 
on conflict (key) do update set value = excluded.value;


-- ---------------------------------------------------------------------
-- 1. SETUP SESSION 1
-- ---------------------------------------------------------------------
-- Action: Insert a session directly using the instructor UUID.
-- Expected Result: One row representing session TST-0001.
insert into sessions (id, instructor_id, class_name, meet_link, class_code)
values (
    gen_random_uuid(), 
    (select value::uuid from smoke_vars where key = 'instructor_id'), 
    'Test Class 1', 
    'https://meet.google.com/abc-defg-hij', 
    'TST-0001'
)
returning id, class_code;

insert into smoke_vars (key, value)
select 'session_1_id', id::text from sessions where class_code = 'TST-0001' 
on conflict (key) do update set value = excluded.value;


-- ---------------------------------------------------------------------
-- 2. JOIN SESSION 1
-- ---------------------------------------------------------------------
-- Action: Join 'tst-0001' as a free-text participant.
-- Expected Result: A JSON object containing participant_id, token, etc.
insert into smoke_vars (key, value)
select 'join_res_1', join_session('tst-0001', 'Test Student')::text
on conflict (key) do update set value = excluded.value;

select value::jsonb as join_session_result from smoke_vars where key = 'join_res_1';


-- ---------------------------------------------------------------------
-- 3. HEARTBEATS AND STATUS CHANGES
-- ---------------------------------------------------------------------
-- 3a. Active and Focused
-- Action: Send heartbeat where meet_tab_open=true, focused=true, system_state='active'.
-- Expected Result: unfocused_since = NULL, idle_since = NULL.
select send_heartbeat(((select value::jsonb->>'token' from smoke_vars where key = 'join_res_1')::uuid), true, true, 'active');

select student_name, meet_tab_open, meet_tab_focused, system_state, unfocused_since, idle_since
from participants
where id = (select (value::jsonb->>'participant_id')::uuid from smoke_vars where key = 'join_res_1');


-- 3b. Active but Unfocused
-- Action: Send heartbeat where meet_tab_open=true, focused=false, system_state='active'.
-- Expected Result: unfocused_since is a Timestamp, idle_since = NULL.
select send_heartbeat(((select value::jsonb->>'token' from smoke_vars where key = 'join_res_1')::uuid), true, false, 'active');

select student_name, meet_tab_open, meet_tab_focused, system_state, unfocused_since, idle_since
from participants
where id = (select (value::jsonb->>'participant_id')::uuid from smoke_vars where key = 'join_res_1');


-- 3c. Idle
-- Action: Send heartbeat where system_state='idle'.
-- Expected Result: unfocused_since is a Timestamp, idle_since is a Timestamp.
select send_heartbeat(((select value::jsonb->>'token' from smoke_vars where key = 'join_res_1')::uuid), true, false, 'idle');

select student_name, meet_tab_open, meet_tab_focused, system_state, unfocused_since, idle_since
from participants
where id = (select (value::jsonb->>'participant_id')::uuid from smoke_vars where key = 'join_res_1');


-- ---------------------------------------------------------------------
-- 4. CHECKINS
-- ---------------------------------------------------------------------
-- 4a. Create checkin and verify it is delivered.
-- Action: Insert checkin for session 1, then send a heartbeat.
-- Expected Result: pending_checkin object is returned inside the heartbeat JSON response.
insert into checkins (session_id)
values ((select value::uuid from smoke_vars where key = 'session_1_id'))
returning id as new_checkin_id;

insert into smoke_vars (key, value)
select 'checkin_1_id', id::text from checkins where session_id = (select value::uuid from smoke_vars where key = 'session_1_id') order by sent_at desc limit 1 
on conflict (key) do update set value = excluded.value;

select send_heartbeat(((select value::jsonb->>'token' from smoke_vars where key = 'join_res_1')::uuid), true, true, 'active') as heartbeat_with_checkin;


-- 4b. Respond to checkin
-- Action: Participant responds to the checkin.
-- Expected Result: true.
select respond_checkin(
    ((select value::jsonb->>'token' from smoke_vars where key = 'join_res_1')::uuid),
    (select value::uuid from smoke_vars where key = 'checkin_1_id')
) as responded;


-- 4c. Verify checkin cleared
-- Action: Send another heartbeat.
-- Expected Result: pending_checkin is null.
select send_heartbeat(((select value::jsonb->>'token' from smoke_vars where key = 'join_res_1')::uuid), true, true, 'active') as heartbeat_no_checkin;


-- ---------------------------------------------------------------------
-- 5. ROSTER SCENARIOS
-- ---------------------------------------------------------------------
-- 5a. Create Session 2 and Roster Entries
-- Action: Insert session TST-0002 and two roster entries.
-- Expected Result: Two roster rows returned for Ana Cruz and Ben Reyes.
insert into sessions (id, instructor_id, class_name, meet_link, class_code)
values (
    gen_random_uuid(), 
    (select value::uuid from smoke_vars where key = 'instructor_id'), 
    'Test Class 2', 
    'https://meet.google.com/xyz', 
    'TST-0002'
)
returning id as session_2_id;

insert into smoke_vars (key, value)
select 'session_2_id', id::text from sessions where class_code = 'TST-0002' 
on conflict (key) do update set value = excluded.value;

insert into roster_entries (session_id, student_name)
values 
    ((select value::uuid from smoke_vars where key = 'session_2_id'), 'Ana Cruz'),
    ((select value::uuid from smoke_vars where key = 'session_2_id'), 'Ben Reyes')
returning id, student_name;

insert into smoke_vars (key, value)
select 'ana_roster_id', id::text from roster_entries where session_id = (select value::uuid from smoke_vars where key = 'session_2_id') and student_name = 'Ana Cruz' 
on conflict (key) do update set value = excluded.value;


-- 5b. Get Roster
-- Action: Call get_roster for TST-0002.
-- Expected Result: has_roster = true, and entries array contains Ana and Ben.
select get_roster('tst-0002') as roster_json;


-- 5c. Join via Roster (Ana)
-- Action: Use join_session with Ana's roster entry ID. (Notice we pass 'Fake Name' but it should be ignored).
-- Expected Result: JSON returned with participant details.
insert into smoke_vars (key, value)
select 'join_ana', join_session('tst-0002', 'Fake Name', (select value::uuid from smoke_vars where key = 'ana_roster_id'))::text
on conflict (key) do update set value = excluded.value;

select student_name as true_claimed_name from participants 
where id = (select (value::jsonb->>'participant_id')::uuid from smoke_vars where key = 'join_ana');


-- 5d. Attempt double-claim
-- Action: Try to use Ana's roster ID again.
-- Expected Result: ERROR! "That name was already taken or is not on the roster"
select join_session('tst-0002', 'Double Claimer', (select value::uuid from smoke_vars where key = 'ana_roster_id'));


-- 5e. Get Roster Again
-- Action: Check remaining entries.
-- Expected Result: Only Ben Reyes is listed now.
select get_roster('tst-0002') as remaining_roster;


-- 5f. Attempt free-text join on a rostered session
-- Action: Try joining TST-0002 without providing a roster ID.
-- Expected Result: ERROR! "Roster entry ID is required for this session"
select join_session('tst-0002', 'Ben Reyes');


-- ---------------------------------------------------------------------
-- 6. CLEANUP
-- ---------------------------------------------------------------------
-- Action: Delete the test sessions (cascades to everything) and drop the variables table.
-- Expected Result: "DROP TABLE" successful execution.
delete from sessions where class_code in ('TST-0001', 'TST-0002');
drop table public.smoke_vars;
