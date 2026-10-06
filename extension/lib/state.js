/**
 * Retrieve the current tracking state from local storage.
 */
export async function getState() {
  const result = await chrome.storage.local.get('appState');
  return result.appState || {
    tracking: false,
    participantId: null,
    token: null,
    sessionId: null,
    classCode: null,
    className: null,
    meetLink: null,
    studentName: null,
    lastStatusText: null,
    lastError: null
  };
}

/**
 * Merge and save new properties into the tracking state.
 */
export async function setState(newState) {
  const current = await getState();
  const merged = { ...current, ...newState };
  await chrome.storage.local.set({ appState: merged });
  return merged;
}
