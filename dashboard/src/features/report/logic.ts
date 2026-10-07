export type SessionReportRow = {
  student_name: string;
  joined: boolean;
  joined_at: string | null;
  last_seen_at: string | null;
  tracked_seconds: number;
  active_seconds: number;
  distracted_seconds: number;
  idle_seconds: number;
  offline_seconds: number;
  attendance_pct: number;
  checkins_sent: number;
  checkins_answered: number;
  avg_checkin_response_seconds: number | null;
};

export type SortField = keyof SessionReportRow;
export type SortDirection = 'asc' | 'desc';

export function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return '0s';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  if (mins === 0) return `${secs}s`;
  if (secs === 0) return `${mins}m`;
  return `${mins}m ${secs}s`;
}

export function formatPercentage(pct: number): string {
  return `${Math.round(pct)}%`;
}

export function calculateStatusShares(row: SessionReportRow) {
  const total =
    row.active_seconds + row.distracted_seconds + row.idle_seconds + row.offline_seconds;
  if (total <= 0) {
    return { active: 0, distracted: 0, idle: 0, offline: 0 };
  }
  return {
    active: (row.active_seconds / total) * 100,
    distracted: (row.distracted_seconds / total) * 100,
    idle: (row.idle_seconds / total) * 100,
    offline: (row.offline_seconds / total) * 100,
  };
}

export function calculateSummary(rows: SessionReportRow[]) {
  const totalStudents = rows.length;
  if (totalStudents === 0) {
    return {
      totalStudents: 0,
      studentsJoined: 0,
      studentsNotJoined: 0,
      avgAttendancePct: 0,
      avgActivePct: 0,
      checkinResponseRatePct: 0,
    };
  }

  const joinedRows = rows.filter((r) => r.joined);
  const studentsJoined = joinedRows.length;
  const studentsNotJoined = totalStudents - studentsJoined;

  const sumAttendance = rows.reduce((acc, r) => acc + (r.attendance_pct || 0), 0);
  const avgAttendancePct = sumAttendance / totalStudents; // "over everyone on the roster"

  let avgActivePct = 0;
  if (studentsJoined > 0) {
    let sumActivePct = 0;
    joinedRows.forEach((r) => {
      if (r.tracked_seconds > 0) {
        sumActivePct += (r.active_seconds / r.tracked_seconds) * 100;
      }
    });
    avgActivePct = sumActivePct / studentsJoined;
  }

  let checkinResponseRatePct = 0;
  let totalSent = 0;
  let totalAnswered = 0;
  joinedRows.forEach((r) => {
    totalSent += r.checkins_sent || 0;
    totalAnswered += r.checkins_answered || 0;
  });
  
  if (totalSent > 0) {
    checkinResponseRatePct = (totalAnswered / totalSent) * 100;
  }

  return {
    totalStudents,
    studentsJoined,
    studentsNotJoined,
    avgAttendancePct,
    avgActivePct,
    checkinResponseRatePct,
  };
}

export function sortReportRows(
  rows: SessionReportRow[],
  field: SortField,
  direction: SortDirection
): SessionReportRow[] {
  return [...rows].sort((a, b) => {
    // joined flag sorting makes unjoined students always stay at bottom or follow sort correctly
    if (field !== 'student_name' && field !== 'joined') {
      if (a.joined && !b.joined) return -1;
      if (!a.joined && b.joined) return 1;
    }

    let aVal = a[field];
    let bVal = b[field];

    if (aVal === null) aVal = field === 'student_name' ? '' : -1;
    if (bVal === null) bVal = field === 'student_name' ? '' : -1;

    let comp = 0;
    if (typeof aVal === 'string' && typeof bVal === 'string') {
      comp = aVal.localeCompare(bVal);
    } else if (typeof aVal === 'number' && typeof bVal === 'number') {
      comp = aVal - bVal;
    } else if (typeof aVal === 'boolean' && typeof bVal === 'boolean') {
      comp = aVal === bVal ? 0 : aVal ? 1 : -1;
    }

    return direction === 'asc' ? comp : -comp;
  });
}
