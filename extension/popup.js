import { getState, setState } from './lib/state.js';
import { rpc } from './lib/supabase.js';

const ui = {
  loading: document.getElementById('loadingView'),
  setup: document.getElementById('setupView'),
  tracking: document.getElementById('trackingView'),
  
  // Setup elements
  classCode: document.getElementById('classCode'),
  rosterContainer: document.getElementById('rosterContainer'),
  rosterSelect: document.getElementById('rosterSelect'),
  rosterMessage: document.getElementById('rosterMessage'),
  freeTextContainer: document.getElementById('freeTextContainer'),
  studentName: document.getElementById('studentName'),
  consentCheck: document.getElementById('consentCheck'),
  setupError: document.getElementById('setupError'),
  startBtn: document.getElementById('startBtn'),
  
  // Tracking elements
  trackClassName: document.getElementById('trackClassName'),
  trackStudentName: document.getElementById('trackStudentName'),
  trackStatus: document.getElementById('trackStatus'),
  trackError: document.getElementById('trackError'),
  stopBtn: document.getElementById('stopBtn')
};

let currentRosterData = null;

async function init() {
  ui.loading.classList.remove('hidden');
  const state = await getState();
  ui.loading.classList.add('hidden');

  if (state.tracking) {
    showTracking(state);
  } else {
    showSetup(state);
  }
}

function showTracking(state) {
  ui.setup.classList.add('hidden');
  ui.tracking.classList.remove('hidden');
  
  ui.trackClassName.textContent = state.className || state.classCode;
  ui.trackStudentName.textContent = state.studentName;
  ui.trackStatus.textContent = state.lastStatusText || 'Waiting for meet tab...';
  
  if (state.lastError) {
    ui.trackError.textContent = state.lastError;
    ui.trackError.classList.remove('hidden');
  } else {
    ui.trackError.classList.add('hidden');
  }
}

function showSetup(state) {
  ui.tracking.classList.add('hidden');
  ui.setup.classList.remove('hidden');
  if (state.classCode) ui.classCode.value = state.classCode;
  if (state.studentName && !state.rosterEntryId) ui.studentName.value = state.studentName;
  
  handleCodeInput();
}

let debounceTimer = null;
ui.classCode.addEventListener('input', () => {
  ui.classCode.value = ui.classCode.value.toUpperCase();
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(handleCodeInput, 300);
});

ui.studentName.addEventListener('input', validateForm);
ui.rosterSelect.addEventListener('change', validateForm);
ui.consentCheck.addEventListener('change', validateForm);

async function handleCodeInput() {
  const code = ui.classCode.value.trim();
  const validFormat = /^[A-Z]{3}-\d{4}$/.test(code);
  
  if (!validFormat) {
    ui.rosterContainer.classList.add('hidden');
    ui.freeTextContainer.classList.add('hidden');
    ui.setupError.classList.add('hidden');
    currentRosterData = null;
    validateForm();
    return;
  }
  
  try {
    ui.setupError.classList.add('hidden');
    const data = await rpc('get_roster', { p_class_code: code });
    currentRosterData = data;
    
    if (data.has_roster) {
      ui.freeTextContainer.classList.add('hidden');
      ui.rosterContainer.classList.remove('hidden');
      
      ui.rosterSelect.innerHTML = '<option value="">Select your name...</option>';
      if (data.entries && data.entries.length > 0) {
        data.entries.forEach(entry => {
          const opt = document.createElement('option');
          opt.value = entry.id;
          opt.textContent = entry.student_name;
          ui.rosterSelect.appendChild(opt);
        });
        ui.rosterSelect.classList.remove('hidden');
        ui.rosterMessage.classList.add('hidden');
      } else {
        ui.rosterSelect.classList.add('hidden');
        ui.rosterMessage.textContent = "All names are taken. Ask your instructor to release yours.";
        ui.rosterMessage.classList.remove('hidden');
      }
    } else {
      ui.rosterContainer.classList.add('hidden');
      ui.freeTextContainer.classList.remove('hidden');
    }
  } catch (err) {
    ui.setupError.textContent = `Error fetching class: ${err.message}`;
    ui.setupError.classList.remove('hidden');
    currentRosterData = null;
    ui.rosterContainer.classList.add('hidden');
    ui.freeTextContainer.classList.add('hidden');
  }
  
  validateForm();
}

function validateForm() {
  let valid = false;
  const code = ui.classCode.value.trim();
  if (/^[A-Z]{3}-\d{4}$/.test(code) && ui.consentCheck.checked && currentRosterData) {
    if (currentRosterData.has_roster) {
      if (ui.rosterSelect.value) valid = true;
    } else {
      if (ui.studentName.value.trim().length > 0) valid = true;
    }
  }
  ui.startBtn.disabled = !valid;
}

ui.startBtn.addEventListener('click', async () => {
  ui.startBtn.disabled = true;
  ui.setupError.classList.add('hidden');
  
  const code = ui.classCode.value.trim();
  const state = await getState();
  
  // Try to reuse token if class code matches
  if (state.classCode === code && state.token) {
    await setState({ tracking: true, lastError: null });
    chrome.runtime.sendMessage({ type: 'START_TRACKING' });
    init();
    return;
  }
  
  let p_student_name = '';
  let p_roster_entry_id = null;
  
  if (currentRosterData.has_roster) {
    p_roster_entry_id = ui.rosterSelect.value;
    p_student_name = ui.rosterSelect.options[ui.rosterSelect.selectedIndex].text;
  } else {
    p_student_name = ui.studentName.value.trim();
  }
  
  try {
    const res = await rpc('join_session', { 
      p_class_code: code, 
      p_student_name, 
      p_roster_entry_id 
    });
    
    await setState({
      tracking: true,
      participantId: res.participant_id,
      token: res.token,
      sessionId: res.session_id,
      classCode: code,
      className: res.class_name,
      meetLink: res.meet_link,
      studentName: p_student_name,
      rosterEntryId: p_roster_entry_id,
      lastError: null,
      lastStatusText: 'Waiting for meet tab...'
    });
    
    chrome.runtime.sendMessage({ type: 'START_TRACKING' });
    init();
  } catch (err) {
    ui.setupError.textContent = err.message;
    ui.setupError.classList.remove('hidden');
    ui.startBtn.disabled = false;
    
    if (err.message.toLowerCase().includes('taken') || err.message.toLowerCase().includes('roster')) {
      handleCodeInput(); 
    }
  }
});

ui.stopBtn.addEventListener('click', async () => {
  await setState({ tracking: false });
  chrome.runtime.sendMessage({ type: 'STOP_TRACKING' });
  init();
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.appState) {
    const state = changes.appState.newValue;
    if (state.tracking && !ui.tracking.classList.contains('hidden')) {
      showTracking(state);
    } else if (!state.tracking && !ui.setup.classList.contains('hidden')) {
      showSetup(state);
    } else {
      init();
    }
  }
});

init();
