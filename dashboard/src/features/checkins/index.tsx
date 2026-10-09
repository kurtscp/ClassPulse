import { useState, useEffect } from 'react';
import { useSessionContext } from '../../app/SessionContext';
import { useCheckins } from './useCheckins';
import { LivePanel } from './LivePanel';
import { HistoryList } from './HistoryList';
import { isCheckinOpen } from './helpers';

export default function Checkins() {
  const { session, participants, settings } = useSessionContext();
  const {
    checkins,
    responsesByCheckinId,
    latestCheckin,
    earlierCheckins,
    loading,
    error,
    sending,
    sendCheckin,
    refresh
  } = useCheckins(session?.id);

  // Local ticker for reactive button enablement and live countdown updates
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const isSessionEnded = session?.status === 'ended';
  const isOpen = isCheckinOpen(latestCheckin, now);
  const isSendDisabled = !session || isSessionEnded || isOpen || sending;

  const handleSendCheckin = async () => {
    try {
      await sendCheckin();
    } catch {
      // Error is captured and handled in hook state
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-gray-200 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <span>Check-in Prompts</span>
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Prompt students during class to confirm they are actively attending and engaged.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            id="send-checkin-btn"
            onClick={handleSendCheckin}
            disabled={isSendDisabled}
            className={`inline-flex items-center justify-center px-4 py-2.5 rounded-lg text-sm font-semibold transition-all shadow-sm ${
              isSendDisabled
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200'
                : 'bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer active:scale-95'
            }`}
            title={
              isSessionEnded
                ? 'Session has ended'
                : isOpen
                ? 'A check-in is currently open'
                : 'Send check-in prompt to students'
            }
          >
            {sending ? (
              <>
                <svg
                  className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                <span>Sending...</span>
              </>
            ) : isOpen ? (
              <>
                <span className="mr-1.5">⏳</span>
                <span>Check-in Open</span>
              </>
            ) : isSessionEnded ? (
              <>
                <span className="mr-1.5">🔒</span>
                <span>Session Ended</span>
              </>
            ) : (
              <>
                <span className="mr-1.5">⚡</span>
                <span>Send check-in</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center justify-between text-sm text-red-800">
          <div className="flex items-center gap-2">
            <span>⚠️</span>
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={refresh}
            className="text-xs font-semibold underline hover:text-red-950 cursor-pointer ml-4"
          >
            Retry
          </button>
        </div>
      )}

      {/* Loading State */}
      {loading ? (
        <div className="bg-white border border-gray-200 rounded-xl p-12 text-center shadow-sm">
          <div className="inline-block animate-spin text-2xl mb-3">⏳</div>
          <p className="text-sm font-medium text-gray-600">Loading check-in data...</p>
        </div>
      ) : checkins.length === 0 ? (
        /* Empty State */
        <div className="bg-white border border-dashed border-gray-300 rounded-xl p-12 text-center shadow-sm">
          <div className="text-4xl mb-3">💬</div>
          <h2 className="text-lg font-bold text-gray-800 mb-2">No check-ins sent yet</h2>
          <p className="text-sm text-gray-500 max-w-md mx-auto mb-6">
            Click &quot;Send check-in&quot; to prompt all active students in this session. Their responses
            and response times will update right here in real time.
          </p>
          <button
            type="button"
            onClick={handleSendCheckin}
            disabled={isSendDisabled}
            className={`inline-flex items-center justify-center px-4 py-2 rounded-lg text-sm font-semibold transition shadow-sm ${
              isSendDisabled
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200'
                : 'bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer active:scale-95'
            }`}
          >
            {isSessionEnded ? 'Session Ended' : '⚡ Send first check-in'}
          </button>
        </div>
      ) : (
        /* Content: Live Panel for latest check-in + History of earlier check-ins */
        <div>
          {latestCheckin && (
            <LivePanel
              latestCheckin={latestCheckin}
              responses={responsesByCheckinId[latestCheckin.id] || []}
              participants={participants}
              settings={settings}
              now={now}
            />
          )}

          <HistoryList
            earlierCheckins={earlierCheckins}
            responsesByCheckinId={responsesByCheckinId}
            totalParticipants={participants.length}
          />
        </div>
      )}
    </div>
  );
}
