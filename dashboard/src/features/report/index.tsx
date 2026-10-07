import { useCallback, useEffect, useState } from 'react';
import { useSessionContext } from '../../app/SessionContext';
import { supabase } from '../../lib/supabase';
import { STATUS_META } from '../../lib/status';
import {
  formatDuration,
  formatPercentage,
  calculateSummary,
  calculateStatusShares,
  sortReportRows,
} from './logic';
import type { SessionReportRow, SortField, SortDirection } from './logic';
import { buildCsv, getFilename, downloadCsv } from './csv';

export default function Report() {
  const { session } = useSessionContext();
  const [rows, setRows] = useState<SessionReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField>('student_name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const sessionId = session?.id;

  const fetchReport = useCallback(async () => {
    if (!sessionId) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: rpcErr } = await supabase.rpc('get_session_report', {
        p_session_id: sessionId,
      });
      if (rpcErr) throw rpcErr;
      setRows((data as SessionReportRow[]) || []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load session report';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection(field === 'student_name' ? 'asc' : 'desc');
    }
  };

  const isLive = session?.status === 'live';
  const summary = calculateSummary(rows);
  const sortedRows = sortReportRows(rows, sortField, sortDirection);

  // Always-visible banner — shown in every render path so Refresh is never hidden.
  const statusBanner = (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl border bg-white shadow-xs">
      <div className="flex items-center gap-3">
        <span className="flex h-3 w-3 relative">
          {isLive ? (
            <>
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
            </>
          ) : (
            <span className="inline-flex rounded-full h-3 w-3 bg-gray-400" />
          )}
        </span>
        <div>
          <h2 className="text-base font-bold text-gray-900">
            {isLive ? 'Live Session Report' : 'Final Session Report'}
          </h2>
          <p className="text-xs text-gray-500">
            {isLive
              ? 'Live session: numbers will keep changing as students interact.'
              : 'This session has ended. All attendance values and engagement metrics are finalized.'}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {error && <span className="text-xs text-red-500">Refresh failed</span>}
        <button
          onClick={fetchReport}
          disabled={loading}
          className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg border border-gray-300 bg-white text-xs font-semibold text-gray-700 hover:bg-gray-50 shadow-sm transition-colors disabled:opacity-50"
        >
          <span className={loading ? 'animate-spin inline-block' : ''}>🔄</span>
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
        <button
          onClick={() => {
            const csv = buildCsv(rows);
            const filename = getFilename(
              session?.class_code ?? 'session',
              session?.started_at ?? null,
            );
            downloadCsv(csv, filename);
          }}
          disabled={rows.length === 0}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border border-emerald-300 bg-emerald-50 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 shadow-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          ⬇ Export CSV
        </button>
      </div>
    </div>
  );

  if (loading && rows.length === 0) {
    return (
      <div className="space-y-6">
        {statusBanner}
        <div className="flex flex-col items-center justify-center p-16 text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-indigo-500 border-t-transparent mb-4" />
          <p className="text-gray-500 font-medium">Generating session report…</p>
        </div>
      </div>
    );
  }

  if (error && rows.length === 0) {
    return (
      <div className="space-y-6">
        {statusBanner}
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
          <div className="text-3xl mb-2">⚠️</div>
          <h3 className="text-lg font-semibold text-red-800 mb-1">Failed to generate report</h3>
          <p className="text-sm text-red-600 mb-4">{error}</p>
          <button
            onClick={fetchReport}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-red-600 hover:bg-red-700 shadow-sm transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="space-y-6">
        {statusBanner}
        <div className="flex flex-col items-center justify-center p-16 text-center bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="text-4xl mb-3">📊</div>
          <h3 className="text-lg font-bold text-gray-800 mb-1">No attendance records yet</h3>
          <p className="text-sm text-gray-500 max-w-sm">
            Once students join and heartbeats are recorded, full attendance breakdown and check-in
            stats will appear here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {statusBanner}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-xs">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Joined</span>
          <div className="text-2xl font-black text-gray-900 mt-1">{summary.studentsJoined}</div>
          <span className="text-xs text-gray-400">of {summary.totalStudents} expected</span>
        </div>

        <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-xs">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Absent</span>
          <div className="text-2xl font-black text-gray-600 mt-1">{summary.studentsNotJoined}</div>
          <span className="text-xs text-gray-400">did not join</span>
        </div>

        <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-xs">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Avg Attendance</span>
          <div className="text-2xl font-black text-indigo-600 mt-1">
            {formatPercentage(summary.avgAttendancePct)}
          </div>
          <span className="text-xs text-gray-400">across whole roster</span>
        </div>

        <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-xs">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Avg Active</span>
          <div className="text-2xl font-black text-emerald-600 mt-1">
            {formatPercentage(summary.avgActivePct)}
          </div>
          <span className="text-xs text-gray-400">engaged tracking</span>
        </div>

        <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-xs col-span-2 md:col-span-1">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Check-in Rate</span>
          <div className="text-2xl font-black text-purple-600 mt-1">
            {formatPercentage(summary.checkinResponseRatePct)}
          </div>
          <span className="text-xs text-gray-400">response rate</span>
        </div>
      </div>

      {/* Table Section */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-gray-200 flex flex-wrap items-center justify-between gap-3 bg-gray-50/50">
          <div>
            <h3 className="text-sm font-bold text-gray-900">Student Attendance Breakdown</h3>
            <p className="text-xs text-gray-500">Click column headers to sort.</p>
          </div>
          <div className="flex items-center gap-3 text-xs text-gray-600">
            <span className="flex items-center gap-1">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500" />
              {STATUS_META.active.label}
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-amber-500" />
              {STATUS_META.distracted.label}
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-yellow-400" />
              {STATUS_META.idle.label}
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-rose-500" />
              {STATUS_META.offline.label}
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-gray-700">
            <thead className="bg-gray-50 text-gray-600 font-semibold uppercase tracking-wider text-[11px] border-b border-gray-200">
              <tr>
                <th onClick={() => handleSort('student_name')} className="py-3 px-4 cursor-pointer hover:bg-gray-100 transition-colors select-none">
                  <div className="flex items-center gap-1">Student {sortField === 'student_name' && (sortDirection === 'asc' ? '▲' : '▼')}</div>
                </th>
                <th onClick={() => handleSort('attendance_pct')} className="py-3 px-3 cursor-pointer hover:bg-gray-100 transition-colors select-none text-right">
                  <div className="flex items-center justify-end gap-1">Attendance {sortField === 'attendance_pct' && (sortDirection === 'asc' ? '▲' : '▼')}</div>
                </th>
                <th onClick={() => handleSort('active_seconds')} className="py-3 px-3 cursor-pointer hover:bg-gray-100 transition-colors select-none text-right">
                  <div className="flex items-center justify-end gap-1">Active {sortField === 'active_seconds' && (sortDirection === 'asc' ? '▲' : '▼')}</div>
                </th>
                <th onClick={() => handleSort('distracted_seconds')} className="py-3 px-3 cursor-pointer hover:bg-gray-100 transition-colors select-none text-right">
                  <div className="flex items-center justify-end gap-1">Distracted {sortField === 'distracted_seconds' && (sortDirection === 'asc' ? '▲' : '▼')}</div>
                </th>
                <th onClick={() => handleSort('idle_seconds')} className="py-3 px-3 cursor-pointer hover:bg-gray-100 transition-colors select-none text-right">
                  <div className="flex items-center justify-end gap-1">Idle {sortField === 'idle_seconds' && (sortDirection === 'asc' ? '▲' : '▼')}</div>
                </th>
                <th onClick={() => handleSort('offline_seconds')} className="py-3 px-3 cursor-pointer hover:bg-gray-100 transition-colors select-none text-right">
                  <div className="flex items-center justify-end gap-1">Offline {sortField === 'offline_seconds' && (sortDirection === 'asc' ? '▲' : '▼')}</div>
                </th>
                <th className="py-3 px-4 min-w-[160px]">Share Timeline</th>
                <th onClick={() => handleSort('checkins_answered')} className="py-3 px-4 cursor-pointer hover:bg-gray-100 transition-colors select-none text-center">
                  <div className="flex items-center justify-center gap-1">Check-ins {sortField === 'checkins_answered' && (sortDirection === 'asc' ? '▲' : '▼')}</div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sortedRows.map((row) => {
                const shares = calculateStatusShares(row);
                return (
                  <tr key={row.student_name} className={`hover:bg-gray-50/70 transition-colors ${!row.joined ? 'opacity-60' : ''}`}>
                    <td className="py-3 px-4 font-medium text-gray-900">
                      <div className="flex items-center gap-2">
                        <span>{row.student_name}</span>
                        {!row.joined && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-gray-100 text-gray-500 border border-gray-200">
                            Did not join
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="py-3 px-3 text-right font-semibold">
                      {row.joined ? (
                        <span className={row.attendance_pct >= 80 ? 'text-emerald-600' : row.attendance_pct >= 50 ? 'text-amber-600' : 'text-rose-600'}>
                          {formatPercentage(row.attendance_pct)}
                        </span>
                      ) : <span className="text-gray-300">—</span>}
                    </td>

                    <td className="py-3 px-3 text-right text-gray-600 font-mono">
                      {row.joined ? formatDuration(row.active_seconds) : '—'}
                    </td>
                    <td className="py-3 px-3 text-right text-gray-600 font-mono">
                      {row.joined ? formatDuration(row.distracted_seconds) : '—'}
                    </td>
                    <td className="py-3 px-3 text-right text-gray-600 font-mono">
                      {row.joined ? formatDuration(row.idle_seconds) : '—'}
                    </td>
                    <td className="py-3 px-3 text-right text-gray-600 font-mono">
                      {row.joined ? formatDuration(row.offline_seconds) : '—'}
                    </td>

                    <td className="py-3 px-4">
                      {row.joined && row.tracked_seconds > 0 ? (
                        <div
                          className="h-2.5 w-full bg-gray-100 rounded-full overflow-hidden flex shadow-inner"
                          title={`Active: ${shares.active.toFixed(1)}% · Distracted: ${shares.distracted.toFixed(1)}% · Idle: ${shares.idle.toFixed(1)}% · Offline: ${shares.offline.toFixed(1)}%`}
                        >
                          {shares.active > 0 && <div style={{ width: `${shares.active}%` }} className="bg-emerald-500 h-full" />}
                          {shares.distracted > 0 && <div style={{ width: `${shares.distracted}%` }} className="bg-amber-500 h-full" />}
                          {shares.idle > 0 && <div style={{ width: `${shares.idle}%` }} className="bg-yellow-400 h-full" />}
                          {shares.offline > 0 && <div style={{ width: `${shares.offline}%` }} className="bg-rose-500 h-full" />}
                        </div>
                      ) : (
                        <div className="h-2 w-full bg-gray-100 rounded-full" />
                      )}
                    </td>

                    <td className="py-3 px-4 text-center">
                      {row.joined ? (
                        row.checkins_sent > 0 ? (
                          <div className="flex flex-col items-center">
                            <span className="font-semibold text-gray-800">{row.checkins_answered} / {row.checkins_sent}</span>
                            {row.avg_checkin_response_seconds !== null && (
                              <span className="text-[10px] text-gray-400">{row.avg_checkin_response_seconds}s avg</span>
                            )}
                          </div>
                        ) : <span className="text-gray-400 text-[11px]">None</span>
                      ) : <span className="text-gray-300">—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
