-- =====================================================================
-- CLASSPULSE: REPORT FUNCTION VERIFICATION TEST (Track C)
-- Run this in the Supabase SQL Editor.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. TEST SETUP
-- ---------------------------------------------------------------------
-- Uses a scratch table to preserve variables across test steps.
create table if not exists public.report_test_vars (
    key text primary key,
    value text
);

-- Use the current authenticated user, an existing auth user, or a test UUID
insert into public.report_test_vars (key, value)
values (
    'instructor_id', 
    coalesce(
        (select id::text from auth.users limit 1),
        '00000000-0000-0000-0000-000000000001'
    )
)
on conflict (key) do update set value = excluded.value;

-- Clean up any previous test run for code 'RPT-9001'
delete from sessions where class_code = 'RPT-9001';

-- ---------------------------------------------------------------------
-- 1. CREATE TEST SESSION
-- ---------------------------------------------------------------------
-- Session duration: exactly 600 seconds (10 minutes)
-- Started: 10 minutes ago, Ended: now()
-- Settings: distracted_after_seconds = 60, idle_after_seconds = 180, offline_after_seconds = 90
insert into sessions (
    id,
    instructor_id,
    class_name,
    meet_link,
    class_code,
    status,
    settings,
    started_at,
    ended_at
)
values (
    gen_random_uuid(),
    (select value::uuid from report_test_vars where key = 'instructor_id'),
    'CS 101 Report Test',
    'https://meet.google.com/rpt-test-xyz',
    'RPT-9001',
    'ended',
    '{"distracted_after_seconds": 60, "idle_after_seconds": 180, "offline_after_seconds": 90}'::jsonb,
    now() - interval '600 seconds',
    now()
)
returning id into public.report_test_vars;

insert into report_test_vars (key, value)
select 'session_id', id::text from sessions where class_code = 'RPT-9001'
on conflict (key) do update set value = excluded.value;

-- ---------------------------------------------------------------------
-- 2. CREATE ROSTER ENTRIES
-- ---------------------------------------------------------------------
-- 3 students on roster:
--   1. Alice Santos (will join and be active/distracted)
--   2. Bob Cruz     (will join and go offline)
--   3. Charlie Reyes (will NOT join -> unjoined roster entry)
insert into roster_entries (session_id, student_name)
values 
    ((select value::uuid from report_test_vars where key = 'session_id'), 'Alice Santos'),
    ((select value::uuid from report_test_vars where key = 'session_id'), 'Bob Cruz'),
    ((select value::uuid from report_test_vars where key = 'session_id'), 'Charlie Reyes');

-- ---------------------------------------------------------------------
-- 3. JOIN PARTICIPANTS (Alice and Bob)
-- ---------------------------------------------------------------------
-- Insert Alice
insert into participants (id, session_id, student_name, joined_at, last_seen_at)
values (
    gen_random_uuid(),
    (select value::uuid from report_test_vars where key = 'session_id'),
    'Alice Santos',
    now() - interval '600 seconds',
    now() - interval '30 seconds'
)
returning id into public.report_test_vars;

insert into report_test_vars (key, value)
select 'alice_id', id::text from participants 
where session_id = (select value::uuid from report_test_vars where key = 'session_id') 
  and student_name = 'Alice Santos'
on conflict (key) do update set value = excluded.value;

-- Link Alice to roster
update roster_entries
set participant_id = (select value::uuid from report_test_vars where key = 'alice_id'),
    claimed_at = now() - interval '600 seconds'
where session_id = (select value::uuid from report_test_vars where key = 'session_id')
  and student_name = 'Alice Santos';

-- Insert Bob
insert into participants (id, session_id, student_name, joined_at, last_seen_at)
values (
    gen_random_uuid(),
    (select value::uuid from report_test_vars where key = 'session_id'),
    'Bob Cruz',
    now() - interval '600 seconds',
    now() - interval '300 seconds'
)
returning id into public.report_test_vars;

insert into report_test_vars (key, value)
select 'bob_id', id::text from participants 
where session_id = (select value::uuid from report_test_vars where key = 'session_id') 
  and student_name = 'Bob Cruz'
on conflict (key) do update set value = excluded.value;

-- Link Bob to roster
update roster_entries
set participant_id = (select value::uuid from report_test_vars where key = 'bob_id'),
    claimed_at = now() - interval '600 seconds'
where session_id = (select value::uuid from report_test_vars where key = 'session_id')
  and student_name = 'Bob Cruz';

-- Note: Charlie Reyes remains unclaimed (participant_id is null).

-- ---------------------------------------------------------------------
-- 4. INSERT HEARTBEATS FOR ALICE
-- ---------------------------------------------------------------------
-- Alice's timeline over the 600s session:
--
-- HB 1 at -600s: open=true, focused=true, state='active'
--   Interval until next HB (-480s) = 120s.
--   Cap = 90s. Status = Active.
--   -> Active: 90s, Excess offline: 30s.
--
-- HB 2 at -480s: open=true, focused=false, state='active'
--   Unfocused island 1 starts at -480s. Elapsed unfocused at -480s is 0s <= 60s.
--   Interval until next HB (-400s) = 80s.
--   Cap = 90s. Status = Active (since elapsed was 0s at HB time).
--   -> Active: 80s, Excess offline: 0s.
--
-- HB 3 at -400s: open=true, focused=false, state='active'
--   Unfocused island 1 continues. Elapsed unfocused at -400s is 80s > 60s threshold!
--   Interval until next HB (-200s) = 200s.
--   Status = Distracted!
--   Cap = 90s.
--   -> Distracted: 90s, Excess offline: 110s.
--
-- HB 4 at -200s: open=true, focused=true, state='active'
--   Refocused! Unfocused streak reset.
--   Interval until session end (0s) = 200s.
--   Status = Active.
--   Cap = 90s.
--   -> Active: 90s, Excess offline: 110s.
--
-- ALICE TOTALS:
-- Active: 90 + 80 + 90 = 260s
-- Distracted: 90s
-- Idle: 0s
-- Offline: 30 + 0 + 110 + 110 = 250s
-- Tracked: 260 + 90 + 0 + 250 = 600s
-- Non-offline: 260 + 90 = 350s
-- Attendance %: 350 / 600 * 100 = 58.3%
insert into heartbeats (participant_id, session_id, meet_tab_open, meet_tab_focused, system_state, created_at)
values
    ((select value::uuid from report_test_vars where key = 'alice_id'),
     (select value::uuid from report_test_vars where key = 'session_id'),
     true, true, 'active', now() - interval '600 seconds'),

    ((select value::uuid from report_test_vars where key = 'alice_id'),
     (select value::uuid from report_test_vars where key = 'session_id'),
     true, false, 'active', now() - interval '480 seconds'),

    ((select value::uuid from report_test_vars where key = 'alice_id'),
     (select value::uuid from report_test_vars where key = 'session_id'),
     true, false, 'active', now() - interval '400 seconds'),

    ((select value::uuid from report_test_vars where key = 'alice_id'),
     (select value::uuid from report_test_vars where key = 'session_id'),
     true, true, 'active', now() - interval '200 seconds');

-- ---------------------------------------------------------------------
-- 5. INSERT HEARTBEATS FOR BOB
-- ---------------------------------------------------------------------
-- Bob's timeline:
--
-- HB 1 at -600s: open=true, focused=true, state='active'
--   Interval until next HB (-540s) = 60s.
--   Cap = 90s. Status = Active.
--   -> Active: 60s, Excess offline: 0s.
--
-- HB 2 at -540s: open=false, focused=false, state='active'
--   Meet tab closed! Status = Offline.
--   Interval until session end (0s) = 540s.
--   -> Offline: 540s (all of it counts as offline).
--
-- BOB TOTALS:
-- Active: 60s
-- Distracted: 0s
-- Idle: 0s
-- Offline: 540s
-- Tracked: 600s
-- Non-offline: 60s
-- Attendance %: 60 / 600 * 100 = 10.0%
insert into heartbeats (participant_id, session_id, meet_tab_open, meet_tab_focused, system_state, created_at)
values
    ((select value::uuid from report_test_vars where key = 'bob_id'),
     (select value::uuid from report_test_vars where key = 'session_id'),
     true, true, 'active', now() - interval '600 seconds'),

    ((select value::uuid from report_test_vars where key = 'bob_id'),
     (select value::uuid from report_test_vars where key = 'session_id'),
     false, false, 'active', now() - interval '540 seconds');

-- ---------------------------------------------------------------------
-- 6. INSERT CHECKINS AND RESPONSES
-- ---------------------------------------------------------------------
-- Checkin sent 8 minutes ago (at -480s)
insert into checkins (id, session_id, sent_at, expires_at)
values (
    gen_random_uuid(),
    (select value::uuid from report_test_vars where key = 'session_id'),
    now() - interval '480 seconds',
    now() - interval '360 seconds'
)
returning id into public.report_test_vars;

insert into report_test_vars (key, value)
select 'checkin_id', id::text from checkins 
where session_id = (select value::uuid from report_test_vars where key = 'session_id')
on conflict (key) do update set value = excluded.value;

-- Alice answers after 15 seconds (at -465s)
insert into checkin_responses (checkin_id, participant_id, responded_at)
values (
    (select value::uuid from report_test_vars where key = 'checkin_id'),
    (select value::uuid from report_test_vars where key = 'alice_id'),
    now() - interval '465 seconds'
);

-- Bob does NOT respond.
-- Charlie is unjoined, so no response.

-- ---------------------------------------------------------------------
-- 7. EXECUTE get_session_report AND INSPECT RESULTS
-- ---------------------------------------------------------------------
-- Expected output:
--
-- student_name  | joined | tracked_s | active_s | distracted_s | idle_s | offline_s | att_% | sent | answered | avg_resp_s
-- --------------+--------+-----------+----------+--------------+--------+-----------+-------+------+----------+-----------
-- Alice Santos  | true   | 600       | 260      | 90           | 0      | 250       | 58.3  | 1    | 1        | 15.0
-- Bob Cruz      | true   | 600       | 60       | 0            | 0      | 540       | 10.0  | 1    | 0        | NULL
-- Charlie Reyes | false  | 0         | 0        | 0            | 0      | 0         | 0.0   | 1    | 0        | NULL

select 
    student_name,
    joined,
    tracked_seconds,
    active_seconds,
    distracted_seconds,
    idle_seconds,
    offline_seconds,
    attendance_pct,
    checkins_sent,
    checkins_answered,
    avg_checkin_response_seconds
from get_session_report(
    (select value::uuid from report_test_vars where key = 'session_id')
);

-- ---------------------------------------------------------------------
-- 8. AUTOMATED ASSERTIONS
-- ---------------------------------------------------------------------
do $$
declare
    v_sess_id uuid;
    v_alice record;
    v_bob record;
    v_charlie record;
    v_count int;
begin
    select value::uuid into v_sess_id from report_test_vars where key = 'session_id';

    select count(*) into v_count from get_session_report(v_sess_id);
    if v_count <> 3 then
        raise exception 'ASSERTION FAILED: expected 3 rows, got %', v_count;
    end if;

    select * into v_alice from get_session_report(v_sess_id) where student_name = 'Alice Santos';
    if not v_alice.joined then
        raise exception 'ASSERTION FAILED: Alice should have joined=true';
    end if;
    if v_alice.active_seconds <> 260 or v_alice.distracted_seconds <> 90 or v_alice.offline_seconds <> 250 then
        raise exception 'ASSERTION FAILED: Alice duration breakdown mismatch (active %, distracted %, offline %)',
            v_alice.active_seconds, v_alice.distracted_seconds, v_alice.offline_seconds;
    end if;
    if v_alice.attendance_pct <> 58.3 then
        raise exception 'ASSERTION FAILED: Alice attendance_pct should be 58.3, got %', v_alice.attendance_pct;
    end if;
    if v_alice.checkins_answered <> 1 or v_alice.avg_checkin_response_seconds <> 15.0 then
        raise exception 'ASSERTION FAILED: Alice checkin response mismatch';
    end if;

    select * into v_bob from get_session_report(v_sess_id) where student_name = 'Bob Cruz';
    if not v_bob.joined or v_bob.active_seconds <> 60 or v_bob.offline_seconds <> 540 or v_bob.attendance_pct <> 10.0 then
        raise exception 'ASSERTION FAILED: Bob stats mismatch';
    end if;
    if v_bob.checkins_answered <> 0 or v_bob.avg_checkin_response_seconds is not null then
        raise exception 'ASSERTION FAILED: Bob checkins should be 0 answered, null avg response';
    end if;

    select * into v_charlie from get_session_report(v_sess_id) where student_name = 'Charlie Reyes';
    if v_charlie.joined or v_charlie.tracked_seconds <> 0 or v_charlie.attendance_pct <> 0.0 or v_charlie.checkins_sent <> 1 then
        raise exception 'ASSERTION FAILED: Charlie (unjoined roster) mismatch';
    end if;

    raise notice 'ALL REPORT FUNCTION ASSERTIONS PASSED SUCCESSFULLY!';
end;
$$;

-- ---------------------------------------------------------------------
-- 9. CLEANUP (Optional)
-- ---------------------------------------------------------------------
-- Uncomment to clean up after test:
-- delete from sessions where id = (select value::uuid from report_test_vars where key = 'session_id');
-- drop table if exists public.report_test_vars;
