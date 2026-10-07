import { getState, setState } from './lib/state.js';
import { rpc } from './lib/supabase.js';
import { collectSignals } from './lib/collectors.js';
import { handlePendingCheckin } from './modules/checkin.js';

async function updateBadge(isTracking) {
  if (isTracking) {
    await chrome.action.setBadgeText({ text: 'ON' });
    await chrome.action.setBadgeBackgroundColor({ color: '#10b981' });
  } else {
    await chrome.action.setBadgeText({ text: '' });
  }
}

async function runHeartbeat() {
  const state = await getState();
  if (!state.tracking || !state.token) return;

  try {
    const signals = await collectSignals(state.meetLink);
    
    let statusText = 'No Meet tab found';
    if (signals.meet_tab_open) {
      if (signals.meet_tab_focused) {
        statusText = 'Meet tab detected & focused';
      } else {
        statusText = 'Meet tab detected (in background)';
      }
    }
    if (signals.system_state !== 'active') {
      statusText += ` [System ${signals.system_state}]`;
    }

    const res = await rpc('send_heartbeat', {
      p_token: state.token,
      p_meet_tab_open: signals.meet_tab_open,
      p_meet_tab_focused: signals.meet_tab_focused,
      p_system_state: signals.system_state
    });

    if (res && res.session_status === 'ended') {
      await setState({ tracking: false, lastError: 'This session has ended. Check with your instructor if you think this is a mistake.', lastStatusText: 'Session ended by instructor.' });
      await chrome.alarms.clear('heartbeat');
      await updateBadge(false);
      return;
    }

    await setState({ lastError: null, lastStatusText: statusText });
    await updateBadge(true);

    if (res && res.pending_checkin) {
      try {
        await handlePendingCheckin(res.pending_checkin);
      } catch (err) {
        console.error('Check-in handling failed:', err);
      }
    }
  } catch (err) {
    const msg = (err.message || '').toLowerCase();
    // Typical messages indicating removed/invalid token:
    if (msg.includes('token') || msg.includes('participant') || msg.includes('unauthorized') || msg.includes('not found') || msg.includes('invalid')) {
      await setState({ tracking: false, lastError: 'Tracking stopped. You were removed from this session by your instructor.' });
      await chrome.alarms.clear('heartbeat');
      await updateBadge(false);
    } else {
      console.error('Heartbeat error:', err);
      // General network error
      await setState({ lastError: 'Unable to connect. Please check your internet connection and try again.' });
    }
  }
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'START_TRACKING') {
    chrome.alarms.create('heartbeat', { periodInMinutes: 0.5 });
    updateBadge(true);
    runHeartbeat();
  } else if (msg.type === 'STOP_TRACKING') {
    chrome.alarms.clear('heartbeat');
    updateBadge(false);
  }
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'heartbeat') {
    runHeartbeat();
  }
});

async function checkStartup() {
  const state = await getState();
  if (state.tracking) {
    const alarm = await chrome.alarms.get('heartbeat');
    if (!alarm) {
      chrome.alarms.create('heartbeat', { periodInMinutes: 0.5 });
    }
    updateBadge(true);
    runHeartbeat();
  } else {
    updateBadge(false);
  }
}

chrome.runtime.onStartup.addListener(checkStartup);
chrome.runtime.onInstalled.addListener(checkStartup);
