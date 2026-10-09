// Owned by Track A (Perez)
import { getState } from '../lib/state.js';
import { rpc } from '../lib/supabase.js';

export async function handlePendingCheckin(checkin) {
  if (new Date(checkin.expires_at) < new Date()) {
    return;
  }
  
  const { handledCheckins = [] } = await chrome.storage.local.get('handledCheckins');
  if (handledCheckins.includes(checkin.id)) {
    return;
  }
  
  const newHandled = [...handledCheckins, checkin.id].slice(-20);
  await chrome.storage.local.set({ handledCheckins: newHandled });

  // 1. send message to one meet tab (prefer active)
  const tabs = await chrome.tabs.query({ url: "https://meet.google.com/*" });
  if (tabs.length > 0) {
    const targetTab = tabs.find(t => t.active) || tabs[0];
    chrome.tabs.sendMessage(targetTab.id, {
      type: 'SHOW_CHECKIN_OVERLAY',
      checkin
    }).catch(() => {});
  }

  // 2. create notification fallback
  chrome.notifications.create(`checkin_${checkin.id}`, {
    type: 'basic',
    iconUrl: 'icons/icon-128.png',
    title: 'Are you still with us?',
    message: 'Please confirm you are still here.',
    buttons: [{ title: "I'm here" }],
    requireInteraction: true
  });
}

const confirmingIds = new Set();

export function registerCheckinListeners() {
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === 'CHECKIN_CONFIRM') {
      handleConfirm(msg.checkinId)
        .then(() => sendResponse({ success: true }))
        .catch((err) => sendResponse({ error: err.message }));
      return true; // Keep channel open for async response
    }
  });

  chrome.notifications.onButtonClicked.addListener((notificationId, buttonIndex) => {
    if (notificationId.startsWith('checkin_') && buttonIndex === 0) {
      const checkinId = notificationId.replace('checkin_', '');
      handleConfirm(checkinId).catch(() => {
        chrome.notifications.create({
          type: 'basic',
          iconUrl: 'icons/icon-128.png',
          title: 'Check-in Error',
          message: 'Failed to confirm check-in due to a network error.',
        });
      });
    }
  });
}

async function handleConfirm(checkinId) {
  if (confirmingIds.has(checkinId)) return;
  confirmingIds.add(checkinId);

  try {
    const state = await getState();
    if (!state.token) throw new Error("No token found");

    try {
      await rpc('respond_checkin', { p_token: state.token, p_checkin_id: checkinId });
    } catch (e) {
      // Retry once after 3 seconds
      await new Promise(r => setTimeout(r, 3000));
      await rpc('respond_checkin', { p_token: state.token, p_checkin_id: checkinId });
    }

    // Clear notification
    chrome.notifications.clear(`checkin_${checkinId}`);

    // Hide overlays in tabs
    const tabs = await chrome.tabs.query({ url: "https://meet.google.com/*" });
    for (const tab of tabs) {
      chrome.tabs.sendMessage(tab.id, {
        type: 'HIDE_CHECKIN_OVERLAY',
        checkinId
      }).catch(() => {});
    }
  } finally {
    confirmingIds.delete(checkinId);
  }
}
