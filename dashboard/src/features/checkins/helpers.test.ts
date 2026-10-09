import { describe, it, expect } from 'vitest';
import {
  calculateResponseRate,
  formatPercent,
  calculateMedian,
  calculateResponseTimeSeconds,
  calculateMedianResponseTime,
  isCheckinOpen,
  formatCountdown,
  formatSeconds
} from './helpers';

describe('calculateResponseRate', () => {
  it('returns 0 when eligible count is 0', () => {
    expect(calculateResponseRate(0, 0)).toBe(0);
    expect(calculateResponseRate(5, 0)).toBe(0);
  });

  it('returns 0 when responded count is 0', () => {
    expect(calculateResponseRate(0, 10)).toBe(0);
  });

  it('calculates 50% response rate correctly', () => {
    expect(calculateResponseRate(5, 10)).toBe(50);
  });

  it('calculates 100% response rate when all students respond', () => {
    expect(calculateResponseRate(10, 10)).toBe(100);
  });

  it('caps response rate at 100% if responses exceed eligible count', () => {
    expect(calculateResponseRate(12, 10)).toBe(100);
  });

  it('handles fractional percentages correctly', () => {
    expect(calculateResponseRate(1, 3)).toBeCloseTo(33.333, 2);
  });

  it('handles negative inputs gracefully', () => {
    expect(calculateResponseRate(-1, 10)).toBe(0);
    expect(calculateResponseRate(5, -1)).toBe(0);
  });
});

describe('formatPercent', () => {
  it('formats percentages rounded to nearest integer', () => {
    expect(formatPercent(50)).toBe('50%');
    expect(formatPercent(33.333)).toBe('33%');
    expect(formatPercent(66.666)).toBe('67%');
    expect(formatPercent(100)).toBe('100%');
    expect(formatPercent(0)).toBe('0%');
  });
});

describe('calculateMedian', () => {
  it('returns null for empty array', () => {
    expect(calculateMedian([])).toBeNull();
  });

  it('returns the single element for 1-item array', () => {
    expect(calculateMedian([42])).toBe(42);
  });

  it('returns the middle element for odd length arrays', () => {
    expect(calculateMedian([5, 1, 9])).toBe(5);
    expect(calculateMedian([1, 2, 3, 4, 5])).toBe(3);
  });

  it('returns the average of two middle elements for even length arrays', () => {
    expect(calculateMedian([1, 3, 5, 7])).toBe(4);
    expect(calculateMedian([10, 20])).toBe(15);
  });

  it('correctly handles unsorted arrays', () => {
    expect(calculateMedian([9, 2, 7, 1, 5])).toBe(5);
    expect(calculateMedian([10, 2, 8, 4])).toBe(6);
  });

  it('handles duplicate numbers', () => {
    expect(calculateMedian([3, 3, 3])).toBe(3);
    expect(calculateMedian([1, 2, 2, 4])).toBe(2);
  });
});

describe('calculateResponseTimeSeconds', () => {
  it('calculates difference in seconds correctly', () => {
    const sentAt = '2026-01-01T10:00:00.000Z';
    const respondedAt = '2026-01-01T10:00:05.000Z';
    expect(calculateResponseTimeSeconds(sentAt, respondedAt)).toBe(5);
  });

  it('rounds to nearest second', () => {
    const sentAt = '2026-01-01T10:00:00.000Z';
    const respondedAt = '2026-01-01T10:00:03.400Z';
    expect(calculateResponseTimeSeconds(sentAt, respondedAt)).toBe(3);
  });

  it('ensures no negative seconds if clocks skew slightly', () => {
    const sentAt = '2026-01-01T10:00:05.000Z';
    const respondedAt = '2026-01-01T10:00:00.000Z';
    expect(calculateResponseTimeSeconds(sentAt, respondedAt)).toBe(0);
  });
});

describe('calculateMedianResponseTime', () => {
  it('returns null when responses array is empty', () => {
    expect(calculateMedianResponseTime('2026-01-01T10:00:00Z', [])).toBeNull();
  });

  it('calculates median across multiple responses', () => {
    const sentAt = '2026-01-01T10:00:00.000Z';
    const responses = [
      { responded_at: '2026-01-01T10:00:02.000Z' }, // 2s
      { responded_at: '2026-01-01T10:00:10.000Z' }, // 10s
      { responded_at: '2026-01-01T10:00:04.000Z' }, // 4s
    ];
    // sorted: [2, 4, 10] -> median 4s
    expect(calculateMedianResponseTime(sentAt, responses)).toBe(4);
  });

  it('calculates median for even number of responses', () => {
    const sentAt = '2026-01-01T10:00:00.000Z';
    const responses = [
      { responded_at: '2026-01-01T10:00:02.000Z' }, // 2s
      { responded_at: '2026-01-01T10:00:06.000Z' }, // 6s
    ];
    // sorted: [2, 6] -> median (2+6)/2 = 4s
    expect(calculateMedianResponseTime(sentAt, responses)).toBe(4);
  });
});

describe('isCheckinOpen', () => {
  it('returns false for null/undefined checkin', () => {
    expect(isCheckinOpen(null)).toBe(false);
    expect(isCheckinOpen(undefined)).toBe(false);
  });

  it('returns true when expires_at is in the future', () => {
    const now = new Date('2026-01-01T10:00:00Z');
    const checkin = { expires_at: '2026-01-01T10:02:00Z' };
    expect(isCheckinOpen(checkin, now)).toBe(true);
  });

  it('returns false when expires_at is in the past', () => {
    const now = new Date('2026-01-01T10:05:00Z');
    const checkin = { expires_at: '2026-01-01T10:02:00Z' };
    expect(isCheckinOpen(checkin, now)).toBe(false);
  });

  it('returns false when expires_at equals current time', () => {
    const now = new Date('2026-01-01T10:02:00Z');
    const checkin = { expires_at: '2026-01-01T10:02:00Z' };
    expect(isCheckinOpen(checkin, now)).toBe(false);
  });
});

describe('formatCountdown', () => {
  it('formats seconds into MM:SS', () => {
    expect(formatCountdown(90)).toBe('1:30');
    expect(formatCountdown(65)).toBe('1:05');
    expect(formatCountdown(9)).toBe('0:09');
    expect(formatCountdown(0)).toBe('0:00');
    expect(formatCountdown(-5)).toBe('0:00');
  });
});

describe('formatSeconds', () => {
  it('formats numbers into seconds string', () => {
    expect(formatSeconds(4)).toBe('4s');
    expect(formatSeconds(4.5)).toBe('4.5s');
    expect(formatSeconds(0)).toBe('0s');
    expect(formatSeconds(null)).toBe('N/A');
  });
});
