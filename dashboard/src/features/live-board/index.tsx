import { useState } from 'react';
import { useSessionContext } from '../../app/SessionContext';
import { STATUS_META, type Status } from '../../lib/status';
import { formatTimeAgo } from '../../lib/format';
import { computeStatusCounts, filterRows, sortRows, type SortMode } from './logic';

export default function LiveBoard() {
  const { rows, now, session } = useSessionContext();
  const [statusFilter, setStatusFilter] = useState<Status | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('needs_attention');

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center">
        <div className="text-4xl mb-4">👋</div>
        <h2 className="text-xl font-bold text-gray-800 mb-2">Waiting for students to join</h2>
        <p className="text-gray-500 max-w-sm mx-auto">
          Share the code <strong className="text-gray-800 bg-gray-100 px-2 py-0.5 rounded ml-1">{session?.class_code}</strong> or send them the Meet link.
        </p>
      </div>
    );
  }

  const counts = computeStatusCounts(rows);
  const filtered = filterRows(rows, { statusFilter, searchQuery });
  const sortedRows = sortRows(filtered, sortMode);

  return (
    <div className="space-y-4">
      {/* Summary Bar */}
      <div className="flex flex-wrap gap-2">
        <button 
          onClick={() => setStatusFilter(null)}
          className={`px-3 py-1 rounded-full border text-sm font-semibold transition-colors ${statusFilter === null ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-700 hover:bg-gray-100'}`}
        >
          Total: {counts.total}
        </button>
        {(['active', 'distracted', 'idle', 'offline', 'not_joined'] as Status[]).map(status => {
          const meta = STATUS_META[status];
          const isActive = statusFilter === status;
          return (
            <button
              key={status}
              onClick={() => setStatusFilter(isActive ? null : status)}
              className={`px-3 py-1 rounded-full border text-sm font-semibold flex items-center gap-1 transition-all ${isActive ? 'ring-2 ring-offset-1 ' + meta.classes : meta.classes} opacity-90 hover:opacity-100`}
            >
              <span>{meta.icon}</span> {meta.label}: {counts[status]}
            </button>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-gray-50 p-3 rounded-lg border">
        <input
          type="text"
          placeholder="Search by name..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="border rounded px-3 py-2 w-full sm:w-64 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <select
          value={sortMode}
          onChange={e => setSortMode(e.target.value as SortMode)}
          className="border rounded px-3 py-2 w-full sm:w-auto focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        >
          <option value="needs_attention">Sort: Needs Attention</option>
          <option value="name_asc">Sort: Name (A-Z)</option>
          <option value="last_seen">Sort: Last Seen</option>
        </select>
      </div>

      {/* Board */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {sortedRows.map(row => {
          const meta = STATUS_META[row.status];
          const lastSeenStr = row.participant ? formatTimeAgo(row.participant.last_seen_at, now) : null;
          
          return (
            <div key={row.key} className={`border rounded-lg p-4 shadow-sm flex flex-col ${meta.classes}`}>
              <div className="flex justify-between items-start mb-2">
                <span className="font-bold text-gray-900 truncate pr-2">{row.name}</span>
                <span title={meta.label}>{meta.icon}</span>
              </div>
              
              <div className="mt-auto pt-4 flex justify-between items-end">
                <span className="text-xs font-semibold uppercase tracking-wider opacity-80">
                  {row.status === 'not_joined' ? 'Not joined yet' : meta.label}
                </span>
                
                {row.status !== 'not_joined' && lastSeenStr && (
                  <span className="text-xs opacity-75">seen {lastSeenStr}</span>
                )}
              </div>
            </div>
          );
        })}
        {sortedRows.length === 0 && (
          <div className="col-span-full py-8 text-center text-gray-500">
            No students match your filters.
          </div>
        )}
      </div>
    </div>
  );
}
