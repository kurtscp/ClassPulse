# Check-in Prompts Testing Guide

This checklist verifies the edge cases and end-to-end functionality for Track A (Check-in Prompts), using a simulated environment for scale and a real extension for manual interaction.

## Setup

1. Open the Instructor Dashboard (`dashboard/`) and start a new session.
2. In a terminal, run the simulation script to populate the session with fake students:
   ```bash
   node scripts/simulate.mjs
   ```
3. Join the session as a real student using the ClassPulse Extension installed in Google Chrome. Open a Google Meet tab to simulate active tracking.

## Test Scenarios

### 1. Basic Flow (Success Path)
- [ ] From the dashboard, click **"Send Check-in"**.
- [ ] Verify the check-in overlay appears on the student's Google Meet tab.
- [ ] Verify a fallback notification appears in Chrome.
- [ ] Click **"I'm here"** in the overlay.
- [ ] Verify the overlay disappears.
- [ ] Verify the notification disappears.
- [ ] Check the dashboard: the response count should increase by 1.

### 2. Double Clicks & Loading State
- [ ] Send another check-in.
- [ ] Click **"I'm here"** on the overlay multiple times rapidly.
- [ ] Verify the button immediately disables and changes text to "Confirming...".
- [ ] Verify only one request is sent (dashboard response count increases by exactly 1).

### 3. Missing or Expired Check-ins
- [ ] Send a check-in.
- [ ] Let the countdown expire without clicking anything.
- [ ] Verify the overlay automatically hides.
- [ ] Restart the Service Worker (or simulate a missed heartbeat). Wait for the heartbeat to run again.
- [ ] Verify the expired check-in is **not** shown again.

### 4. Multiple Meet Tabs
- [ ] Open two separate Google Meet tabs (`https://meet.google.com/...`).
- [ ] Send a check-in.
- [ ] Verify the overlay appears in **only one** tab (preferring the active one).

### 5. Network Error & Retry Logic
- [ ] Send a check-in.
- [ ] Disconnect your internet connection (or block network requests via DevTools).
- [ ] Click **"I'm here"** on the overlay.
- [ ] Verify the button shows "Confirming...".
- [ ] Verify it silently retries after 3 seconds.
- [ ] Verify it eventually shows an error state ("Error, try again" in red).
- [ ] Restore your internet connection and click the button again.
- [ ] Verify it successfully completes and disappears.

### 6. Service Worker Restarts
- [ ] Send a check-in.
- [ ] Open Chrome Extension page (`chrome://extensions`) and forcefully stop the Service Worker.
- [ ] Click **"I'm here"** on the overlay.
- [ ] Verify the Service Worker wakes up, handles the message, confirms the check-in, and hides the overlay.
