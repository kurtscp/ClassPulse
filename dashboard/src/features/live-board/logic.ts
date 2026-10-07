import type { BoardRow } from '../../lib/board';
import type { Status } from '../../lib/status';

export type SortMode = 'needs_attention' | 'name_asc' | 'last_seen';

export function computeStatusCounts(rows: BoardRow[]): Record<Status | 'total', number> {
  const counts: Record<Status | 'total', number> = {
    total: rows.length,
    active: 0,
    distracted: 0,
    idle: 0,
    offline: 0,
    not_joined: 0
  };

  for (const row of rows) {
    counts[row.status]++;
  }

  return counts;
}

export function filterRows(rows: BoardRow[], filters: { statusFilter?: Status | null; searchQuery: string }): BoardRow[] {
  return rows.filter(row => {
    if (filters.statusFilter && row.status !== filters.statusFilter) return false;
    if (filters.searchQuery && !row.name.toLowerCase().includes(filters.searchQuery.toLowerCase())) return false;
    return true;
  });
}

const NEEDS_ATTENTION_ORDER: Record<Status, number> = {
  distracted: 0,
  idle: 1,
  offline: 2,
  not_joined: 3,
  active: 4
};

export function sortRows(rows: BoardRow[], sortMode: SortMode): BoardRow[] {
  return [...rows].sort((a, b) => {
    if (sortMode === 'needs_attention') {
      const orderA = NEEDS_ATTENTION_ORDER[a.status];
      const orderB = NEEDS_ATTENTION_ORDER[b.status];
      if (orderA !== orderB) return orderA - orderB;
      return a.name.localeCompare(b.name);
    }
    
    if (sortMode === 'last_seen') {
      const timeA = a.participant?.last_seen_at ? new Date(a.participant.last_seen_at).getTime() : 0;
      const timeB = b.participant?.last_seen_at ? new Date(b.participant.last_seen_at).getTime() : 0;
      if (timeA !== timeB) return timeB - timeA; // Descending
      return a.name.localeCompare(b.name);
    }
    
    // name_asc
    return a.name.localeCompare(b.name);
  });
}

import { formatTimeAgo } from '../../lib/format';

export function generateCSV(rows: BoardRow[], now: Date): string {
  const header = ['Student Name', 'Status', 'Last Seen'];
  const lines = [header.join(',')];
  for (const row of rows) {
    const lastSeenStr = row.participant ? formatTimeAgo(row.participant.last_seen_at, now) : 'N/A';
    lines.push([
      `"${row.name.replace(/"/g, '""')}"`,
      row.status,
      `"${lastSeenStr}"`
    ].join(','));
  }
  return lines.join('\n');
}

export function downloadCSV(csvContent: string, filename: string) {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

