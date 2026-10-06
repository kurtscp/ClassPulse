# ClassPulse — MVP Concept Document

> **Working title:** ClassPulse (rename freely)
> **One-line summary:** A Chrome extension plus a live instructor dashboard that shows whether students are actively attending a Google Meet class, and keeps them engaged through quick check-ins.

---

## 1. Background and Problem

Online classes on Google Meet give instructors very little visibility into attendance quality. A student can join the call and then switch to another tab, walk away, or leave the computer idle, and the instructor cannot tell. Meet's own attendance report only says who joined and for how long.

**Our assignment:** build a system that enhances the online learning experience by monitoring whether students are active, including whether the browser/class tab is open.

**Our approach:** a lightweight sensor in the student's browser (a Chrome extension) reports attendance signals to a cloud database, and the instructor sees them live on a web dashboard. A check-in feature lets the instructor confirm engagement in a student-friendly way instead of relying on surveillance alone.

---

## 2. Why Not a Website Alone?

A website can only observe its own tab. Google Meet cannot be embedded in a third-party site, so when a student is in the Meet tab, our website's tab is in the background and would be reported as "away." That would mark attentive students as inactive.

A browser extension solves this because it can see the browser's tabs and windows, so it knows whether the Meet tab is **open**, whether it is **in focus**, and whether the computer is **idle**.

---

## 3. System Overview

The system has three parts.

| Part | Role | Technology |
|---|---|---|
| **Chrome Extension** | Sensor. Runs on the student's browser and sends status heartbeats. | Chrome Extension Manifest V3 (JavaScript) |
| **Backend** | Stores sessions, students, heartbeats, and check-ins; pushes live updates. | Supabase (PostgreSQL + Realtime) or Firebase |
| **Web Dashboard** | Instructor view: create sessions, watch live status, trigger check-ins, export reports. | HTML/CSS/JS or React, hosted on Vercel/Netlify |

### Architecture

```
┌──────────────────────┐        heartbeat every ~30s         ┌───────────────────┐
│  Student's Browser   │ ──────────────────────────────────► │      Backend      │
│  ┌────────────────┐  │                                     │  (Supabase/DB)    │
│  │ Chrome Ext.    │  │ ◄────────── check-in prompts ────── │  + Realtime       │
│  │ - tab tracking │  │                                     └─────────┬─────────┘
│  │ - idle state   │  │                                               │ live updates
│  └────────────────┘  │                                               ▼
│  [ Google Meet tab ] │                                     ┌───────────────────┐
└──────────────────────┘                                     │ Instructor        │
                                                             │ Dashboard (web)   │
                                                             └───────────────────┘
```

---

## 4. How It Works (End to End)

### Before class
1. The instructor opens the dashboard and clicks **Create Session**.
2. They enter the class name, paste the Google Meet link, and paste the **class roster** (one student name per line). The system generates a short **class code** (for example `PUP-4821`).
3. The instructor shares the class code with students in the class group chat.

> The roster is what makes the **Not Joined** status possible: the system knows who is expected. If a session has no roster, students type their own name and Not Joined is not shown.

### Student joining
1. The student installs the extension (one time).
2. They click the extension icon, enter the **class code**, **pick their own name from the roster list**, and press **Start Tracking**. Each name can be claimed only once.
3. They join the Google Meet as usual.

### During class
1. Every ~30 seconds, the extension checks:
   - Is a tab on `meet.google.com` open?
   - Is that tab the one currently in focus?
   - Is the computer active, idle, or locked?
2. It sends a **heartbeat** to the backend.
3. The backend writes it to the database and broadcasts it live.
4. The dashboard updates each student's status card in real time.
5. The instructor can press **Send Check-in**. A small pop-up appears on each student's screen: *"Are you still with us? Click to confirm."* Responses (and response times) are logged.

### After class
1. The instructor clicks **End Session**.
2. The dashboard generates an **attendance and engagement report** per student: time joined, time active, time distracted, time idle, and check-ins answered. Roster students who never joined are listed as absent.
3. The report can be exported as CSV.

---

## 5. Student Status Rules

The dashboard converts raw heartbeats into one of five statuses.

| Status | Condition | Color |
|---|---|---|
| **Active** | Meet tab open and focused, and computer active | Green |
| **Distracted** | Meet tab open but another tab/window has been in focus for more than 60 seconds | Orange |
| **Idle** | No keyboard or mouse input for more than 3 minutes | Yellow |
| **Offline** | No heartbeat received for more than 90 seconds, or Meet tab closed | Red |
| **Not Joined** | Name is on the class roster but the student has not joined yet (no tracking started) | Gray |

> **Note on thresholds:** these values are defaults and should be adjustable in the instructor's session settings. A student passively listening to a lecture may register as Idle because no input is happening, so the Idle threshold is intentionally generous and the label reads "No input" rather than "Not paying attention."

> **Not Joined vs Offline:** *Not Joined* means the student never started tracking in this session (their roster name is unclaimed). *Offline* means the student did join but is no longer sending signals or has closed the Meet tab. Not Joined is computed by the dashboard from the roster and is never stored. It only appears for sessions that have a roster.

---

## 6. MVP Features

### Must-have (build first)
- [ ] **Instructor dashboard**
  - Create a session (class name, Meet link, auto-generated class code)
  - Live student list with color-coded status
  - End session button
- [ ] **Class roster**
  - Instructor pastes student names when creating a session (and can edit them later)
  - Students pick their name from the roster when joining; each name can be claimed only once
  - Instructor can release a claimed name (wrong name taken, or the student reinstalled)
  - Roster students who have not joined show as **Not Joined**
- [ ] **Chrome extension**
  - Popup to enter the class code and pick a name from the roster (free-text name if the session has no roster)
  - Detect whether a Meet tab is open
  - Detect whether the Meet tab is focused
  - Detect system idle state
  - Send heartbeat every ~30 seconds
  - Stop/Start tracking toggle visible to the student
- [ ] **Backend**
  - Tables for sessions, participants, and heartbeats
  - Realtime updates to the dashboard
- [ ] **Consent notice**
  - Shown in the extension before tracking starts, explaining exactly what is collected

### Should-have (build if time allows)
- [ ] **Check-in prompts:** instructor triggers a pop-up, students click to confirm, response time is logged
- [ ] **Post-class report:** per-student totals (active, distracted, idle minutes) and attendance percentage
- [ ] **CSV export** of the report
- [ ] **Adjustable thresholds** per session

### Nice-to-have (future work, mention in the paper)
- Google Sign-In for verified student identity
- Short in-class polls and quizzes
- Engagement score and trend charts across sessions
- Firefox support
- Mobile companion for students on phones
- Automatic roster import from Google Classroom or a CSV file

---

## 7. Data Model

**sessions**
| Field | Type | Notes |
|---|---|---|
| id | uuid | Primary key |
| class_name | text | |
| meet_link | text | |
| class_code | text | Unique, short |
| status | text | `live` or `ended` |
| started_at / ended_at | timestamp | |

**participants**
| Field | Type | Notes |
|---|---|---|
| id | uuid | Primary key |
| session_id | uuid | FK to sessions |
| student_name | text | |
| joined_at | timestamp | |

**roster_entries**
| Field | Type | Notes |
|---|---|---|
| id | uuid | Primary key |
| session_id | uuid | FK to sessions |
| student_name | text | Unique per session (case-insensitive) |
| participant_id | uuid | Null until the student claims the name |
| claimed_at | timestamp | |

> A roster entry with no `participant_id` is displayed as **Not Joined**. Students read the unclaimed names through a `get_roster(class_code)` function and claim one when joining. Instructors can release a claimed entry, which removes that participant.

**heartbeats**
| Field | Type | Notes |
|---|---|---|
| id | bigint | Primary key |
| participant_id | uuid | FK to participants |
| meet_tab_open | boolean | |
| meet_tab_focused | boolean | |
| system_state | text | `active`, `idle`, or `locked` |
| created_at | timestamp | Server time |

**checkins** *(should-have)*
| Field | Type | Notes |
|---|---|---|
| id | uuid | Primary key |
| session_id | uuid | FK |
| sent_at | timestamp | |

**checkin_responses** *(should-have)*
| Field | Type | Notes |
|---|---|---|
| checkin_id | uuid | FK |
| participant_id | uuid | FK |
| responded_at | timestamp | Null if no response |

### Example heartbeat

```json
{
  "participant_id": "7c1e...",
  "meet_tab_open": true,
  "meet_tab_focused": false,
  "system_state": "active"
}
```

---

## 8. Extension Technical Notes

| Need | Chrome API |
|---|---|
| Detect an open Meet tab | `chrome.tabs.query({ url: "https://meet.google.com/*" })` |
| Detect which tab is focused | `chrome.tabs.onActivated`, `chrome.windows.onFocusChanged` |
| Detect idle/locked computer | `chrome.idle.queryState(seconds)` |
| Run a repeating heartbeat | `chrome.alarms` (needed because Manifest V3 service workers go to sleep) |
| Remember name and class code | `chrome.storage.local` |
| Show check-in pop-up | Content script injected into the active tab, or `chrome.notifications` |

**Required permissions in `manifest.json`:** `tabs`, `idle`, `alarms`, `storage`, `notifications`, plus host permission for `https://meet.google.com/*` and the backend URL.

**Installing for the demo:** no Chrome Web Store needed. Open `chrome://extensions`, enable Developer Mode, click **Load unpacked**, and select the extension folder.

---

## 9. Privacy and Ethics

This system observes student behavior, so it must be transparent.

- **Consent first:** tracking starts only after the student reads the notice and clicks Start.
- **Minimal data:** only the signals in Section 7 are collected. The extension does **not** read page content, chat, camera, microphone, screen, keystrokes, or the names or URLs of other tabs.
- **Student visibility:** the extension icon clearly shows when tracking is on, and the student can stop at any time (which shows as Offline).
- **Scoped to class time:** tracking runs only while a session is live and the Meet tab is open.
- **Compliance:** the design should follow the principles of the Philippines' Data Privacy Act of 2012 (RA 10173): transparency, legitimate purpose, and proportionality.
- **Retention:** session data should be deleted or anonymized after the term.
- **Roster:** the roster contains only the names the instructor enters. Students see only the *unclaimed* names while joining, and only with the class code.

---

## 10. Limitations

- Tab focus does not prove a student is learning. Someone can leave Meet in focus and walk away. Idle detection and check-ins reduce this but cannot eliminate it.
- Passive listeners may register as Idle.
- Works on Chromium browsers only (Chrome, Edge, Brave) in the MVP.
- Roster names are first-come, first-served: a student could claim a classmate's name. The instructor can release a name, but there is no identity verification until Google Sign-In is added.
- Releasing a claimed name deletes that student's data for the session.
- The extension cannot see inside the Meet call (camera, mic, chat, or who is speaking).

---

## 11. Can This Be Vibe Coded?

**Yes.** The architecture is made of small, well-documented pieces (a Chrome extension, a database, and a dashboard), which AI coding assistants handle well. What matters is how you do it.

### Tips for vibe coding this project
1. **Build in thin slices.** Get one thing working end to end before adding the next. Suggested order: database → extension that sends a fake heartbeat → dashboard that shows it → real tab detection → idle detection → check-ins → report.
2. **One feature per prompt.** Avoid "build the whole system."
3. **Give the AI this document** as context at the start, then paste the relevant section for each task.
4. **Test every step yourself.** Run it, open the console, and confirm the data reaches the database before moving on.
5. **Protect your keys.** Use Supabase's public `anon` key in the extension and turn on Row Level Security. Never put a service-role key in extension or front-end code, and never commit secrets to GitHub.
6. **Commit often** so you can roll back when an AI edit breaks something.
7. **Understand what you submit.** Your instructor may ask you to explain the code, so have each member own and be able to explain one part.

### Sample prompts (in build order)

1. *"Create a Supabase schema for sessions, participants, and heartbeats with these fields: [paste Section 7]. Include Row Level Security policies that allow inserting heartbeats and reading sessions by class code."*
2. *"Build a Chrome Manifest V3 extension with a popup where the student enters their name and a class code. Save them in chrome.storage.local and show a Start/Stop Tracking button."*
3. *"Add a background service worker that uses chrome.alarms to run every 30 seconds, checks whether a tab on meet.google.com is open and focused, reads chrome.idle state, and POSTs a heartbeat to my Supabase REST endpoint."*
4. *"Build an instructor dashboard in plain HTML/CSS/JS with Supabase Realtime. It lists participants of a session with a color-coded status computed from the latest heartbeat using these rules: [paste Section 5]."*
5. *"Add a Send Check-in button on the dashboard that inserts a checkin row. Make the extension listen for new check-ins and show a notification with a Confirm button that records a response."*
6. *"Add an End Session button that generates a per-student report of active, distracted, and idle minutes from the heartbeats, with CSV export."*

---

## 12. One-Week Plan (Team of 5)

| Day | Focus |
|---|---|
| 1 | Finalize scope, set up GitHub repo, Supabase project, and schema (including the roster); wireframe the dashboard |
| 2 | Extension popup and storage; dashboard skeleton and session creation |
| 3 | Heartbeat logic (tab open, focus, idle) and live dashboard updates |
| 4 | Status rules, consent notice, end-to-end test with all members in a real Meet |
| 5 | Check-ins and post-class report; bug fixes |
| 6 | Polish UI, write documentation, prepare demo script |
| 7 | Buffer, final testing, submission |

### Suggested roles

| Member | Ownership |
|---|---|
| 1 | Extension: tab and idle detection, heartbeat |
| 2 | Backend: schema, security policies, realtime |
| 3 | Dashboard: live status board and session controls |
| 4 | Check-ins and reports/export |
| 5 | Documentation, UI/UX, privacy notice, testing, demo |

---

## 13. Demo Script (3 minutes)

1. Instructor creates a session, pastes a roster of 6 names, and gets class code `PUP-4821`.
2. Two or three team members join a real Meet, pick their names from the roster, and start tracking with the extension.
3. Dashboard shows the joined members as **Active** (green) and everyone else as **Not Joined** (gray).
4. One member switches to another tab: after about a minute their card turns **Distracted** (orange).
5. Another member stops moving the mouse: card turns **Idle** (yellow).
6. Instructor presses **Send Check-in**; students confirm and responses appear.
7. Instructor ends the session and opens the report, then exports the CSV.
8. Close by showing the consent notice and explaining what is and is not collected.

---

## 14. Testing Checklist

- [ ] Extension sends a heartbeat while the Meet tab is open
- [ ] Switching tabs changes status to Distracted after the threshold
- [ ] Closing Meet or stopping tracking changes status to Offline
- [ ] Leaving the computer untouched changes status to Idle
- [ ] Dashboard updates within a few seconds without refreshing
- [ ] Two or more students show correctly at the same time
- [ ] Roster names with no participant show as Not Joined, and switch to Active as soon as the student joins
- [ ] A claimed name disappears from the extension's dropdown; claiming it twice is blocked
- [ ] Releasing a claimed name stops that extension and returns the card to Not Joined
- [ ] Sessions created without a roster still work with a free-text name
- [ ] Check-in pop-up appears and the response is recorded
- [ ] Report totals match the heartbeat data
- [ ] No other tab names, URLs, or page content are ever sent
- [ ] Consent notice appears before the first heartbeat

---

## 15. Expected Outcomes

- Instructors gain clearer, real-time awareness of class participation.
- Students are kept engaged through lightweight check-ins rather than constant monitoring.
- Attendance records become more meaningful than "joined the call."
- The prototype demonstrates a scalable, privacy-conscious approach that can later grow into a full learning-engagement platform.
