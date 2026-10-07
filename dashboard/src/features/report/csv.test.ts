import { describe, it, expect } from 'vitest';
import { escapeCell, buildCsv, getFilename } from './csv';
import type { SessionReportRow } from './logic';

// ---------------------------------------------------------------------------
// escapeCell
// ---------------------------------------------------------------------------
describe('escapeCell', () => {
  it('returns plain strings unchanged', () => {
    expect(escapeCell('Alice')).toBe('Alice');
  });

  it('wraps strings containing a comma in double-quotes', () => {
    expect(escapeCell('Cruz, Maria')).toBe('"Cruz, Maria"');
  });

  it('escapes internal double-quotes by doubling them', () => {
    expect(escapeCell('She said "hello"')).toBe('"She said ""hello"""');
  });

  it('wraps strings containing a newline', () => {
    expect(escapeCell('line1\nline2')).toBe('"line1\nline2"');
  });

  it('wraps strings containing a carriage-return', () => {
    expect(escapeCell('line1\r\nline2')).toBe('"line1\r\nline2"');
  });

  it('handles both comma and quote in the same cell', () => {
    expect(escapeCell('"value", extra')).toBe('"""value"", extra"');
  });

  it('converts numbers to strings', () => {
    expect(escapeCell(42)).toBe('42');
  });

  it('returns empty string for null', () => {
    expect(escapeCell(null)).toBe('');
  });

  it('returns empty string for undefined', () => {
    expect(escapeCell(undefined)).toBe('');
  });
});

// ---------------------------------------------------------------------------
// buildCsv
// ---------------------------------------------------------------------------

function makeRow(overrides: Partial<SessionReportRow> = {}): SessionReportRow {
  return {
    student_name: 'Alice',
    joined: true,
    joined_at: '2026-10-01T08:00:00Z',
    last_seen_at: '2026-10-01T09:00:00Z',
    tracked_seconds: 3600,
    active_seconds: 1800,
    distracted_seconds: 600,
    idle_seconds: 600,
    offline_seconds: 600,
    attendance_pct: 83.3,
    checkins_sent: 3,
    checkins_answered: 2,
    avg_checkin_response_seconds: 5.5,
    ...overrides,
  };
}

describe('buildCsv', () => {
  it('starts with a UTF-8 BOM', () => {
    const csv = buildCsv([]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
  });

  it('includes the correct header row', () => {
    const csv = buildCsv([]);
    const lines = csv.slice(1).split('\r\n'); // strip BOM
    expect(lines[0]).toBe(
      'student_name,joined,attendance_pct,active_minutes,distracted_minutes,idle_minutes,offline_minutes,checkins_answered,checkins_sent,avg_response_seconds'
    );
  });

  it('produces one data row per student', () => {
    const csv = buildCsv([makeRow(), makeRow({ student_name: 'Bob' })]);
    const lines = csv.slice(1).split('\r\n');
    expect(lines).toHaveLength(3); // header + 2 rows
  });

  it('converts seconds to minutes with 2 decimal places', () => {
    const csv = buildCsv([makeRow({ active_seconds: 90 })]);
    const dataLine = csv.slice(1).split('\r\n')[1];
    // active_minutes = 90/60 = 1.50
    expect(dataLine).toContain('1.50');
  });

  it('shows "yes" for joined students and "no" for absent ones', () => {
    const csvYes = buildCsv([makeRow({ joined: true })]);
    const csvNo = buildCsv([makeRow({ joined: false })]);
    expect(csvYes.slice(1).split('\r\n')[1]).toContain(',yes,');
    expect(csvNo.slice(1).split('\r\n')[1]).toContain(',no,');
  });

  it('leaves metric cells empty for absent students', () => {
    const csv = buildCsv([makeRow({ joined: false })]);
    const dataLine = csv.slice(1).split('\r\n')[1];
    // After "no" all metric cells should be empty (consecutive commas)
    expect(dataLine).toMatch(/,no,,,,,,,,/);
  });

  it('properly escapes a student name containing a comma', () => {
    const csv = buildCsv([makeRow({ student_name: 'dela Cruz, Jose' })]);
    expect(csv).toContain('"dela Cruz, Jose"');
  });

  it('properly escapes a student name containing a double-quote', () => {
    const csv = buildCsv([makeRow({ student_name: 'O\'Brien "Pat"' })]);
    expect(csv).toContain('"O\'Brien ""Pat"""');
  });

  it('handles null avg_checkin_response_seconds', () => {
    const csv = buildCsv([makeRow({ avg_checkin_response_seconds: null })]);
    const dataLine = csv.slice(1).split('\r\n')[1];
    // last column should be empty
    expect(dataLine.endsWith(',')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// getFilename
// ---------------------------------------------------------------------------
describe('getFilename', () => {
  it('builds the correct filename from class code and date', () => {
    expect(getFilename('CS101', '2026-10-08T00:00:00Z')).toBe('classpulse_CS101_2026-10-08.csv');
  });

  it('sanitises non-alphanumeric characters in the class code', () => {
    expect(getFilename('CS 101/A', '2026-10-08T00:00:00Z')).toBe('classpulse_CS_101_A_2026-10-08.csv');
  });

  it('falls back to today when startedAt is null', () => {
    const today = new Date().toISOString().slice(0, 10);
    expect(getFilename('ABC', null)).toBe(`classpulse_ABC_${today}.csv`);
  });
});
