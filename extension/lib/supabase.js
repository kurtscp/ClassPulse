import { CONFIG } from '../config.js';

/**
 * Helper to call Supabase RPC endpoints.
 * @param {string} fnName 
 * @param {object} args 
 * @returns {Promise<any>}
 */
export async function rpc(fnName, args = {}) {
  const url = `${CONFIG.SUPABASE_URL}/rest/v1/rpc/${fnName}`;
  const headers = {
    'Content-Type': 'application/json',
    'apikey': CONFIG.SUPABASE_KEY,
    'Prefer': 'return=representation'
  };

  if (CONFIG.SUPABASE_KEY.startsWith('eyJ')) {
    headers['Authorization'] = `Bearer ${CONFIG.SUPABASE_KEY}`;
  }

  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(args),
      signal: controller.signal
    });

    clearTimeout(id);

    let data;
    try {
      data = await response.json();
    } catch (e) {
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return null;
    }

    if (!response.ok) {
      throw new Error(data.message || data.error || `HTTP ${response.status}`);
    }

    return data;
  } catch (err) {
    clearTimeout(id);
    if (err.name === 'AbortError') {
      throw new Error(`Timeout: Request to ${fnName} took longer than 8 seconds.`);
    }
    throw err;
  }
}
