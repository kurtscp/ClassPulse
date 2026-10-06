export function formatTimeAgo(dateString: string | null, now: Date): string {
  if (!dateString) return '';
  const diffSecs = Math.floor((now.getTime() - new Date(dateString).getTime()) / 1000);
  
  if (diffSecs < 0) return 'just now';
  if (diffSecs < 60) return `${diffSecs}s ago`;
  const diffMins = Math.floor(diffSecs / 60);
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  return `${diffHours}h ago`;
}
