export async function collectSignals(meetLink) {
  let targetCode = null;
  if (meetLink) {
    const m = meetLink.match(/meet\.google\.com\/([a-z]{3}-[a-z]{4}-[a-z]{3})/i);
    if (m) {
      targetCode = m[1].toLowerCase();
    }
  }

  const meetRegex = /^https:\/\/meet\.google\.com\/([a-z]{3}-[a-z]{4}-[a-z]{3})/;
  
  function isMatch(url) {
    if (!url) return false;
    const match = url.match(meetRegex);
    if (!match) return false;
    const code = match[1].toLowerCase();
    if (targetCode && code !== targetCode) return false;
    return true;
  }

  let meet_tab_open = false;
  let meet_tab_focused = false;

  const windows = await chrome.windows.getAll({ populate: true });
  for (const win of windows) {
    let activeTabMatches = false;

    if (win.tabs) {
      for (const tab of win.tabs) {
        if (isMatch(tab.url)) {
          meet_tab_open = true;
          if (tab.active) {
            activeTabMatches = true;
          }
        }
      }
    }

    // Window must be focused, and the active tab in that window must be the Meet tab
    if (win.focused && activeTabMatches) {
      meet_tab_focused = true;
    }
  }

  let system_state = 'active';
  if (chrome.idle) {
    system_state = await new Promise(resolve => {
      chrome.idle.queryState(15, resolve);
    });
  }

  return { meet_tab_open, meet_tab_focused, system_state };
}
