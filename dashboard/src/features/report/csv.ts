import type { SessionReportRow } from './logic';

// ---------------------------------------------------------------------------
// Cell escaping — RFC 4180 + Excel-safe
// ---------------------------------------------------------------------------

/** Wraps a value in double-quotes and escapes any internal double-quotes. */
export function escapeCell(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  // If the value contains a comma, double-quote, or newline it must be quoted.
  if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

// ---------------------------------------------------------------------------
// CSV builder
// ---------------------------------------------------------------------------

const HEADERS = [
  'student_name',
  'joined',
  'attendance_pct',
  'active_minutes',
  'distracted_minutes',
  'idle_minutes',
  'offline_minutes',
  'checkins_answered',
  'checkins_sent',
  'avg_response_seconds',
] as const;

function toMinutes(seconds: number): string {
  return (seconds / 60).toFixed(2);
}

/** Builds the full CSV string (UTF-8 BOM prepended for Excel). */
export function buildCsv(rows: SessionReportRow[]): string {
  const BOM = '\uFEFF';

  const header = HEADERS.map(escapeCell).join(',');

  const body = rows.map((row) => {
    const cells = [
      escapeCell(row.student_name),
      escapeCell(row.joined ? 'yes' : 'no'),
      escapeCell(row.joined ? row.attendance_pct : ''),
      escapeCell(row.joined ? toMinutes(row.active_seconds) : ''),
      escapeCell(row.joined ? toMinutes(row.distracted_seconds) : ''),
      escapeCell(row.joined ? toMinutes(row.idle_seconds) : ''),
      escapeCell(row.joined ? toMinutes(row.offline_seconds) : ''),
      escapeCell(row.joined ? row.checkins_answered : ''),
      escapeCell(row.joined ? row.checkins_sent : ''),
      escapeCell(row.avg_checkin_response_seconds ?? ''),
    ];
    return cells.join(',');
  });

  return BOM + [header, ...body].join('\r\n');
}

// ---------------------------------------------------------------------------
// Filename
// ---------------------------------------------------------------------------

/** Returns classpulse_<classcode>_<YYYY-MM-DD>.csv using the session's start date. */
export function getFilename(classCode: string, startedAt: string | null | undefined): string {
  let dateStr: string;
  try {
    const d = startedAt ? new Date(startedAt) : new Date();
    dateStr = d.toISOString().slice(0, 10); // YYYY-MM-DD
  } catch {
    dateStr = new Date().toISOString().slice(0, 10);
  }
  // Sanitise the class code so it's safe in a filename
  const safeCode = classCode.replace(/[^A-Za-z0-9_-]/g, '_');
  return `classpulse_${safeCode}_${dateStr}.csv`;
}

// ---------------------------------------------------------------------------
// Download trigger (browser only)
// ---------------------------------------------------------------------------

/** Creates a Blob and triggers a download in the browser. */
export function downloadCsv(csv: string, filename: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
