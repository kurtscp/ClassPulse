export interface Session {
  id: string;
  instructor_id: string;
  class_name: string;
  meet_link: string | null;
  class_code: string;
  status: 'live' | 'ended';
  settings: {
    distracted_after_seconds?: number;
    idle_after_seconds?: number;
    offline_after_seconds?: number;
  };
  started_at: string;
  ended_at: string | null;
}

export interface Participant {
  id: string;
  session_id: string;
  student_name: string;
  joined_at: string;
  last_seen_at: string | null;
  meet_tab_open: boolean;
  meet_tab_focused: boolean;
  system_state: 'active' | 'idle' | 'locked';
  unfocused_since: string | null;
  idle_since: string | null;
}

export interface RosterEntry {
  id: string;
  session_id: string;
  student_name: string;
  participant_id: string | null;
  claimed_at: string | null;
}

export interface Checkin {
  id: string;
  session_id: string;
  sent_at: string;
  expires_at: string;
}

export interface CheckinResponse {
  checkin_id: string;
  participant_id: string;
  responded_at: string;
}
