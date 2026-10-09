import type { Checkin, CheckinResponse } from '../../lib/types';
import {
  calculateResponseRate,
  calculateMedianResponseTime,
  formatPercent,
  formatSeconds
} from './helpers';

interface HistoryListProps {
  earlierCheckins: Checkin[];
  responsesByCheckinId: Record<string, CheckinResponse[]>;
  totalParticipants: number;
}

export function HistoryList({
  earlierCheckins,
  responsesByCheckinId,
  totalParticipants
}: HistoryListProps) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
      <div className="flex items-center gap-2 mb-4 pb-3 border-b border-gray-100">
        <span className="text-xl">📜</span>
        <h2 className="text-lg font-bold text-gray-900">Earlier Check-ins</h2>
        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
          {earlierCheckins.length}
        </span>
      </div>

      {earlierCheckins.length === 0 ? (
        <div className="p-8 text-center text-gray-500 bg-gray-50 rounded-lg border border-dashed border-gray-200 text-sm">
          No previous check-in history for this session yet.
        </div>
      ) : (
        <div className="divide-y divide-gray-100">
          {earlierCheckins.map((checkin, index) => {
            const responses = responsesByCheckinId[checkin.id] || [];
            const respondedCount = responses.length;
            const rate = calculateResponseRate(respondedCount, totalParticipants);
            const medianSec = calculateMedianResponseTime(checkin.sent_at, responses);
            const sentDate = new Date(checkin.sent_at);

            const timeStr = sentDate.toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit'
            });

            return (
              <div
                key={checkin.id}
                className="py-4 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-gray-400">
                      #{earlierCheckins.length - index}
                    </span>
                    <span className="text-sm font-semibold text-gray-900">Sent at {timeStr}</span>
                  </div>
                  <span className="text-xs text-gray-500">
                    {respondedCount} of {totalParticipants} students responded
                  </span>
                </div>

                <div className="flex items-center gap-4 sm:gap-6 self-start sm:self-auto text-sm">
                  {/* Response Rate */}
                  <div className="text-left sm:text-right">
                    <div className="text-[11px] uppercase font-bold text-gray-400 tracking-wider">
                      Response Rate
                    </div>
                    <div className="font-bold text-indigo-600">{formatPercent(rate)}</div>
                  </div>

                  {/* Median Response Time */}
                  <div className="text-left sm:text-right">
                    <div className="text-[11px] uppercase font-bold text-gray-400 tracking-wider">
                      Median Time
                    </div>
                    <div className="font-bold text-gray-700">{formatSeconds(medianSec)}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
