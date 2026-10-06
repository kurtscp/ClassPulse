# ClassPulse Contracts

This document strictly defines the exact database schema, API contracts, domain rules, and track ownership derived from our SQL migrations.

## 1. Tables and Columns

### `sessions`
| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | PK, default `gen_random_uuid()` |
| `instructor_id` | `uuid` | Not null, references `auth.users(id)` |
| `class_name` | `text` | Not null |
| `meet_link` | `text` | |
| `class_code` | `text` | Not null, unique |
| `status` | `text` | Not null, default `'live'` |
| `settings` | `jsonb` | Not null, default `'{}'::jsonb` |
| `started_at` | `timestamptz` | Not null, default `now()` |
| `ended_at` | `timestamptz` | |

### `participants`
| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | PK, default `gen_random_uuid()` |
| `session_id` | `uuid` | Not null, references `sessions(id)` ON DELETE CASCADE |
| `student_name` | `text` | Not null |
| `joined_at` | `timestamptz` | Not null, default `now()` |
| `last_seen_at` | `timestamptz` | |
| `meet_tab_open` | `boolean` | Not null, default `false` |
| `meet_tab_focused` | `boolean` | Not null, default `false` |
| `system_state` | `text` | Not null, default `'active'` |
| `unfocused_since` | `timestamptz` | |
| `idle_since` | `timestamptz` | |

### `participant_tokens`
*(Secret table; no read/write policies)*
| Column | Type | Notes |
|---|---|---|
| `participant_id` | `uuid` | PK, references `participants(id)` ON DELETE CASCADE |
| `token` | `uuid` | Not null, unique, default `gen_random_uuid()` |

### `heartbeats`
| Column | Type | Notes |
|---|---|---|
| `id` | `bigint` | PK, generated always as identity |
| `participant_id` | `uuid` | Not null, references `participants(id)` ON DELETE CASCADE |
| `session_id` | `uuid` | Not null, references `sessions(id)` ON DELETE CASCADE |
| `meet_tab_open` | `boolean` | Not null |
| `meet_tab_focused` | `boolean` | Not null |
| `system_state` | `text` | Not null, in `('active', 'idle', 'locked')` |
| `created_at` | `timestamptz` | Not null, default `now()` |

### `checkins`
| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | PK, default `gen_random_uuid()` |
| `session_id` | `uuid` | Not null, references `sessions(id)` ON DELETE CASCADE |
| `sent_at` | `timestamptz` | Not null, default `now()` |
| `expires_at` | `timestamptz` | Not null, default `now() + interval '2 minutes'` |

### `checkin_responses`
| Column | Type | Notes |
|---|---|---|
| `checkin_id` | `uuid` | PK (compound), references `checkins(id)` ON DELETE CASCADE |
| `participant_id` | `uuid` | PK (compound), references `participants(id)` ON DELETE CASCADE |
| `responded_at` | `timestamptz` | Not null, default `now()` |

### `roster_entries`
| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | PK, default `gen_random_uuid()` |
| `session_id` | `uuid` | Not null, references `sessions(id)` ON DELETE CASCADE |
| `student_name` | `text` | Not null |
| `participant_id` | `uuid` | References `participants(id)` ON DELETE SET NULL |
| `claimed_at` | `timestamptz` | |


## 2. RPC Functions

### `create_session(p_class_name text, p_meet_link text)`
- **Callable by:** `authenticated`
- **Returns:** The created `sessions` row.

### `join_session(p_class_code text, p_student_name text, p_roster_entry_id uuid default null)`
- **Callable by:** `anon`, `authenticated`
- **Returns:**
  ```json
  {
    "participant_id": "<uuid>",
    "token": "<uuid>",
    "session_id": "<uuid>",
    "class_name": "<text>",
    "meet_link": "<text>"
  }
  ```

### `send_heartbeat(p_token uuid, p_meet_tab_open boolean, p_meet_tab_focused boolean, p_system_state text)`
- **Callable by:** `anon`, `authenticated`
- **Returns:**
  ```json
  {
    "session_status": "live" | "ended",
    "pending_checkin": null | {
      "id": "<uuid>",
      "sent_at": "<timestamptz>",
      "expires_at": "<timestamptz>"
    }
  }
  ```

### `respond_checkin(p_token uuid, p_checkin_id uuid)`
- **Callable by:** `anon`, `authenticated`
- **Returns:** `boolean` (true if successfully recorded or previously recorded, false if expired or invalid).

### `get_roster(p_class_code text)`
- **Callable by:** `anon`, `authenticated`
- **Returns:** Only lists strictly unclaimed roster slots.
  ```json
  {
    "has_roster": true | false,
    "entries": [
      {
        "id": "<uuid>",
        "student_name": "<text>"
      }
    ]
  }
  ```

### `release_roster_entry(p_entry_id uuid)`
- **Callable by:** `authenticated`
- **Returns:** `boolean`


## 3. Heartbeat Payload

The Chrome extension must invoke `send_heartbeat` periodically with:
- `p_token`: The student's secret authentication token (`uuid`)
- `p_meet_tab_open`: Is the class tab currently open in the browser? (`boolean`)
- `p_meet_tab_focused`: Is the class tab the currently active and focused tab? (`boolean`)
- `p_system_state`: Overall machine status natively reported by Chrome (`'active'`, `'idle'`, or `'locked'`).


## 4. Status Rules

The dashboard strictly computes participant statuses using the following prioritized conditions:
- **Offline:** `now - last_seen_at > offline_after_seconds` OR `meet_tab_open` is `false`
- **Distracted:** `meet_tab_open` is `true` AND NOT `meet_tab_focused` AND `now - unfocused_since > distracted_after_seconds`
- **Idle:** `system_state` is `'idle'` or `'locked'` AND `now - idle_since > idle_after_seconds`
- **Active:** Everything else
- **Not Joined:** A roster entry that has no linked participant (computed by the dashboard from `roster_entries`; never stored)

*Priority among joined students:* Offline > Distracted > Idle > Active.


## 5. Session Settings Configuration

The `sessions.settings` JSONB column natively supports the following keys and defaults (unknown or missing keys must fall back to these):
- `distracted_after_seconds` = `60`
- `idle_after_seconds` = `180`
- `offline_after_seconds` = `90`


## 6. Migration Number Ranges

- **001-004:** Foundation (Tables, Functions, Security, Roster)
- **2xx:** Check-ins
- **3xx:** Thresholds
- **4xx:** Report
- **5xx:** Live Board


## 7. Track Ownership

| Track | Owner / Target Files |
|---|---|
| **Foundation (Kurt)** | `supabase/migrations/001-004`<br/>`dashboard/src/app`<br/>`dashboard/src/lib`<br/>`dashboard/src/features/registry.ts`<br/>`extension/manifest.json`<br/>`extension/lib`<br/>`extension/background.js`<br/>`extension/popup.*` |
| **Track A Check-ins** | `dashboard/src/features/checkins/`<br/>`extension/modules/checkin.js`<br/>`extension/modules/checkin-overlay.js` |
| **Track B Thresholds** | `dashboard/src/features/settings/` |
| **Track C Report** | `dashboard/src/features/report/`<br/>`supabase/migrations/4xx` |
| **Track D Live Board** | `dashboard/src/features/live-board/` |
