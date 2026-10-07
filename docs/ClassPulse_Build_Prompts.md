# ClassPulse — Vibe-Coding Build Guide

> **Stack:** Supabase (Postgres, Auth, Realtime) · React + Vite + TypeScript dashboard · Chrome Extension (Manifest V3, plain JavaScript)
> **Tooling:** all prompts are tool-agnostic and work in Claude Code, Cursor, Copilot Chat, or any chat-based AI.
> **Plan:** Kurt builds the **foundation** (Part A). Then the 4 groupmates each build an **independent feature track** (Part B) on their own Git branch.

---

## 0. How This Guide Works

### The key idea: build the foundation so features never collide

The foundation deliberately ships with everything the features will need already in place:

- **The entire database schema, security policies, and RPC functions**, including the class roster behind "Not Joined" (so nobody edits shared SQL)
- **A feature registry** in the dashboard (each feature has its own folder and a placeholder tab already wired in)
- **Extension stubs** for check-ins (manifest permissions and content-script slot already declared)
- **A heartbeat simulator** so every member can test with fake students instead of needing 5 people in a live Meet
- **`AGENTS.md` and `docs/CONTRACTS.md`**, which every AI session reads first so all members' code follows the same rules

### Assumptions (change them in the prompts if you disagree)

| Topic | Decision |
|---|---|
| Student identity | Class code + a name picked from the instructor's roster (free-text name only if a session has no roster); no student login |
| Student database access | Only through RPC functions (a secret per-student token is issued when joining); **no anonymous table access** |
| Instructor identity | Supabase email + password |
| Extension auth to Supabase | Public key only (anon or publishable key); never a secret key |
| Check-in delivery | Returned inside each heartbeat response (no websockets in the extension), so delay is up to ~30 seconds |
| "Not Joined" status | Included, powered by a per-session class roster. Statuses: Active, Distracted, Idle, Offline, Not Joined |
| Track D (fourth member) | **Assumed** to be Live Board & UX enhancements on the dashboard. Swap it if you meant something else |

### Timeline (7 days)

| Day | Who | What |
|---|---|---|
| 1–2 | Kurt | Part A: foundation, merged to `main`, tagged `foundation-v1` |
| 2 | Everyone | Clone, set up `.env`, run dashboard + simulator (Section B0) |
| 3–5 | Members A–D | Part B feature tracks in parallel |
| 6 | Everyone | Integration, real Google Meet test, bug fixes |
| 7 | Everyone | Docs, demo rehearsal, submission buffer |

---

# PART A — Foundation (Kurt)

## A0. Prerequisites (manual, no AI)

- [ ] Node.js 20+, Git, Google Chrome, a GitHub account
- [ ] Create a **private GitHub repo** named `classpulse` and invite the 4 members
- [ ] Create a **Supabase project** (free tier). Save the database password somewhere safe.
- [ ] In Supabase: **Project Settings → API (or API Keys)**. Copy the **Project URL** and the **anon / publishable key**. Never copy or use the `service_role` / secret key in any code.
- [ ] In Supabase: **Authentication → Providers → Email**. Turn **off** "Confirm email" for development so sign-ups work instantly.
- [ ] Put the MVP file in the repo later as `docs/ClassPulse_MVP.md`

## A1. Repo scaffold and agent rules

**Goal:** monorepo skeleton plus the rules file every future AI session reads.

```text
Create the skeleton of a monorepo called "classpulse" in the current empty folder.

Structure:
- README.md (short: what ClassPulse is, folder map, "see docs/")
- AGENTS.md (content given below)
- .gitignore (node_modules, dist, .env, .env.*, extension/config.js, .DS_Store; but keep .env.example and extension/config.example.js)
- docs/ (empty for now; I will add ClassPulse_MVP.md myself)
- supabase/migrations/ (empty, with a .gitkeep)
- dashboard/ (empty, with a .gitkeep; I will scaffold it in a later step)
- extension/ (empty, with a .gitkeep)
- scripts/ (empty, with a .gitkeep)

Do not install anything yet. Initialize git, make the first commit "chore: repo skeleton".

AGENTS.md content:

# ClassPulse — Agent Instructions
Read docs/ClassPulse_MVP.md and docs/CONTRACTS.md before changing anything.

## What this is
A Chrome extension (Manifest V3, plain JavaScript) sends heartbeats about Google Meet attendance to Supabase. A React dashboard shows live student status to the instructor.

## Rules
1. Stay inside the folder/files assigned to your task. Shared files change only through a PR approved by Kurt: supabase/migrations/001-004*, dashboard/src/lib/status.ts, dashboard/src/lib/board.ts, dashboard/src/features/registry.ts, extension/manifest.json, extension/lib/supabase.js.
2. Never use or write the service_role / secret key anywhere. Never commit .env or extension/config.js.
3. Students (anonymous) reach the database ONLY through the RPC functions join_session, send_heartbeat, respond_checkin, get_roster. Never add anonymous table policies.
4. New SQL goes in a NEW numbered file in supabase/migrations/ using your assigned number range. Never edit an applied migration.
5. Privacy: the extension collects ONLY meet_tab_open, meet_tab_focused, system_state. Never read page content, other tabs' URLs or titles, chat, camera, microphone, screen, or keystrokes.
6. Dashboard is TypeScript strict. No `any`. Keep components small.
7. Work in small increments. Before finishing a task run lint, build and tests, then explain what changed and how to test it.
8. If a task seems to require changing a shared file or a contract, stop and tell me instead of changing it.
```

**Done when:** folder structure exists, one commit. Push to GitHub: `git remote add origin <url> && git push -u origin main`.

## A2. Database schema, functions, security

Run these as **separate prompts**, in order. After each one, copy the SQL into **Supabase → SQL Editor → Run** (keep the files in the repo too).

### A2.1 Tables

```text
Read AGENTS.md. Write supabase/migrations/001_tables.sql (PostgreSQL, Supabase). Do not add RLS yet.

Tables:

sessions
- id uuid pk default gen_random_uuid()
- instructor_id uuid not null references auth.users(id) default auth.uid()
- class_name text not null
- meet_link text
- class_code text not null unique
- status text not null default 'live' check (status in ('live','ended'))
- settings jsonb not null default '{}'::jsonb
- started_at timestamptz not null default now()
- ended_at timestamptz

participants
- id uuid pk default gen_random_uuid()
- session_id uuid not null references sessions(id) on delete cascade
- student_name text not null
- joined_at timestamptz not null default now()
- last_seen_at timestamptz
- meet_tab_open boolean not null default false
- meet_tab_focused boolean not null default false
- system_state text not null default 'active' check (system_state in ('active','idle','locked'))
- unfocused_since timestamptz
- idle_since timestamptz

participant_tokens (secret; no one except security-definer functions may read it)
- participant_id uuid pk references participants(id) on delete cascade
- token uuid not null unique default gen_random_uuid()

heartbeats
- id bigint generated always as identity pk
- participant_id uuid not null references participants(id) on delete cascade
- session_id uuid not null references sessions(id) on delete cascade
- meet_tab_open boolean not null
- meet_tab_focused boolean not null
- system_state text not null check (system_state in ('active','idle','locked'))
- created_at timestamptz not null default now()
- index on (participant_id, created_at) and on (session_id, created_at)

checkins
- id uuid pk default gen_random_uuid()
- session_id uuid not null references sessions(id) on delete cascade
- sent_at timestamptz not null default now()
- expires_at timestamptz not null default now() + interval '2 minutes'

checkin_responses
- checkin_id uuid references checkins(id) on delete cascade
- participant_id uuid references participants(id) on delete cascade
- responded_at timestamptz not null default now()
- primary key (checkin_id, participant_id)

Add short SQL comments explaining each table. Also add an index on participants(session_id).
```

### A2.2 Functions (the only way students touch the database)

```text
Read AGENTS.md and supabase/migrations/001_tables.sql. Write supabase/migrations/002_functions.sql.

All functions: language plpgsql, `security definer`, `set search_path = public`, and validate every input.

1. create_session(p_class_name text, p_meet_link text) returns sessions
   - Callable only by authenticated users. Sets instructor_id = auth.uid().
   - Generates class_code as 3 random uppercase letters + '-' + 4 random digits (e.g. PUP-4821). Retry on collision up to 10 times.
   - Class name must be 1–100 characters.

2. join_session(p_class_code text, p_student_name text) returns jsonb
   - Uppercase and trim the code, trim the name (1–60 characters).
   - Error if the code does not exist or the session status is 'ended'.
   - Insert a participant and a participant_tokens row.
   - Return {participant_id, token, session_id, class_name, meet_link}.

3. send_heartbeat(p_token uuid, p_meet_tab_open boolean, p_meet_tab_focused boolean, p_system_state text) returns jsonb
   - Find the participant by token; raise an error if invalid.
   - If the session is 'ended', return {"session_status":"ended","pending_checkin":null} and insert nothing.
   - Treat unknown p_system_state as 'active'.
   - Insert a heartbeats row.
   - Update the participants row: last_seen_at = now(), meet_tab_open, meet_tab_focused, system_state,
     unfocused_since = null if focused, else coalesce(unfocused_since, now()),
     idle_since = null if system_state = 'active', else coalesce(idle_since, now()).
   - Find the newest checkin for the session with expires_at > now() that this participant has NOT responded to.
   - Return {"session_status":"live","pending_checkin": null OR {"id","sent_at","expires_at"}}.

4. respond_checkin(p_token uuid, p_checkin_id uuid) returns boolean
   - Validate the token, make sure the checkin belongs to the participant's session and has not expired.
   - Insert into checkin_responses (ignore duplicates). Return true if recorded, else false.

Permissions at the bottom of the file: revoke execute on all four functions from public; grant execute on join_session, send_heartbeat, respond_checkin to anon and authenticated; grant execute on create_session to authenticated only.
```

### A2.3 Security policies and realtime

```text
Read AGENTS.md and the two existing migrations. Write supabase/migrations/003_security.sql.

1. Enable RLS on sessions, participants, participant_tokens, heartbeats, checkins, checkin_responses.
2. Policies (all for role `authenticated`, i.e. instructors):
   - sessions: select/insert/update/delete only where instructor_id = auth.uid()
   - participants, heartbeats, checkins, checkin_responses: select only where the row's session belongs to auth.uid() (use an exists() on sessions; for checkin_responses go through checkins)
   - checkins: ALSO allow insert only if the session belongs to auth.uid()
   - participant_tokens: NO policies at all (nobody can read it directly)
3. Do NOT create any policy for the `anon` role on any table. Revoke all table privileges from anon on every table.
4. Add sessions, participants, checkins and checkin_responses to the supabase_realtime publication (not heartbeats).
5. Add a comment block at the top listing exactly who can do what.
```

### A2.4 Class roster (powers "Not Joined")

```text
Read AGENTS.md and the three existing migrations. Write supabase/migrations/004_roster.sql (adds the class roster that powers the "Not Joined" status).

1. Table roster_entries: id uuid pk default gen_random_uuid(); session_id uuid not null references sessions(id) on delete cascade; student_name text not null (trimmed, 1–60 characters); participant_id uuid references participants(id) on delete set null; claimed_at timestamptz. Unique index on (session_id, lower(student_name)); index on session_id; unique index on participant_id where participant_id is not null.

2. RLS: enable it. Authenticated instructors may select, insert, update and delete roster_entries only where the session belongs to auth.uid(). No anon policies; revoke all anon table privileges. Add roster_entries to the supabase_realtime publication.

3. get_roster(p_class_code text) returns jsonb. security definer, search_path public, callable by anon and authenticated. Uppercase and trim the code; raise an error if the session does not exist or has ended. Return {"has_roster": boolean (true if the session has ANY roster entries), "entries": [{"id","student_name"}, ...]} listing ONLY unclaimed entries ordered by student_name.

4. Replace join_session: drop the old 2-argument version and create join_session(p_class_code text, p_student_name text, p_roster_entry_id uuid default null) with the same return shape and validation as before, plus:
   - If the session has roster entries: p_roster_entry_id is required, must belong to this session and be unclaimed. Insert the participant using the roster entry's student_name (ignore the typed name), then claim the entry atomically (update roster_entries set participant_id = <new participant>, claimed_at = now() where id = p_roster_entry_id and participant_id is null). If zero rows are updated, raise 'That name was already taken or is not on the roster'. The whole transaction must roll back, including the participant insert.
   - If the session has no roster entries: behave exactly as before (free-text name).
   Re-apply permissions: revoke execute from public, grant execute to anon and authenticated.

5. release_roster_entry(p_entry_id uuid) returns boolean. security definer, authenticated only. Verify the entry's session belongs to auth.uid() (raise an error otherwise). If the entry is claimed, delete that participant (this cascades its token and heartbeats) and set claimed_at to null. Return true. This is the escape hatch for "a student reinstalled" or "someone took the wrong name".

Add short SQL comments explaining each part.
```

Run it in the Supabase SQL Editor like the previous migrations.

### A2.5 Smoke test

```text
Write supabase/tests/smoke.sql that I can paste into the Supabase SQL Editor. It should:
1. At the top, declare the UUID of a test instructor as a variable (I will create a test user in Supabase Dashboard → Authentication → Users → Add user and paste its UUID there). Insert a session directly (as the postgres role) with instructor_id = that UUID and a known class_code TST-0001.
2. Call join_session('tst-0001','Test Student') and show the returned token.
3. Call send_heartbeat three times with different states (active/focused, active/unfocused, idle) and select the participant row after each, so I can see unfocused_since and idle_since change correctly.
4. Insert a checkin, call send_heartbeat again and show that pending_checkin is returned; call respond_checkin; call send_heartbeat again and show pending_checkin is now null.
5. Roster: create a second session TST-0002 and insert roster entries 'Ana Cruz' and 'Ben Reyes'. Call get_roster('tst-0002') and show has_roster = true with 2 entries. Call join_session with Ana's entry id and show the participant is named 'Ana Cruz'. Try the same entry again and show it fails. Show get_roster now lists only Ben. Show that joining TST-0002 without a roster entry id fails. (release_roster_entry checks auth.uid(), which is null in the SQL Editor, so it will be tested from the dashboard later.)
6. Clean up all test rows at the end.
Include a comment above each step saying what result I should see.
```

**Do it yourself:** run it in the SQL Editor and check the comments match what you see. If something is off, paste the output back into the AI: *"This is the result, but expected X. Fix the migration as a NEW file 004_fix_*.sql."*

### A2.6 Contracts doc

```text
Read all files in supabase/migrations/. Generate docs/CONTRACTS.md, derived ONLY from the actual SQL (do not invent anything). Sections:
1. Tables and columns (compact table per table)
2. RPC functions: signature, who can call it, parameters, exact return JSON shape
3. Heartbeat payload sent by the extension
4. Status rules the dashboard applies (use exactly these):
   - Offline: now - last_seen_at > offline_after_seconds, OR meet_tab_open is false
   - Distracted: meet_tab_open and not meet_tab_focused and now - unfocused_since > distracted_after_seconds
   - Idle: system_state is 'idle' or 'locked' and now - idle_since > idle_after_seconds
   - Active: everything else
   - Not Joined: a roster entry that has no linked participant (computed by the dashboard from roster_entries; never stored)
   - Priority among joined students: Offline > Distracted > Idle > Active
5. sessions.settings keys and defaults: distracted_after_seconds = 60, idle_after_seconds = 180, offline_after_seconds = 90 (unknown or missing keys fall back to defaults)
6. Migration number ranges: foundation 001-004, Check-ins 2xx, Thresholds 3xx, Report 4xx, Live Board 5xx
7. Ownership table: which folders/files each track owns (given below)

Ownership:
- Foundation (Kurt): supabase/migrations/001-004, dashboard/src/app, dashboard/src/lib, dashboard/src/features/registry.ts, extension/manifest.json, extension/lib, extension/background.js, extension/popup.*
- Track A Check-ins: dashboard/src/features/checkins/, extension/modules/checkin.js, extension/modules/checkin-overlay.js
- Track B Thresholds: dashboard/src/features/settings/
- Track C Report: dashboard/src/features/report/, supabase/migrations/4xx
- Track D Live Board: dashboard/src/features/live-board/
```

Then copy `ClassPulse_MVP.md` into `docs/`, commit, and push.

## A3. Dashboard scaffold

### A3.1 Project setup and structure

```text
Read AGENTS.md and docs/CONTRACTS.md. Scaffold the dashboard in /dashboard with Vite + React + TypeScript (strict), Tailwind CSS, React Router, @supabase/supabase-js, Vitest, ESLint.

Folder structure under dashboard/src:
- app/ (router.tsx, AppLayout.tsx, ProtectedRoute.tsx)
- lib/ (supabase.ts, status.ts, board.ts, settings.ts, types.ts, format.ts)
- pages/ (LoginPage.tsx, SessionsPage.tsx, SessionPage.tsx)
- features/
  - registry.ts  (exports an ordered array of {id, label, component} for the session tabs)
  - live-board/index.tsx, checkins/index.tsx, report/index.tsx, settings/index.tsx
    Each index.tsx default-exports a placeholder component that just says "<Name> — coming soon". Each folder is owned by a different teammate later.

Environment: read VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in lib/supabase.ts and throw a clear error if missing. Create .env.example with both variables (empty values). Do NOT create a real .env.

lib/types.ts: define Session, Participant, RosterEntry, Checkin, CheckinResponse types matching docs/CONTRACTS.md exactly.

Done when `npm run dev`, `npm run build`, `npm run lint` and `npm test` all succeed.
```

### A3.2 Instructor authentication

```text
Read AGENTS.md. In dashboard/src add instructor authentication with Supabase email + password:
- AuthProvider (context) exposing user, loading, signIn, signUp, signOut, using supabase.auth.onAuthStateChange.
- LoginPage with a toggle between Sign in and Create account, clear error messages, loading state.
- ProtectedRoute that redirects to /login when signed out.
- Routes: /login, /sessions (protected), /sessions/:sessionId (protected). Redirect / to /sessions.
- A simple top bar in AppLayout with the app name "ClassPulse", the user's email and a Sign out button.
Keep the styling clean and minimal with Tailwind.
```

### A3.3 Sessions page and session shell

```text
Read AGENTS.md and docs/CONTRACTS.md.

1. SessionsPage: list the instructor's sessions (newest first) showing class name, class code, status badge and start time, each linking to /sessions/:id. Add a "Create session" form (class name, optional Google Meet link, and an optional **roster** textarea where the instructor pastes one student name per line; also accept CSV by taking the first column). Clean the list (trim, drop blanks, drop case-insensitive duplicates, max 60 characters per name), show "N students" as a live preview, and add a "Copy roster from a previous session" dropdown listing the instructor's earlier sessions. On submit call the create_session RPC, then insert the roster rows into roster_entries, then navigate to the new session.

2. SessionContext (dashboard/src/app/SessionContext.tsx): provider + hook useSessionContext() that, for a given session id, loads the session, its participants and its roster_entries, and subscribes to Supabase Realtime (postgres_changes) on sessions, participants and roster_entries filtered by session id, keeping state in sync (insert/update/delete). It also exposes:
   - roster: RosterEntry[] (empty array if the session has no roster)
   - settings: resolved via resolveSettings(session.settings) from lib/settings.ts (merge with defaults, ignore invalid values)
   - now: a Date that updates every 5 seconds (so time-based statuses re-evaluate without new data)
   - refresh(): manual reload
   - loading and error states
   Clean up subscriptions on unmount.

3. lib/settings.ts: export DEFAULT_SETTINGS {distracted_after_seconds: 60, idle_after_seconds: 180, offline_after_seconds: 90}, the Settings type and resolveSettings(raw).

4. SessionPage: header with class name, a large class code with a Copy button, status badge, the Meet link, an "End session" button (confirmation dialog, then update status='ended' and ended_at=now()), and a "Manage roster" button that opens a dialog: add names (same cleaning rules as the create form), remove unclaimed names, and a "Release" button on claimed names (calls the release_roster_entry RPC; confirm first and warn that it deletes that student's data for this session). Below it render tabs from features/registry.ts; the tab content component reads everything from useSessionContext(). Default tab: Live Board.

Registry order: Live Board, Check-ins, Report, Settings.
```

### A3.4 Status logic (with tests) and basic live board

```text
Read AGENTS.md and docs/CONTRACTS.md (status rules section).

1. Implement dashboard/src/lib/status.ts:
   export type ParticipantStatus = 'active' | 'distracted' | 'idle' | 'offline'
   export type Status = ParticipantStatus | 'not_joined'
   export function getStatus(p: Participant, settings: Settings, now: Date): ParticipantStatus
   Follow the rules and priority in CONTRACTS.md EXACTLY. Handle null timestamps safely (a participant with no last_seen_at yet is 'offline').
   Also export STATUS_META for all five Status values (not_joined is gray with the label "Not joined"): label, Tailwind color classes, and a text icon for each status (never rely on color alone).

2. Write Vitest tests in status.test.ts covering every status, every priority conflict (e.g. unfocused AND idle), boundary values (exactly at the threshold), and null timestamps. Run them and make them pass.

3. Implement dashboard/src/lib/board.ts: export type BoardRow = {key: string; name: string; status: Status; participant: Participant | null; rosterEntry: RosterEntry | null} and export function buildBoardRows(roster, participants, settings, now): BoardRow[]. Rules: every roster entry becomes a row; if it is linked to a participant (participant_id) the row's status is getStatus(participant, settings, now), otherwise 'not_joined'. Participants that are not linked to any roster entry (sessions without a roster) also become rows, named by participant.student_name. No duplicates. Write Vitest tests in board.test.ts (roster only, roster plus claimed participants, no roster, unclaimed entries, a participant linked to a roster entry). Then update SessionContext to also expose `rows` (memoized from roster, participants, settings and now).

4. Implement a basic features/live-board/index.tsx: a responsive grid of StatusCards (student name, colored status badge with icon, "last seen 12s ago" via a helper in lib/format.ts). Read `rows` from useSessionContext(). Not Joined cards are gray, say "Not joined yet", and show no last-seen time. Show a friendly empty state ("Waiting for students to join. Share code XXX-0000") with the class code only when there are no rows at all.
Keep it simple; teammates will extend it later.
```

### A3.5 Heartbeat simulator (important for parallel work)

```text
Read AGENTS.md and docs/CONTRACTS.md. Create scripts/simulate.mjs (Node 20, no dependencies besides the built-in fetch; read SUPABASE_URL and SUPABASE_KEY from environment variables or a local .env file parsed manually).

Usage: node scripts/simulate.mjs --code PUP-4821 --count 12 --interval 5 [--roster]

Behavior:
- Calls the join_session RPC for N fake students with realistic Filipino first names. With --roster: call get_roster first and claim roster entries instead (join_session with p_roster_entry_id), joining about 70% of the entries immediately, another 10% after a random 30–120 second delay, and never joining the rest, so Not Joined cards stay visible.
- Every <interval> seconds each fake student calls send_heartbeat with a state that follows a simple random scenario: mostly active+focused; sometimes unfocused for a while; sometimes idle; a few go silent (stop sending) for a while and later come back.
- If a heartbeat response includes pending_checkin, the student responds via respond_checkin with a random delay of 3–60 seconds, and about 25% never respond.
- Print a one-line log per event; exit cleanly on Ctrl+C.
- Use only the public anon/publishable key via the `apikey` header (also send an Authorization Bearer header only if the key starts with "eyJ").
Add usage instructions to README.md and a `simulate` script entry in a root package.json if appropriate.
```

## A4. Extension foundation

### A4.1 Manifest, config, Supabase helper

```text
Read AGENTS.md and docs/CONTRACTS.md. Create the Chrome extension in /extension (Manifest V3, plain JavaScript ES modules, no bundler).

Files:
- manifest.json: name "ClassPulse", version 0.1.0, background service worker (type module) background.js, action with popup.html, permissions: tabs, idle, alarms, storage, notifications; host_permissions: https://meet.google.com/* and the Supabase project URL pattern (https://*.supabase.co/*); content_scripts: one entry for https://meet.google.com/* loading modules/checkin-overlay.js (create it as an empty stub with a comment "Owned by Track A").
- config.example.js exporting CONFIG = { SUPABASE_URL: '', SUPABASE_KEY: '' }. The real extension/config.js is gitignored; copy from the example.
- lib/supabase.js: an rpc(fnName, args) helper that POSTs to `${SUPABASE_URL}/rest/v1/rpc/${fnName}` with JSON body and header `apikey: SUPABASE_KEY`; add `Authorization: Bearer <key>` ONLY if the key starts with "eyJ". Parse Supabase error JSON into a readable Error message. 8-second timeout via AbortController.
- lib/state.js: helpers to get/set tracking state in chrome.storage.local with this shape: {tracking: boolean, participantId, token, sessionId, classCode, className, meetLink, studentName, lastStatusText, lastError}.
- modules/checkin.js: export async function handlePendingCheckin(checkin) {} as a stub with a comment "Owned by Track A".
- icons: simple generated placeholder PNGs (16, 48, 128) and reference them in the manifest.

Do not write popup or background logic yet. Explain how to load the unpacked extension in chrome://extensions.
```

### A4.2 Popup (join, consent, start/stop)

```text
Read AGENTS.md. Build extension/popup.html, popup.css, popup.js.

States:
1. Not tracking: show a consent box that lists exactly what is collected (whether a Google Meet tab is open, whether it is the focused tab, whether the computer is idle) and what is NOT collected (page content, other tabs' names or links, chat, camera, microphone, keystrokes). Fields: class code (auto-uppercase), then the name. When the class code has a valid format (3 letters, a dash, 4 digits), call the get_roster RPC: if has_roster is true, show a dropdown of the unclaimed names instead of a text field; if has_roster is true but entries is empty, show "All names are taken. Ask your instructor to release yours."; if has_roster is false, show a free-text full-name field. A required checkbox "I understand and agree". A Start tracking button disabled until the code, the name (or selected roster entry) and the checkbox are valid.
2. Tracking: show class name, student name, a green "Tracking is ON" indicator, the last status text from storage ("Meet tab detected" / "No Meet tab found"), and a Stop tracking button. Show any lastError in red.

Start: call join_session via lib/supabase.js (pass p_roster_entry_id when a roster name was chosen; if the join fails because the name was just taken, reload the roster list; reuse the stored participant if the same class code is already stored and not ended), save state with tracking = true, then send message {type:'START_TRACKING'} to the background worker. Stop: message {type:'STOP_TRACKING'} and set tracking = false.
Handle errors (invalid code, ended session, network) with friendly messages. Clean, minimal design, 340px wide.
```

### A4.3 Collectors and heartbeat loop

```text
Read AGENTS.md and docs/CONTRACTS.md. Implement:

1. extension/lib/collectors.js, async collectSignals(meetLink) returning { meet_tab_open, meet_tab_focused, system_state }:
   - meet_tab_open: true if any tab URL matches ^https://meet\.google\.com/[a-z]{3}-[a-z]{4}-[a-z]{3} (an actual meeting code, not the Meet landing page). If meetLink contains a meeting code, require that exact code.
   - meet_tab_focused: true only if a Chrome window is currently focused AND the active tab in that window is a matching Meet tab. Use chrome.windows.getAll({populate:true}).
   - system_state: chrome.idle.queryState(15) → 'active' | 'idle' | 'locked'.
   Read only the tab URL for matching; never store or send URLs or titles.

2. extension/background.js:
   - On START_TRACKING: create a chrome.alarms alarm "heartbeat" with periodInMinutes 0.5 and send one heartbeat immediately. On STOP_TRACKING: clear the alarm.
   - On alarm, onStartup and onInstalled: if storage says tracking, make sure the alarm exists, then run the heartbeat.
   - Heartbeat: collectSignals → rpc('send_heartbeat', {p_token, p_meet_tab_open, p_meet_tab_focused, p_system_state}). Save lastStatusText. If the response session_status is 'ended', set tracking = false, clear the alarm, and set a friendly message. If pending_checkin is not null, call handlePendingCheckin(checkin) from modules/checkin.js inside try/catch.
   - If the error says the token is invalid (the instructor released this name or removed the participant), set tracking = false, clear the alarm and store the message "You were removed from this session. Ask your instructor."
   - Network failure: store lastError, keep the alarm running, retry on the next tick.
   - Set the extension badge: "ON" (green) while tracking, empty otherwise.

Done when: I can load the extension, start tracking with a class code from the dashboard, open a Meet tab, and watch the student card turn green/orange/yellow/red on the dashboard as I switch tabs and go idle.
```

## A5. End-to-end verification and hand-off

- [ ] Create a session in the dashboard, copy the code.
- [ ] Run the simulator with 10 fake students. Cards appear and change status.
- [ ] Load the extension, join with the code, open a Meet link: card turns **Active**.
- [ ] Switch to another tab for 60+ seconds: **Distracted**. Leave the computer untouched ~3 minutes: **Idle**. Close the Meet tab: **Offline**.
- [ ] Click **End session**: extension stops itself on the next heartbeat.
- [ ] Create a session with a roster of 8 names and run the simulator with `--roster`: some cards stay gray **Not Joined**, others join and change status.
- [ ] In the extension, enter the class code: the dropdown lists only unclaimed names. After you claim one, it no longer appears for anyone else.
- [ ] Click **Release** on a claimed name: the extension stops with the "removed" message and the card returns to **Not Joined**.
- [ ] Create a session with no roster: joining with a free-text name still works.
- [ ] Open the dashboard in another browser: you cannot see the first instructor's sessions (RLS works).
- [ ] Try reading `participant_tokens` from the dashboard client console: it must fail.

**Security review prompt (run once):**

```text
Act as a security reviewer. Read supabase/migrations/*, extension/ and dashboard/src/lib. List any way an anonymous user could read or write table data other than through join_session, send_heartbeat, respond_checkin and get_roster (and whether get_roster reveals anything beyond unclaimed names), any way one instructor could see another instructor's data, any secret that could leak into the repo or the extension, and any collected data that violates rule 5 in AGENTS.md. Give a prioritized list with exact file/line fixes. Do not change code yet.
```

**Hand-off:** commit, push, protect `main`, then run:

```bash
git tag foundation-v1 && git push --tags
```

Create 4 GitHub Issues (one per track, copy the track description from Part B) and assign them.

---

# PART B — Feature Tracks (Members A–D)

## B0. Setup for every member (same for all)

```bash
git clone <repo-url> && cd classpulse
git checkout -b feature/<your-track>      # e.g. feature/checkins
cd dashboard && cp .env.example .env      # fill URL + anon key from Kurt
npm install && npm run dev
cd ../extension && cp config.example.js config.js   # fill URL + key
# Chrome: chrome://extensions → Developer mode → Load unpacked → select /extension
```

**Test without classmates:** create a session in the dashboard, then run `node scripts/simulate.mjs --code <CODE> --count 12 --interval 5`. Add `--roster` if you created the session with a roster.

### Session starter prompt (paste at the start of EVERY AI session)

```text
You are helping me on the ClassPulse project. First read AGENTS.md, docs/ClassPulse_MVP.md and docs/CONTRACTS.md. I own ONLY Track <A/B/C/D: name>, whose files are listed in the ownership table in CONTRACTS.md. Do not modify any file outside my track. If something I ask would require changing a shared file, a table, or an RPC function, stop and tell me instead.
Before coding, state your plan in at most 6 bullets, then proceed unless you are blocked by a question that only I can answer.
My task: <paste one prompt from below>
```

### Rules for all tracks

| Rule | Why |
|---|---|
| Branch `feature/<track>`, small commits, open a PR to `main` | Easy review and rollback |
| `git pull --rebase origin main` before every PR | Avoids merge conflicts |
| Only edit your own folders and migration range | Tracks stay independent |
| Need a shared change? Message Kurt with the exact change | Keeps contracts stable |
| Run `npm run lint && npm run build && npm test` before every PR | Never break `main` |
| PR description: what changed, how to test, screenshot or GIF | Faster review |

---

## Track A — Check-in Prompts (PEREZ)

**Owner folders:** `dashboard/src/features/checkins/`, `extension/modules/checkin.js`, `extension/modules/checkin-overlay.js`. **Migrations:** 2xx.
**What it does:** the instructor sends a check-in, students get a prompt, and the dashboard shows who confirmed and how fast.
**Uses (already built):** table `checkins` (instructor insert), `checkin_responses`, RPC `respond_checkin`, `pending_checkin` returned by `send_heartbeat`.

**A1. Dashboard: send and monitor**

```text
Implement dashboard/src/features/checkins/index.tsx (replace the placeholder). Read participants and session from useSessionContext().
- A "Send check-in" button that inserts a row into checkins for this session (instructor insert is already allowed by RLS). Disable it while a check-in is still open or while the session is ended.
- A live panel for the latest check-in: countdown to expires_at, a progress bar "X of Y students responded" (Y = students not offline), and a list of each student with Responded (response time in seconds since sent_at) or Waiting. Update in real time by subscribing to checkin_responses and checkins via Supabase Realtime for this session. Clean up subscriptions.
- A history list of earlier check-ins in this session with sent time, response rate and median response time.
- Loading, error and empty states. Keep logic in small hooks (useCheckins) and pure helper functions with Vitest tests for response-rate and median calculations.
```

**A2. Extension: show the prompt to the student**

```text
Implement extension/modules/checkin.js and extension/modules/checkin-overlay.js (do not edit manifest.json; it already declares the content script on meet.google.com and the notifications permission).
- handlePendingCheckin(checkin): ignore it if checkin.id was already handled or expires_at has passed (remember handled ids in chrome.storage.local, keep only the last 20). Otherwise (1) send a message to the content script in every Meet tab to show an overlay, and (2) also create a chrome.notifications notification "Are you still with us?" with a button "I'm here" as a fallback for when the student is in another tab.
- checkin-overlay.js (content script): on message, render a small fixed-position banner in the top-right of the page with the text "Are you still with us?", an "I'm here" button, and a countdown until expires_at. Use a closed Shadow DOM so Meet's CSS cannot affect it. Clicking sends {type:'CHECKIN_CONFIRM', checkinId} to the background and removes the banner. The content script must not read or modify anything else on the page.
- Background side (add a small onMessage + notifications.onButtonClicked handler inside modules/checkin.js, exported as registerCheckinListeners(), and I will ask Kurt to call it once from background.js): call rpc('respond_checkin', {p_token, p_checkin_id}). Confirming in the overlay or in the notification should dismiss the other one.
```

> **Note for Track A:** you need exactly one line added to `background.js` (`registerCheckinListeners()`). Ask Kurt to add it, or make that single approved change in your PR.

**A3. Edge cases and testing**

```text
Review my Track A code for edge cases and fix them: double clicks, expired check-ins never shown, the same check-in shown twice in two Meet tabs, response failing because of a network error (retry once after 3 seconds, then show an error in the overlay), service worker restarting mid-check-in. Then write a manual test checklist in dashboard/src/features/checkins/TESTING.md that uses scripts/simulate.mjs for fake students and a real extension for one real student.
```

**Done when:** instructor sends check-in → real extension student sees overlay within ~30 s → confirms → dashboard shows the response time; simulator students show mixed responses; no console errors.

---

## Track B — Adjustable Thresholds (CLEDERA)

**Owner folder:** `dashboard/src/features/settings/`. **Migrations:** 3xx (probably none needed).
**What it does:** the instructor tunes when a student counts as Distracted, Idle, or Offline, per session, with changes applying live.
**Uses (already built):** `sessions.settings` jsonb, `resolveSettings()` in `lib/settings.ts`, `getStatus()` already receiving settings from context.

**B1. Settings form**

```text
Implement dashboard/src/features/settings/index.tsx (replace the placeholder). Read session and settings from useSessionContext().
- Three number inputs with units and helper text: "Mark as Distracted after (seconds away from Meet)" distracted_after_seconds, "Mark as Idle after (seconds without input)" idle_after_seconds, "Mark as Offline after (seconds without a signal)" offline_after_seconds. Use the exact keys and defaults from docs/CONTRACTS.md.
- Save writes the merged settings object to sessions.settings via an update (RLS allows the owner). Show saving, success and error states. Because SessionContext already subscribes to sessions realtime, the Live Board must update on its own; verify this works and do not edit SessionContext.
- A "Reset to defaults" button and an "unsaved changes" indicator with a Discard button.
```

**B2. Validation and presets**

```text
Extend the settings feature:
- Validation rules in a pure function validateSettings(): each value an integer; distracted 15–600; idle 60–1800; offline 60–600 and never less than 60 (the extension sends a heartbeat every 30 s, so anything lower causes false Offline). Show inline field errors and block Save while invalid.
- Presets as buttons: Relaxed (120 / 300 / 120), Normal (60 / 180 / 90), Strict (30 / 90 / 75). The active preset is highlighted when values match.
- Put validateSettings and preset helpers in dashboard/src/features/settings/logic.ts with Vitest tests for every rule and boundary.
```

**B3. Preview and explanation**

```text
Add a read-only "How statuses are decided" panel to the settings tab that explains Active, Distracted, Idle and Offline in plain language using the CURRENT form values (updating as the user types, before saving). Add a small live preview: using the real participants from useSessionContext(), show how many students would be in each status under the unsaved values versus the saved ones, by calling getStatus() from lib/status.ts (do not modify that file).
```

**Done when:** changing a threshold changes live-board statuses within seconds without refresh; invalid input is blocked; tests pass.

---

## Track C — Post-Class Report + CSV Export (ABENOJA)

**Owner folders:** `dashboard/src/features/report/`, `supabase/migrations/4xx`.
**What it does:** after (or during) class, shows each student's attendance and engagement and exports it as CSV.
**Uses (already built):** `heartbeats`, `participants`, `checkins`, `checkin_responses`, `sessions.settings`.

**C1. Report SQL function**

```text
Read AGENTS.md and docs/CONTRACTS.md. Write supabase/migrations/401_report_function.sql with a function get_session_report(p_session_id uuid) that is `security invoker` (so RLS limits it to the instructor who owns the session) and returns one row per participant:
student_name, joined_at, last_seen_at, tracked_seconds, active_seconds, distracted_seconds, idle_seconds, offline_seconds, attendance_pct (tracked non-offline time divided by session duration, capped at 100), checkins_sent, checkins_answered, avg_checkin_response_seconds.

Method: order each participant's heartbeats by created_at; each heartbeat represents the time until the next heartbeat (or until the session ended_at / now() for the last one). Cap any interval at the session's offline_after_seconds (default 90); the time beyond the cap counts as offline.
Classification per interval: offline if meet_tab_open is false; otherwise distracted if the student had been continuously unfocused for longer than distracted_after_seconds; otherwise idle if continuously non-active for longer than idle_after_seconds; otherwise active. Read the thresholds from sessions.settings with coalesce defaults 60 / 180 / 90.
Preferred: implement the "continuously for longer than" rule with a gaps-and-islands approach using window functions. Acceptable fallback if too complex: classify each heartbeat on its own (unfocused = distracted, non-active = idle) and put a SQL comment explaining that this differs slightly from the live thresholds.
Also add a joined boolean column to every row. If the session has roster entries, ALSO return roster entries that have no participant as rows with joined = false, all durations 0, attendance_pct 0, checkins_answered 0 and checkins_sent = the number of check-ins sent in the session.
Provide a test script supabase/tests/report_test.sql that creates sample heartbeats and roster entries and shows the expected output with comments.
```

**C2. Report tab UI**

```text
Implement dashboard/src/features/report/index.tsx (replace the placeholder). Call supabase.rpc('get_session_report', {p_session_id}) for the current session from useSessionContext().
- Summary cards: students joined, students not joined (absent), average attendance % (over everyone on the roster), average active %, overall check-in response rate.
- A sortable table (click headers) with student name, attendance %, and active / distracted / idle / offline time formatted as "42m 10s". Rows with joined = false show a gray "Did not join" badge and dashes instead of times.
- A horizontal stacked bar per student showing the share of active / distracted / idle / offline time with the same colors and text labels as lib/status.ts STATUS_META (read-only import).
- If the session is still live, show a note "Live session: numbers will keep changing" and a Refresh button; if ended, show the final report.
- Loading, error and empty states. Put formatting and percentage logic in pure functions in report/logic.ts with Vitest tests.
```

**C3. CSV export**

```text
Add an "Export CSV" button to the report tab. Build the CSV client-side from the same data shown in the table: columns student_name, joined (yes/no), attendance_pct, active_minutes, distracted_minutes, idle_minutes, offline_minutes, checkins_answered, checkins_sent, avg_response_seconds. Properly escape commas, quotes and newlines; prefix a UTF-8 BOM so Excel opens Filipino characters correctly; filename classpulse_<classcode>_<YYYY-MM-DD>.csv; download via a Blob. Put the CSV builder in report/csv.ts with Vitest tests (including names with commas and quotes).
```

**Done when:** simulate a class for 10 minutes, end the session, the report numbers look sensible, the CSV opens correctly in Excel/Sheets, tests pass.

---

## Track D — Live Board & UX (ESTRELLA)

**Owner folder:** `dashboard/src/features/live-board/`. **Migrations:** 5xx (probably none).
**What it does:** turns the basic status grid into the instructor's main working screen.
**Uses (already built):** `useSessionContext()`, `getStatus()`, `STATUS_META`, `heartbeats` (read-only by RLS).

**D1. Summary bar and filters**

```text
Extend dashboard/src/features/live-board/. Add a summary bar at the top with counts of Active, Distracted, Idle, Offline and Not Joined plus the total, using `rows` from useSessionContext() (statuses are already computed there). Clicking a count filters the grid to that status (click again to clear). Add a search box (by name) and a sort selector: "Needs attention first" (distracted, idle, offline, not joined, active), Name A–Z, Last seen. Keep filter/sort logic in pure functions in live-board/logic.ts with Vitest tests.
```

**D2. Student detail drawer**

```text
Clicking a student card opens a side drawer showing: name, current status with a plain-language reason ("Meet tab not focused for 2m 10s"), joined time, last seen, and a timeline strip of the last 30 minutes built from that participant's heartbeats (query the heartbeats table filtered by participant_id and created_at, refreshing every 15 seconds while the drawer is open). Each timeline segment is colored/labeled by status using the same rules as getStatus() but evaluated per heartbeat interval. Add a small legend, Esc-to-close, and focus trapping for accessibility. For a Not Joined row, show only the name and "Has not joined yet" (no timeline).
```

**D3. Empty state and polish**

```text
Polish the live board: (1) when there are no rows (no roster and nobody has joined), show a large class code with a Copy button and 3 plain steps for students ("Install the ClassPulse extension → enter this code and pick your name → join the Meet"); (2) show a subtle "live" indicator and the time since the last update; (3) smooth card transitions when status changes (respect prefers-reduced-motion); (4) make it responsive down to a phone width; (5) accessibility: status never conveyed by color alone, keyboard-focusable cards, aria-live for status changes summarized politely (not one announcement per card).
```

**D4. Needs-attention panel (optional stretch)**

```text
Add a collapsible "Needs attention" panel listing students who have been Distracted or Idle the longest, with elapsed time, sorted descending, updating every 5 seconds from useSessionContext().now. Include a compact toggle to switch the main grid between Cards and Table views.
```

**Done when:** with the simulator running 25 students, filtering, search, sorting and the drawer all stay smooth and readable on a projector and on a phone.

---

# PART C — Integration, Docs, Demo

## C1. Merge order and integration (Day 6)

1. Merge in this order: **B (Thresholds) → D (Live Board) → C (Report) → A (Check-ins)** (A last because it touches the extension).
2. After each merge, everyone runs `git pull --rebase origin main`.
3. Kurt adds the single `registerCheckinListeners()` call in `background.js` if Track A hasn't.
4. Full test with a real Google Meet (at least 3 real students plus the simulator).

**Integration bug prompt (use anywhere):**

```text
I'm seeing this bug: <describe, what you expected, what happened>. Here are the console errors / network responses: <paste>. First explain the most likely cause by reading the relevant files (do not guess). Then propose the smallest fix. Tell me which files you will change before changing them, and confirm none of them belong to another track.
```

## C2. Documentation prompts (Day 7)

```text
Read the whole repo. Rewrite README.md for ClassPulse with: one-paragraph overview, architecture diagram in Mermaid (extension → Supabase RPC → database → Realtime → dashboard), feature list per track, setup steps (Supabase, dashboard, extension, simulator), the status rules, the privacy statement (what is and isn't collected), known limitations, and a team/credits section with placeholders for our names. Verify every command and file path against the repo.
```

```text
From docs/ClassPulse_MVP.md and the actual code, draft the sections for our school paper: Introduction, Problem Statement, Objectives, System Architecture, Methodology (extension signals, status rules, check-ins), Implementation (stack, database design), Testing Results (leave table placeholders for our real results), Privacy and Ethical Considerations (Data Privacy Act of 2012), Limitations, Conclusion and Future Work. Write in clear academic English and mark every claim that must be confirmed by our own testing with [VERIFY].
```

## C3. Final checklist

- [ ] No secrets in the repo (`git log -p | grep -i service_role` returns nothing)
- [ ] Supabase RLS verified (second instructor account cannot see the first one's data)
- [ ] Consent screen shown before tracking starts
- [ ] Roster flow verified: Not Joined shows, name claim works, double-claim is blocked, release works
- [ ] Demo script from `ClassPulse_MVP.md` rehearsed end to end
- [ ] Extension loadable by classmates (zip of `/extension` plus 3-line install guide)
- [ ] Each member can explain their own track's code (the prof may ask)

---

## Appendix: Troubleshooting Prompts

| Problem | Prompt to use |
|---|---|
| AI changed files it shouldn't have | *"Revert your changes to <files>. They belong to another track. Redo the task using only files in my track."* |
| AI invents tables or columns | *"Re-read docs/CONTRACTS.md. The column you used does not exist. Use only documented fields, or tell me what's missing."* |
| Realtime isn't updating | *"Check the Supabase Realtime subscription: is the table in the supabase_realtime publication, does the filter match, is RLS letting this user select those rows, and are we cleaning up channels? Show me how to verify each in the Supabase dashboard."* |
| Extension service worker stops | *"MV3 service workers sleep. Verify nothing depends on in-memory state, that the alarm is re-created on startup, and that all state lives in chrome.storage."* |
| Build or lint fails | *"Here's the full error output: <paste>. Fix the root cause, not by silencing the rule or adding `any`."* |
