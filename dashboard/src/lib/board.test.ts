import { describe, it, expect } from 'vitest';
import { buildBoardRows } from './board';
import type { Participant, RosterEntry } from './types';
import { DEFAULT_SETTINGS } from './settings';

const NOW = new Date('2026-01-01T12:00:00Z');

function createP(id: string, name: string): Participant {
  return {
    id, session_id: 's1', student_name: name,
    joined_at: NOW.toISOString(),
    last_seen_at: NOW.toISOString(),
    meet_tab_open: true,
    meet_tab_focused: true,
    system_state: 'active',
    unfocused_since: null,
    idle_since: null,
  };
}

function createR(id: string, name: string, partId: string | null = null): RosterEntry {
  return { id, session_id: 's1', student_name: name, participant_id: partId, claimed_at: null };
}

describe('buildBoardRows', () => {
  it('roster only, no participants (not joined)', () => {
    const roster = [createR('r1', 'Alice')];
    const rows = buildBoardRows(roster, [], DEFAULT_SETTINGS, NOW);
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe('not_joined');
    expect(rows[0].name).toBe('Alice');
  });

  it('roster with claimed participants', () => {
    const p1 = createP('p1', 'Alice (Ignored Name)');
    const r1 = createR('r1', 'Alice', 'p1');
    const rows = buildBoardRows([r1], [p1], DEFAULT_SETTINGS, NOW);
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe('active');
    expect(rows[0].name).toBe('Alice');
    expect(rows[0].participant?.id).toBe('p1');
  });

  it('participants only (free join, no roster)', () => {
    const p1 = createP('p1', 'Bob');
    const rows = buildBoardRows([], [p1], DEFAULT_SETTINGS, NOW);
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe('active');
    expect(rows[0].name).toBe('Bob');
    expect(rows[0].rosterEntry).toBeNull();
  });

  it('mixed roster and unlinked participants', () => {
    const r1 = createR('r1', 'Alice', null);
    const p1 = createP('p1', 'Bob');
    const rows = buildBoardRows([r1], [p1], DEFAULT_SETTINGS, NOW);
    expect(rows).toHaveLength(2);
    expect(rows[0].name).toBe('Alice');
    expect(rows[0].status).toBe('not_joined');
    expect(rows[1].name).toBe('Bob');
    expect(rows[1].status).toBe('active');
  });
});
