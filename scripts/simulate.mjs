import fs from 'fs';
import path from 'path';

// Manual .env parser
function loadEnv() {
  const envPaths = ['.env', 'dashboard/.env', 'dashboard/.env.example'];
  for (const p of envPaths) {
    if (fs.existsSync(p)) {
      const content = fs.readFileSync(p, 'utf8');
      for (const line of content.split('\n')) {
        const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
        if (match) {
          let key = match[1];
          let val = match[2] || '';
          val = val.replace(/^['"]|['"]$/g, '').trim();
          if (!process.env[key]) process.env[key] = val;
        }
      }
    }
  }
}

loadEnv();
const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error("Missing SUPABASE_URL or SUPABASE_KEY/ANON_KEY in env");
  process.exit(1);
}

// Parse args
const args = process.argv.slice(2);
let classCode = null;
let count = 12;
let interval = 5;
let useRoster = false;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--code') classCode = args[++i];
  else if (args[i] === '--count') count = parseInt(args[++i], 10);
  else if (args[i] === '--interval') interval = parseInt(args[++i], 10);
  else if (args[i] === '--roster') useRoster = true;
}

if (!classCode) {
  console.error("Usage: node scripts/simulate.mjs --code <CLASS_CODE> [--count N] [--interval N] [--roster]");
  process.exit(1);
}

const names = [
  "Juan dela Cruz", "Maria Clara", "Jose Rizal", "Andres Bonifacio",
  "Emilio Aguinaldo", "Apolinario Mabini", "Marcelo H. del Pilar", "Sultan Kudarat",
  "Juan Luna", "Melchora Aquino", "Gabriela Silang", "Lapu-Lapu", "Diego Silang",
  "Emilio Jacinto", "Gregorio del Pilar", "Miguel Malvar", "Macario Sakay",
  "Teresa Magbanua", "Antonio Luna", "Pedro Paterno"
];

const headers = {
  'Content-Type': 'application/json',
  'apikey': key,
  'Prefer': 'return=representation'
};
if (key.startsWith('eyJ')) {
  headers['Authorization'] = `Bearer ${key}`;
}

async function rpc(functionName, body) {
  const res = await fetch(`${url}/rest/v1/rpc/${functionName}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body)
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`RPC ${functionName} failed: ${res.status} ${text}`);
  }
  return text ? JSON.parse(text) : null;
}

const students = [];

async function simulate() {
  console.log(`Starting simulation for ${classCode}`);
  let targetNames = [];

  if (useRoster) {
    console.log(`Fetching roster...`);
    const rosterRes = await rpc('get_roster', { p_class_code: classCode });
    if (!rosterRes || !rosterRes.entries) {
      console.error("No roster found or session invalid.");
      process.exit(1);
    }
    const entries = rosterRes.entries;
    
    // 70% immediate, 10% delayed, 20% never
    for (const entry of entries) {
      const r = Math.random();
      if (r < 0.7) {
        targetNames.push({ name: entry.student_name, rosterId: entry.id, delay: 0 });
      } else if (r < 0.8) {
        targetNames.push({ name: entry.student_name, rosterId: entry.id, delay: 30 + Math.random() * 90 });
      }
    }
  } else {
    for (let i = 0; i < count; i++) {
      targetNames.push({ name: names[i % names.length] + (i >= names.length ? ` ${Math.floor(i/names.length)}` : ''), rosterId: null, delay: 0 });
    }
  }

  for (const t of targetNames) {
    setTimeout(async () => {
      try {
        const body = { p_class_code: classCode, p_student_name: t.name };
        if (t.rosterId) body.p_roster_entry_id = t.rosterId;
        const res = await rpc('join_session', body);
        console.log(`[JOIN] ${t.name} joined. Token: ${res.token.substring(0,6)}...`);
        students.push({
          name: t.name,
          token: res.token,
          nextStateChange: Date.now() + Math.random() * 60000,
          state: 0, // 0=active, 1=distracted, 2=idle, 3=silent
          silentUntil: 0
        });
      } catch (err) {
        console.error(`[ERROR] ${t.name} failed to join: ${err.message}`);
      }
    }, t.delay * 1000);
  }

  setInterval(() => {
    const now = Date.now();
    for (const s of students) {
      if (now < s.silentUntil) continue;

      if (now > s.nextStateChange) {
        const r = Math.random();
        if (r < 0.7) s.state = 0;
        else if (r < 0.85) s.state = 1;
        else if (r < 0.95) s.state = 2;
        else {
          s.state = 3;
          s.silentUntil = now + (30 + Math.random() * 60) * 1000;
        }
        s.nextStateChange = now + (15 + Math.random() * 60) * 1000;
      }

      if (s.state === 3) continue;

      let open = true;
      let focused = true;
      let systemState = 'active';

      if (s.state === 1) focused = false;
      if (s.state === 2) systemState = 'idle';

      rpc('send_heartbeat', {
        p_token: s.token,
        p_meet_tab_open: open,
        p_meet_tab_focused: focused,
        p_system_state: systemState
      }).then(res => {
        let label = s.state === 0 ? 'Active' : s.state === 1 ? 'Distracted' : 'Idle';
        console.log(`[HEARTBEAT] ${s.name} sent ${label}`);

        if (res && res.pending_checkin) {
          const checkinId = res.pending_checkin.id;
          if (Math.random() < 0.75) {
            const delay = 3 + Math.random() * 57;
            console.log(`[CHECKIN] ${s.name} received checkin. Responding in ${Math.round(delay)}s`);
            setTimeout(() => {
              rpc('respond_checkin', { p_token: s.token, p_checkin_id: checkinId })
                .then(r => console.log(`[CHECKIN] ${s.name} responded: ${r}`))
                .catch(err => console.error(`[ERROR] ${s.name} checkin failed: ${err.message}`));
            }, delay * 1000);
          } else {
            console.log(`[CHECKIN] ${s.name} received checkin but ignored it.`);
          }
        }
      }).catch(err => {
        console.error(`[ERROR] ${s.name} heartbeat failed: ${err.message}`);
      });
    }
  }, interval * 1000);
}

process.on('SIGINT', () => {
  console.log("\nExiting simulation...");
  process.exit(0);
});

simulate();
