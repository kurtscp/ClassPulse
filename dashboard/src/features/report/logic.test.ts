import { describe, it, expect } from 'vitest';
import {
  formatDuration,
  formatPercentage,
  calculateStatusShares,
  calculateSummary,
  sortReportRows,
} from './logic';
import type { SessionReportRow } from './logic';

describe('Report Logic', () => {
  describe('formatDuration', () => {
    it('formats seconds correctly', () => {
      expect(formatDuration(0)).toBe('0s');
      expect(formatDuration(45)).toBe('45s');
      expect(formatDuration(60)).toBe('1m');
      expect(formatDuration(65)).toBe('1m 5s');
      expect(formatDuration(3600)).toBe('60m');
    });
  });

  describe('formatPercentage', () => {
    it('rounds and formats percentages', () => {
      expect(formatPercentage(0)).toBe('0%');
      expect(formatPercentage(42.4)).toBe('42%');
      expect(formatPercentage(42.5)).toBe('43%');
      expect(formatPercentage(100)).toBe('100%');
    });
  });

  describe('calculateStatusShares', () => {
    it('calculates correct shares', () => {
      const row = {
        active_seconds: 50,
        distracted_seconds: 25,
        idle_seconds: 15,
        offline_seconds: 10,
      } as SessionReportRow;

      const shares = calculateStatusShares(row);
      expect(shares).toEqual({
        active: 50,
        distracted: 25,
        idle: 15,
        offline: 10,
      });
    });

    it('handles zero total time', () => {
      const row = {
        active_seconds: 0,
        distracted_seconds: 0,
        idle_seconds: 0,
        offline_seconds: 0,
      } as SessionReportRow;

      const shares = calculateStatusShares(row);
      expect(shares).toEqual({
        active: 0,
        distracted: 0,
        idle: 0,
        offline: 0,
      });
    });
  });

  describe('calculateSummary', () => {
    it('calculates summary stats correctly', () => {
      const rows: SessionReportRow[] = [
        {
          student_name: 'Alice',
          joined: true,
          attendance_pct: 100,
          tracked_seconds: 100,
          active_seconds: 80, // 80% active
          checkins_sent: 2,
          checkins_answered: 2,
        } as SessionReportRow,
        {
          student_name: 'Bob',
          joined: true,
          attendance_pct: 50,
          tracked_seconds: 100,
          active_seconds: 40, // 40% active
          checkins_sent: 2,
          checkins_answered: 0,
        } as SessionReportRow,
        {
          student_name: 'Charlie',
          joined: false,
          attendance_pct: 0,
          tracked_seconds: 0,
          active_seconds: 0,
          checkins_sent: 2,
          checkins_answered: 0,
        } as SessionReportRow,
      ];

      const summary = calculateSummary(rows);
      expect(summary.totalStudents).toBe(3);
      expect(summary.studentsJoined).toBe(2);
      expect(summary.studentsNotJoined).toBe(1);
      // (100 + 50 + 0) / 3 = 50
      expect(summary.avgAttendancePct).toBe(50);
      // Average of (80% and 40%) = 60%
      expect(summary.avgActivePct).toBe(60);
      // 2 answered out of 4 sent to joined users = 50%
      expect(summary.checkinResponseRatePct).toBe(50);
    });
  });

  describe('sortReportRows', () => {
    const rows = [
      { student_name: 'Bob', joined: true, attendance_pct: 50 },
      { student_name: 'Charlie', joined: false, attendance_pct: 0 },
      { student_name: 'Alice', joined: true, attendance_pct: 100 },
    ] as SessionReportRow[];

    it('sorts by string ascending', () => {
      const sorted = sortReportRows(rows, 'student_name', 'asc');
      expect(sorted[0].student_name).toBe('Alice');
      expect(sorted[1].student_name).toBe('Bob');
      expect(sorted[2].student_name).toBe('Charlie');
    });

    it('sorts by metric descending with unjoined at bottom', () => {
      const sorted = sortReportRows(rows, 'attendance_pct', 'desc');
      expect(sorted[0].student_name).toBe('Alice');
      expect(sorted[1].student_name).toBe('Bob');
      expect(sorted[2].student_name).toBe('Charlie'); // Unjoined always falls to the bottom for metrics
    });
  });
});
