import { describe, it, expect, beforeEach } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { LivePanel } from './LivePanel';
import { HistoryList } from './HistoryList';
import type { Checkin, CheckinResponse, Participant } from '../../lib/types';
import type { Settings } from '../../lib/settings';

beforeEach(() => {
  (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

// Setup basic DOM container for tests
function renderComponent(ui: React.ReactElement): HTMLDivElement {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(ui);
  });
  return container;
}

const mockSettings: Settings = {
  distracted_after_seconds: 60,
  idle_after_seconds: 180,
  offline_after_seconds: 90
};

const mockCheckin: Checkin = {
  id: 'c1',
  session_id: 's1',
  sent_at: '2026-01-01T10:00:00.000Z',
  expires_at: new Date(Date.now() + 100000).toISOString() // in the future
};

const mockParticipants: Participant[] = [
  {
    id: 'p1',
    session_id: 's1',
    student_name: 'Alice Cooper',
    joined_at: '2026-01-01T09:50:00Z',
    last_seen_at: new Date().toISOString(),
    meet_tab_open: true,
    meet_tab_focused: true,
    system_state: 'active',
    unfocused_since: null,
    idle_since: null
  },
  {
    id: 'p2',
    session_id: 's1',
    student_name: 'Bob Marley',
    joined_at: '2026-01-01T09:50:00Z',
    last_seen_at: new Date().toISOString(),
    meet_tab_open: true,
    meet_tab_focused: true,
    system_state: 'active',
    unfocused_since: null,
    idle_since: null
  }
];

const mockResponses: CheckinResponse[] = [
  {
    checkin_id: 'c1',
    participant_id: 'p1',
    responded_at: '2026-01-01T10:00:04.000Z'
  }
];

describe('LivePanel', () => {
  it('renders progress bar with 1 of 2 students responded', () => {
    const container = renderComponent(
      <LivePanel
        latestCheckin={mockCheckin}
        responses={mockResponses}
        participants={mockParticipants}
        settings={mockSettings}
        now={new Date()}
      />
    );

    expect(container.textContent).toContain('1 of 2 students responded');
    expect(container.textContent).toContain('Alice Cooper');
    expect(container.textContent).toContain('Bob Marley');
    expect(container.textContent).toContain('Responded (4s)');
    expect(container.textContent).toContain('Waiting');
  });

  it('renders closed state if check-in has expired', () => {
    const expiredCheckin: Checkin = {
      ...mockCheckin,
      expires_at: new Date(Date.now() - 5000).toISOString()
    };

    const container = renderComponent(
      <LivePanel
        latestCheckin={expiredCheckin}
        responses={mockResponses}
        participants={mockParticipants}
        settings={mockSettings}
        now={new Date()}
      />
    );

    expect(container.textContent).toContain('Closed');
    expect(container.textContent).toContain('Expired');
  });
});

describe('HistoryList', () => {
  it('renders empty history placeholder when list is empty', () => {
    const container = renderComponent(
      <HistoryList earlierCheckins={[]} responsesByCheckinId={{}} totalParticipants={2} />
    );

    expect(container.textContent).toContain('No previous check-in history');
  });

  it('renders earlier check-ins with response rate and median time', () => {
    const pastCheckins: Checkin[] = [
      {
        id: 'past-1',
        session_id: 's1',
        sent_at: '2026-01-01T09:30:00.000Z',
        expires_at: '2026-01-01T09:32:00.000Z'
      }
    ];

    const pastResponses: Record<string, CheckinResponse[]> = {
      'past-1': [
        {
          checkin_id: 'past-1',
          participant_id: 'p1',
          responded_at: '2026-01-01T09:30:03.000Z'
        },
        {
          checkin_id: 'past-1',
          participant_id: 'p2',
          responded_at: '2026-01-01T09:30:05.000Z'
        }
      ]
    };

    const container = renderComponent(
      <HistoryList
        earlierCheckins={pastCheckins}
        responsesByCheckinId={pastResponses}
        totalParticipants={2}
      />
    );

    expect(container.textContent).toContain('100%');
    expect(container.textContent).toContain('4s');
    expect(container.textContent).toContain('2 of 2 students responded');
  });
});
