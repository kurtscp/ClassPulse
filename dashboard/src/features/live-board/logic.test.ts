import { describe, it, expect } from 'vitest';
import { computeStatusCounts, filterRows, sortRows } from './logic';
import type { BoardRow } from '../../lib/board';

describe('live-board logic', () => {
  const mockRows: BoardRow[] = [
    { key: '1', name: 'Alice', status: 'active', participant: { last_seen_at: '2023-01-01T10:00:00Z' } as any, rosterEntry: null },
    { key: '2', name: 'Bob', status: 'distracted', participant: { last_seen_at: '2023-01-01T10:05:00Z' } as any, rosterEntry: null },
    { key: '3', name: 'Charlie', status: 'idle', participant: { last_seen_at: '2023-01-01T09:55:00Z' } as any, rosterEntry: null },
    { key: '4', name: 'Dave', status: 'not_joined', participant: null, rosterEntry: {} as any }
  ];

  it('computeStatusCounts', () => {
    const counts = computeStatusCounts(mockRows);
    expect(counts.total).toBe(4);
    expect(counts.active).toBe(1);
    expect(counts.distracted).toBe(1);
    expect(counts.idle).toBe(1);
    expect(counts.offline).toBe(0);
    expect(counts.not_joined).toBe(1);
  });

  it('filterRows by status', () => {
    const filtered = filterRows(mockRows, { statusFilter: 'distracted', searchQuery: '' });
    expect(filtered.length).toBe(1);
    expect(filtered[0].name).toBe('Bob');
  });

  it('filterRows by search', () => {
    const filtered = filterRows(mockRows, { searchQuery: 'aLi' });
    expect(filtered.length).toBe(1);
    expect(filtered[0].name).toBe('Alice');
  });

  it('sortRows needs_attention', () => {
    const sorted = sortRows(mockRows, 'needs_attention');
    expect(sorted.map(r => r.name)).toEqual(['Bob', 'Charlie', 'Dave', 'Alice']);
  });

  it('sortRows name_asc', () => {
    const sorted = sortRows(mockRows, 'name_asc');
    expect(sorted.map(r => r.name)).toEqual(['Alice', 'Bob', 'Charlie', 'Dave']);
  });

  it('sortRows last_seen', () => {
    const sorted = sortRows(mockRows, 'last_seen');
    // Bob (10:05) > Alice (10:00) > Charlie (09:55) > Dave (0)
    expect(sorted.map(r => r.name)).toEqual(['Bob', 'Alice', 'Charlie', 'Dave']);
  });
});
