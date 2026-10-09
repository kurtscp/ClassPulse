// Owned by Track A
console.log('ClassPulse: Check-in overlay script loaded.');

let overlayHost = null;
let timer = null;

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'SHOW_CHECKIN_OVERLAY') {
    showOverlay(msg.checkin);
  } else if (msg.type === 'HIDE_CHECKIN_OVERLAY') {
    hideOverlay();
  }
});

function showOverlay(checkin) {
  if (overlayHost) return;

  overlayHost = document.createElement('div');
  overlayHost.style.position = 'fixed';
  overlayHost.style.top = '20px';
  overlayHost.style.right = '20px';
  overlayHost.style.zIndex = '9999999';
  
  const shadow = overlayHost.attachShadow({ mode: 'closed' });
  
  const style = document.createElement('style');
  style.textContent = `
    .checkin-banner {
      background: #fff;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      padding: 16px;
      font-family: system-ui, -apple-system, sans-serif;
      width: 250px;
      border-left: 4px solid #10b981;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .checkin-title {
      font-weight: bold;
      color: #333;
      margin: 0;
      font-size: 16px;
    }
    .checkin-timer {
      font-size: 14px;
      color: #666;
    }
    .checkin-btn {
      background: #10b981;
      color: white;
      border: none;
      padding: 8px 12px;
      border-radius: 4px;
      cursor: pointer;
      font-weight: bold;
      font-size: 14px;
    }
    .checkin-btn:hover:not(:disabled) {
      background: #059669;
    }
    .checkin-btn:disabled {
      opacity: 0.7;
      cursor: not-allowed;
    }
  `;

  const banner = document.createElement('div');
  banner.className = 'checkin-banner';

  const title = document.createElement('p');
  title.className = 'checkin-title';
  title.textContent = 'Are you still with us?';

  const timerText = document.createElement('p');
  timerText.className = 'checkin-timer';

  const btn = document.createElement('button');
  btn.className = 'checkin-btn';
  btn.textContent = "I'm here";
  
  btn.onclick = () => {
    btn.disabled = true;
    btn.textContent = "Confirming...";
    
    chrome.runtime.sendMessage({ type: 'CHECKIN_CONFIRM', checkinId: checkin.id }, (response) => {
      if (chrome.runtime.lastError || (response && response.error)) {
        btn.disabled = false;
        btn.textContent = "Error, try again";
        btn.style.backgroundColor = "#ef4444";
      } else {
        hideOverlay();
      }
    });
  };

  banner.appendChild(title);
  banner.appendChild(timerText);
  banner.appendChild(btn);

  shadow.appendChild(style);
  shadow.appendChild(banner);

  document.body.appendChild(overlayHost);

  const expiresAt = new Date(checkin.expires_at).getTime();
  
  timer = setInterval(() => {
    const now = Date.now();
    const remaining = expiresAt - now;
    if (remaining <= 0) {
      hideOverlay();
    } else {
      timerText.textContent = \`Expires in \${Math.ceil(remaining / 1000)}s\`;
    }
  }, 1000);
  
  const initialRemaining = expiresAt - Date.now();
  timerText.textContent = \`Expires in \${Math.ceil(initialRemaining / 1000)}s\`;
}

function hideOverlay() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  if (overlayHost) {
    overlayHost.remove();
    overlayHost = null;
  }
}
