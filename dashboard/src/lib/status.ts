import type { Participant, Session, RosterEntry } from './types';

export type ParticipantStatus = 'Offline' | 'Distracted' | 'Idle' | 'Active' | 'Not Joined';

export function getParticipantStatus(
  participant: Participant | null,
  session: Session,
  rosterEntry?: RosterEntry
): ParticipantStatus {
  if (rosterEntry && !participant) {
    return 'Not Joined';
  }
  if (!participant) return 'Offline';

  const settings = session.settings || {};
  const offlineAfter = settings.offline_after_seconds || 90;
  const distractedAfter = settings.distracted_after_seconds || 60;
  const idleAfter = settings.idle_after_seconds || 180;

  const now = new Date().getTime();

  // Offline
  const lastSeenTime = participant.last_seen_at ? new Date(participant.last_seen_at).getTime() : 0;
  if (!participant.meet_tab_open || (now - lastSeenTime) / 1000 > offlineAfter * 1000) {
    return 'Offline';
  }

  // Distracted
  if (participant.meet_tab_open && !participant.meet_tab_focused && participant.unfocused_since) {
    const unfocusedTime = new Date(participant.unfocused_since).getTime();
    if ((now - unfocusedTime) / 1000 > distractedAfter * 1000) {
      return 'Distracted';
    }
  }

  // Idle
  if ((participant.system_state === 'idle' || participant.system_state === 'locked') && participant.idle_since) {
    const idleTime = new Date(participant.idle_since).getTime();
    if ((now - idleTime) / 1000 > idleAfter * 1000) {
      return 'Idle';
    }
  }

  return 'Active';
}
