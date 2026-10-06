import type { Participant, RosterEntry } from './types';
import { getStatus, type Status } from './status';
import type { Settings } from './settings';

export type BoardRow = {
  key: string;
  name: string;
  status: Status;
  participant: Participant | null;
  rosterEntry: RosterEntry | null;
};

export function buildBoardRows(
  roster: RosterEntry[],
  participants: Participant[],
  settings: Settings,
  now: Date
): BoardRow[] {
  const rows: BoardRow[] = [];
  const handledParticipantIds = new Set<string>();

  // Process Roster first
  for (const entry of roster) {
    let p: Participant | null = null;
    let s: Status = 'not_joined';

    if (entry.participant_id) {
      p = participants.find(part => part.id === entry.participant_id) || null;
      if (p) {
        handledParticipantIds.add(p.id);
        s = getStatus(p, settings, now);
      }
    }

    rows.push({
      key: `roster-${entry.id}`,
      name: entry.student_name,
      status: s,
      participant: p,
      rosterEntry: entry
    });
  }

  // Process any unlinked participants
  for (const p of participants) {
    if (!handledParticipantIds.has(p.id)) {
      rows.push({
        key: `part-${p.id}`,
        name: p.student_name,
        status: getStatus(p, settings, now),
        participant: p,
        rosterEntry: null
      });
    }
  }

  return rows;
}
