import { useState, useRef, useEffect } from 'react';
import { useSessionContext } from '../../app/SessionContext';
import { STATUS_META, type Status } from '../../lib/status';
import { formatTimeAgo } from '../../lib/format';
import { computeStatusCounts, filterRows, sortRows, generateCSV, downloadCSV, type SortMode } from './logic';
import type { BoardRow } from '../../lib/board';
import StudentDrawer from './StudentDrawer';

export default function LiveBoard() {
  const { rows, now, session } = useSessionContext();
  const [statusFilter, setStatusFilter] = useState<Status | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('needs_attention');
  const [selectedRow, setSelectedRow] = useState<BoardRow | null>(null);
  const [copied, setCopied] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '/') {
        if (document.activeElement === searchInputRef.current) return;
        e.preventDefault();
        if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (rows.length === 0) {
    const handleCopy = () => {
      if (session?.class_code) {
        navigator.clipboard.writeText(session.class_code);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    };

    return (
      <div className="flex flex-col items-center justify-center py-16 px-4">
        <div className="max-w-md w-full bg-white border rounded-xl shadow-sm p-8 text-center space-y-6">
          <div className="text-5xl" aria-hidden="true">👋</div>
          
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Ready for class</h2>
            <p className="text-gray-600">Share this session code with your students:</p>
          </div>

          <div className="flex items-center justify-center gap-3">
            <div className="text-3xl font-mono font-bold tracking-wider text-blue-600 bg-blue-50 px-4 py-2 rounded-lg border border-blue-100">
              {session?.class_code || '------'}
            </div>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-2 px-4 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              aria-label="Copy class code"
            >
              {copied ? 'Copied!' : 'Copy Code'}
            </button>
          </div>

          <div className="text-left bg-gray-50 p-6 rounded-lg border mt-2">
            <h3 className="font-semibold text-gray-900 mb-3">How to start:</h3>
            <ol className="list-decimal list-inside space-y-3 text-gray-700 text-sm">
              <li><span className="font-medium text-gray-900">Share the class code</span> with your students.</li>
              <li>Instruct students to join the <span className="font-medium text-gray-900">Google Meet</span> with the ClassPulse extension enabled.</li>
              <li>Watch students populate this board in <span className="font-medium text-gray-900">real time</span> as they connect.</li>
            </ol>
          </div>
        </div>
      </div>
    );
  }

  const counts = computeStatusCounts(rows);
  const filtered = filterRows(rows, { statusFilter, searchQuery });
  const sortedRows = sortRows(filtered, sortMode);
  
  const needsAttentionStudents = rows.filter(r => r.status === 'distracted' || r.status === 'idle');

  return (
    <div className="space-y-6">
      {session?.ended_at && (
        <div className="bg-blue-50 border border-blue-200 text-blue-800 p-4 rounded-2xl shadow-sm flex items-center gap-3">
          <svg className="w-6 h-6 text-blue-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="font-medium text-sm">
            This session has ended. Real-time tracking is paused. Switch to the Report tab to view final attendance and engagement analytics.
          </span>
        </div>
      )}

      {needsAttentionStudents.length > 0 && !session?.ended_at && (
        <div 
          className="relative overflow-hidden bg-white/60 backdrop-blur-md border border-amber-200/80 p-4 rounded-2xl shadow-sm ring-1 ring-amber-500/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-all"
          aria-live="polite"
        >
          {/* Subtle glowing ambient background gradient */}
          <div className="absolute inset-0 bg-gradient-to-r from-amber-50/80 to-transparent pointer-events-none"></div>
          
          <div className="relative flex items-center gap-3 text-amber-900 z-10">
            <div className="relative flex h-4 w-4 items-center justify-center">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-60"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500 shadow-[0_0_12px_rgba(245,158,11,0.8)]"></span>
            </div>
            <span className="font-medium text-sm tracking-tight"><strong className="font-bold">{needsAttentionStudents.length} student{needsAttentionStudents.length !== 1 ? 's' : ''}</strong> requires your attention</span>
          </div>
          <div className="relative flex flex-wrap gap-2 z-10">
            {needsAttentionStudents.map(student => (
              <button
                key={student.key}
                onClick={() => setSelectedRow(student)}
                className="bg-white border border-amber-200/80 text-amber-900 text-xs px-3 py-1.5 rounded-lg font-bold shadow-sm hover:bg-amber-50 hover:border-amber-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 transition-all hover:shadow hover:-translate-y-0.5 active:scale-95 active:translate-y-0"
                aria-label={`View details for ${student.name}`}
              >
                {student.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Summary Bar */}
      <div className="flex flex-wrap gap-2 sm:gap-3" aria-live="polite">
        <button 
          onClick={() => setStatusFilter(null)}
          className={`px-4 py-1.5 rounded-full border text-sm font-semibold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-slate-400 ${statusFilter === null ? 'bg-slate-800 text-white border-slate-800 shadow-md ring-2 ring-offset-2 ring-slate-800' : 'bg-white text-slate-600 hover:bg-slate-50 border-slate-200 shadow-sm'}`}
        >
          Total <span className={`ml-1.5 px-2 py-0.5 rounded-full text-xs font-mono ${statusFilter === null ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'}`}>{counts.total}</span>
        </button>
        {(['active', 'distracted', 'idle', 'offline', 'not_joined'] as Status[]).map(status => {
          const meta = STATUS_META[status];
          const isActive = statusFilter === status;
          
          let customClasses = meta.classes;
          if (status === 'active') customClasses = 'text-emerald-700 bg-emerald-50 border-emerald-200 ring-emerald-500';
          if (status === 'distracted') customClasses = 'text-amber-700 bg-amber-50 border-amber-200 ring-amber-500';
          if (status === 'idle') customClasses = 'text-yellow-700 bg-yellow-50 border-yellow-200 ring-yellow-500';
          if (status === 'offline') customClasses = 'text-rose-700 bg-rose-50 border-rose-200 ring-rose-500';
          if (status === 'not_joined') customClasses = 'text-slate-600 bg-slate-50 border-slate-200 ring-slate-400';

          return (
            <button
              key={status}
              onClick={() => setStatusFilter(isActive ? null : status)}
              className={`relative px-4 py-1.5 rounded-full border text-sm transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 flex items-center gap-2 ${customClasses} ${isActive ? 'font-bold shadow-sm ring-2 ring-offset-2' : 'font-medium opacity-80 hover:opacity-100 hover:shadow-sm'}`}
            >
              <span className={`w-2 h-2 rounded-full bg-current ${isActive ? 'shadow-[0_0_8px_currentColor]' : ''}`}></span>
              <span className="sr-only">{meta.label} count: </span>
              {meta.label}
              <span className={`ml-1 px-2 py-0.5 rounded-full text-xs font-mono bg-white/60 ${isActive ? 'font-bold' : ''}`}>
                {counts[status]}
              </span>
            </button>
          );
        })}
      </div>      {/* Controls */}
      <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-transparent">
        <div className="w-full md:w-80 relative group">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
            <svg className="h-4 w-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search students..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="block w-full pl-10 pr-14 py-2 bg-white/60 backdrop-blur-md border border-slate-200/80 rounded-xl text-slate-900 focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all text-sm font-medium outline-none shadow-sm"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute inset-y-0 right-10 pr-2 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none"
              aria-label="Clear search"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
          <div className="absolute inset-y-0 right-0 pr-2 flex items-center pointer-events-none">
            <kbd className="hidden sm:inline-flex items-center bg-slate-100 border border-slate-200 rounded px-1.5 py-0.5 text-[10px] font-sans font-bold text-slate-500 shadow-sm">/</kbd>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 items-center w-full md:w-auto">
          <button
            onClick={() => downloadCSV(generateCSV(sortedRows, now), `classpulse-export-${new Date().toISOString().split('T')[0]}.csv`)}
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-semibold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-xl transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 shadow-sm hover:shadow-md active:scale-95"
            aria-label="Export CSV"
            title="Quick Export CSV"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Export
          </button>
          
          <div className="relative">
            <select
              value={sortMode}
              onChange={e => setSortMode(e.target.value as SortMode)}
              className="appearance-none pl-4 pr-9 py-1.5 bg-white border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 rounded-xl cursor-pointer shadow-sm transition-all"
            >
              <option value="needs_attention">Sort: Needs Attention</option>
              <option value="name_asc">Sort: Name (A-Z)</option>
              <option value="last_seen">Sort: Last Seen</option>
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>

          <div className="flex p-1 bg-slate-100/80 backdrop-blur-md rounded-xl border border-slate-200/50 shadow-inner">
            <button 
              onClick={() => setViewMode('grid')}
              className={`px-3 py-1 text-sm font-semibold rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 transition-all duration-200 ${viewMode === 'grid' ? 'bg-white text-slate-900 shadow-sm border border-slate-200/50' : 'text-slate-500 hover:text-slate-700'}`}
              aria-pressed={viewMode === 'grid'}
              aria-label="Grid View"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
            </button>
            <button 
              onClick={() => setViewMode('table')}
              className={`px-3 py-1 text-sm font-semibold rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 transition-all duration-200 ${viewMode === 'table' ? 'bg-white text-slate-900 shadow-sm border border-slate-200/50' : 'text-slate-500 hover:text-slate-700'}`}
              aria-pressed={viewMode === 'table'}
              aria-label="Table View"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" /></svg>
            </button>
          </div>
        </div>
      </div>

      {/* Board */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-5">
          {sortedRows.map(row => {
            const meta = STATUS_META[row.status];
            const lastSeenStr = row.participant ? (session?.ended_at ? 'At session end' : formatTimeAgo(row.participant.last_seen_at, now)) : null;
            
            // Get initials (up to 2 letters)
            const initials = row.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
            
            // Status dot color mapping
            let dotColor = 'bg-slate-300';
            let dotGlow = false;
            if (row.status === 'active') dotColor = 'bg-emerald-500';
            if (row.status === 'distracted') { dotColor = 'bg-amber-500'; dotGlow = true; }
            if (row.status === 'idle') { dotColor = 'bg-yellow-400'; dotGlow = true; }
            if (row.status === 'offline') dotColor = 'bg-rose-500';

            return (
              <div 
                key={row.key} 
                onClick={() => setSelectedRow(row)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setSelectedRow(row);
                  }
                }}
                aria-label={`View details for ${row.name}. Status: ${meta.label}`}
                className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white/70 backdrop-blur-sm p-5 shadow-[0_2px_10px_rgba(0,0,0,0.02)] cursor-pointer transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_8px_30px_rgba(0,0,0,0.08)] hover:border-slate-300 active:scale-95 focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-500/30"
              >
                <div className="flex justify-between items-start mb-5">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <div className="flex items-center justify-center w-10 h-10 rounded-full bg-slate-100 border border-slate-200 text-slate-600 font-bold text-sm shadow-sm">
                        {initials}
                      </div>
                      <span className="absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-white">
                        {dotGlow && (
                          <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${dotColor} opacity-75`}></span>
                        )}
                        <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${dotColor}`}></span>
                      </span>
                    </div>
                    <div className="flex flex-col">
                      <span className="font-bold text-slate-900 text-base truncate max-w-[140px] group-hover:text-indigo-600 transition-colors">{row.name}</span>
                      <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">{row.status === 'not_joined' ? 'Not Joined' : meta.label}</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-50 opacity-80 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                  </div>
                </div>
                
                <div className="pt-4 border-t border-slate-100/80 flex justify-between items-center">
                  <span className="text-xs font-medium text-slate-500 group-hover:text-slate-700 transition-colors">
                    {row.status === 'not_joined' ? 'Waiting for connection...' : lastSeenStr ? `Last seen ${lastSeenStr}` : 'Online'}
                  </span>
                  
                  <span className="text-xs font-bold text-indigo-600 opacity-0 transform translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300">
                    Inspect &rarr;
                  </span>
                </div>
              </div>
            );
          })}
          {sortedRows.length === 0 && (
            <div className="col-span-full py-12 text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-50 border mb-4">
                <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900">No students match your filters</h3>
              <p className="mt-1 text-gray-500">Try adjusting your search or clearing the status filter.</p>
            </div>
          )}
        </div>
      ) : (
        <div className="overflow-hidden border border-slate-200/80 rounded-2xl shadow-sm bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-slate-50/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-10 text-slate-500 uppercase tracking-wider text-xs font-bold">
                <tr>
                  <th className="px-6 py-4">Student</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Last Seen</th>
                  <th className="px-6 py-4 text-right pr-8">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sortedRows.map((row) => {
                  const meta = STATUS_META[row.status];
                  const lastSeenStr = row.participant ? (session?.ended_at ? 'At session end' : formatTimeAgo(row.participant.last_seen_at, now)) : null;
                  const initials = row.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
                  
                  let customClasses = meta.classes;
                  if (row.status === 'active') customClasses = 'text-emerald-700 bg-emerald-50 border-emerald-200';
                  if (row.status === 'distracted') customClasses = 'text-amber-700 bg-amber-50 border-amber-200';
                  if (row.status === 'idle') customClasses = 'text-yellow-700 bg-yellow-50 border-yellow-200';
                  if (row.status === 'offline') customClasses = 'text-rose-700 bg-rose-50 border-rose-200';
                  if (row.status === 'not_joined') customClasses = 'text-slate-600 bg-slate-50 border-slate-200';

                  return (
                    <tr 
                      key={row.key}
                      onClick={() => setSelectedRow(row)}
                      className="group cursor-pointer transition-colors focus:outline-none focus-visible:bg-indigo-50 hover:bg-slate-50/80 bg-white"
                      tabIndex={0}
                      role="button"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setSelectedRow(row);
                        }
                      }}
                      aria-label={`View details for ${row.name}. Status: ${meta.label}`}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 border border-slate-200 text-slate-600 font-bold text-xs shadow-sm">
                            {initials}
                          </div>
                          <span className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">{row.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold shadow-sm border ${customClasses}`}>
                          <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                          {meta.label}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-500 font-medium">
                        {row.status === 'not_joined' ? '-' : (lastSeenStr || '-')}
                      </td>
                      <td className="px-6 py-4 text-right pr-8">
                        <button 
                          tabIndex={-1}
                          className="inline-flex items-center justify-center px-3 py-1.5 text-xs font-bold text-slate-600 bg-white border border-slate-200 rounded-lg group-hover:border-indigo-200 group-hover:text-indigo-600 group-hover:bg-indigo-50 transition-all shadow-sm focus:outline-none"
                        >
                          Inspect
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {sortedRows.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-slate-500 font-medium">
                      No students match your filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {selectedRow && (
        <StudentDrawer 
          row={selectedRow} 
          onClose={() => setSelectedRow(null)} 
        />
      )}
    </div>
  );
}
