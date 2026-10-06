import { describe, it, expect } from 'vitest';
import { getStatus } from './status';
import type { Participant } from './types';
import { DEFAULT_SETTINGS } from './settings';

const NOW = new Date('2026-01-01T12:00:00Z');

function createP(overrides: Partial<Participant> = {}): Participant {
  return {
    id: '1', session_id: 's1', student_name: 'test',
    joined_at: new Date('2026-01-01T10:00:00Z').toISOString(),
    last_seen_at: new Date('2026-01-01T12:00:00Z').toISOString(), // seen 0s ago
    meet_tab_open: true,
    meet_tab_focused: true,
    system_state: 'active',
    unfocused_since: null,
    idle_since: null,
    ...overrides
  };
}

describe('getStatus priority & rules', () => {
  it('returns active for baseline perfect state', () => {
    expect(getStatus(createP(), DEFAULT_SETTINGS, NOW)).toBe('active');
  });

  it('offline if last_seen_at is null', () => {
    expect(getStatus(createP({ last_seen_at: null }), DEFAULT_SETTINGS, NOW)).toBe('offline');
  });

  it('offline if meet_tab_open is false', () => {
    expect(getStatus(createP({ meet_tab_open: false }), DEFAULT_SETTINGS, NOW)).toBe('offline');
  });

  it('offline if last_seen_at > offline_after_seconds threshold', () => {
    // offline_after_seconds = 90
    // seen 91s ago
    const old = new Date(NOW.getTime() - 91000).toISOString();
    expect(getStatus(createP({ last_seen_at: old }), DEFAULT_SETTINGS, NOW)).toBe('offline');
  });

  it('active if last_seen_at exactly at threshold', () => {
    const old = new Date(NOW.getTime() - 90000).toISOString();
    expect(getStatus(createP({ last_seen_at: old }), DEFAULT_SETTINGS, NOW)).toBe('active');
  });

  it('distracted if not focused > distracted_after_seconds', () => {
    // distracted_after_seconds = 60
    const unfocused = new Date(NOW.getTime() - 61000).toISOString();
    expect(getStatus(createP({ meet_tab_focused: false, unfocused_since: unfocused }), DEFAULT_SETTINGS, NOW)).toBe('distracted');
  });

  it('active if not focused exactly at threshold', () => {
    const unfocused = new Date(NOW.getTime() - 60000).toISOString();
    expect(getStatus(createP({ meet_tab_focused: false, unfocused_since: unfocused }), DEFAULT_SETTINGS, NOW)).toBe('active');
  });

  it('idle if idle > idle_after_seconds', () => {
    // idle_after_seconds = 180
    const idle = new Date(NOW.getTime() - 181000).toISOString();
    expect(getStatus(createP({ system_state: 'idle', idle_since: idle }), DEFAULT_SETTINGS, NOW)).toBe('idle');
  });

  it('active if idle exactly at threshold', () => {
    const idle = new Date(NOW.getTime() - 180000).toISOString();
    expect(getStatus(createP({ system_state: 'idle', idle_since: idle }), DEFAULT_SETTINGS, NOW)).toBe('active');
  });

  it('priority: offline beats distracted', () => {
    const oldSeen = new Date(NOW.getTime() - 100000).toISOString();
    const unfocused = new Date(NOW.getTime() - 100000).toISOString();
    expect(getStatus(createP({ last_seen_at: oldSeen, meet_tab_focused: false, unfocused_since: unfocused }), DEFAULT_SETTINGS, NOW)).toBe('offline');
  });

  it('priority: distracted beats idle', () => {
    const unfocused = new Date(NOW.getTime() - 100000).toISOString();
    const idle = new Date(NOW.getTime() - 200000).toISOString();
    expect(getStatus(createP({ 
      meet_tab_focused: false, unfocused_since: unfocused,
      system_state: 'locked', idle_since: idle
    }), DEFAULT_SETTINGS, NOW)).toBe('distracted');
  });
});
