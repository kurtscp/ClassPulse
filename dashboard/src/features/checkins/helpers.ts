/**
 * Pure helper functions for check-in calculations and formatting.
 */

/**
 * Calculates response rate as a percentage (0 - 100).
 * If eligibleCount is 0 or negative, returns 0.
 */
export function calculateResponseRate(respondedCount: number, eligibleCount: number): number {
  if (eligibleCount <= 0 || respondedCount <= 0) {
    return 0;
  }
  const rate = (respondedCount / eligibleCount) * 100;
  return Math.min(100, Math.max(0, rate));
}

/**
 * Formats a response rate percentage.
 */
export function formatPercent(rate: number): string {
  return `${Math.round(rate)}%`;
}

/**
 * Calculates the median of an array of numbers.
 * Returns null if the array is empty.
 */
export function calculateMedian(numbers: number[]): number | null {
  if (!numbers || numbers.length === 0) {
    return null;
  }

  const sorted = [...numbers].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 1) {
    return sorted[mid];
  }

  return (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Calculates response time in seconds between check-in sent time and student response time.
 */
export function calculateResponseTimeSeconds(sentAt: string, respondedAt: string): number {
  const sentMs = new Date(sentAt).getTime();
  const respMs = new Date(respondedAt).getTime();
  const diffSec = Math.round((respMs - sentMs) / 1000);
  return Math.max(0, diffSec);
}

/**
 * Calculates the median response time (in seconds) for a list of responses to a check-in.
 * Returns null if no responses.
 */
export function calculateMedianResponseTime(
  sentAt: string,
  responses: Array<{ responded_at: string }>
): number | null {
  if (!responses || responses.length === 0) {
    return null;
  }
  const times = responses.map((r) => calculateResponseTimeSeconds(sentAt, r.responded_at));
  return calculateMedian(times);
}

/**
 * Determines whether a check-in is still open based on its expires_at timestamp.
 */
export function isCheckinOpen(
  checkin: { expires_at: string } | null | undefined,
  now: Date = new Date()
): boolean {
  if (!checkin) return false;
  const expiresMs = new Date(checkin.expires_at).getTime();
  return expiresMs > now.getTime();
}

/**
 * Formats countdown seconds into MM:SS.
 */
export function formatCountdown(secondsRemaining: number): string {
  if (secondsRemaining <= 0) return '0:00';
  const mins = Math.floor(secondsRemaining / 60);
  const secs = Math.floor(secondsRemaining % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

/**
 * Formats seconds into a human-readable string (e.g. "4s", "4.5s", or "N/A").
 */
export function formatSeconds(seconds: number | null): string {
  if (seconds === null || Number.isNaN(seconds)) return 'N/A';
  // If decimal, keep up to 1 decimal place, else integer
  const rounded = Number.isInteger(seconds) ? seconds.toString() : seconds.toFixed(1);
  return `${rounded}s`;
}
