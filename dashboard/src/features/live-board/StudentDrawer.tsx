import { useEffect, useState, useRef } from 'react';
import { useSessionContext } from '../../app/SessionContext';
import { supabase } from '../../lib/supabase';
import { STATUS_META, type Status } from '../../lib/status';
import { formatTimeAgo } from '../../lib/format';
import type { BoardRow } from '../../lib/board';

type StudentDrawerProps = {
  row: BoardRow;
  onClose: () => void;
};

function formatDuration(ms: number) {
  if (ms < 0) ms = 0;
  const totalSecs = Math.floor(ms / 1000);
  const m = Math.floor(totalSecs / 60);
  const s = totalSecs % 60;
  if (m === 0) return `${s}s`;
  return `${m}m ${s}s`;
}

function getStatusReason(row: BoardRow, now: Date, sessionEndedAt?: string | null) {
  if (!row.participant) return '';

  const referenceTime = sessionEndedAt ? new Date(sessionEndedAt) : now;

  switch (row.status) {
    case 'offline': {
      const ts = row.participant.last_seen_at || row.participant.joined_at;
      const duration = formatDuration(referenceTime.getTime() - new Date(ts).getTime());
      return sessionEndedAt
        ? `Offline: No signal for ${duration} prior to session end.`
        : `No signal received for ${duration}`;
    }
    case 'idle': {
      const ts = row.participant.idle_since || row.participant.last_seen_at || row.participant.joined_at;
      const duration = formatDuration(referenceTime.getTime() - new Date(ts).getTime());
      return sessionEndedAt
        ? `Idle: No input for ${duration} prior to session end.`
        : `No mouse or keyboard input for ${duration}`;
    }
    case 'distracted': {
      const ts = row.participant.unfocused_since || row.participant.last_seen_at || row.participant.joined_at;
      const duration = formatDuration(referenceTime.getTime() - new Date(ts).getTime());
      return sessionEndedAt
        ? `Distracted: Tab unfocused for ${duration} prior to session end.`
        : `Meet tab not focused for ${duration}`;
    }
    case 'active':
      return sessionEndedAt ? 'Active until session ended.' : 'Active in Google Meet';
    default:
      return '';
  }
}

export default function StudentDrawer({ row, onClose }: StudentDrawerProps) {
  const { now, session } = useSessionContext();
  const [heartbeats, setHeartbeats] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);

  // Animate in
  useEffect(() => {
    setIsOpen(true);
  }, []);

  const handleClose = () => {
    setIsOpen(false);
    setTimeout(onClose, 300);
  };

  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setIsOpen(false);
        setTimeout(onClose, 300);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Focus the drawer on mount
  useEffect(() => {
    drawerRef.current?.focus();
  }, []);

  // Fetch heartbeats if joined
  useEffect(() => {
    if (!row.participant) return;

    async function fetchHeartbeats() {
      const referenceMs = session?.ended_at ? new Date(session.ended_at).getTime() : Date.now();
      const thirtyMinsAgo = new Date(referenceMs - 30 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from('heartbeats')
        .select('*')
        .eq('participant_id', row.participant!.id)
        .gte('created_at', thirtyMinsAgo)
        .order('created_at', { ascending: true });

      if (!error && data) {
        setHeartbeats(data);
      }
      setIsLoading(false);
    }

    fetchHeartbeats();
    if (session?.ended_at) return;
    
    const interval = setInterval(fetchHeartbeats, 15000);
    return () => clearInterval(interval);
  }, [row.participant, session?.ended_at]);

  const meta = STATUS_META[row.status];

  return (
    <>
      <div 
        className={`fixed inset-0 z-40 transition-all duration-500 ${isOpen ? 'opacity-100 backdrop-blur-[3px]' : 'opacity-0 backdrop-blur-none pointer-events-none'}`} 
        style={{ backgroundColor: 'rgba(15, 23, 42, 0.45)' }}
        onClick={handleClose} 
        aria-hidden="true" 
      />
      <div 
        ref={drawerRef}
        role="dialog" 
        aria-modal="true" 
        aria-label={`Student details for ${row.name}`}
        tabIndex={-1}
        className={`fixed inset-y-0 right-0 w-full sm:w-[26rem] bg-white/95 backdrop-blur-xl shadow-2xl z-50 flex flex-col outline-none overflow-y-auto transform transition-transform duration-500 ease-out border-l border-slate-200/50 ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <div className="p-6 pb-4 border-b border-slate-200/60 flex justify-between items-start bg-white/60">
          <div>
            <h2 className="text-2xl font-extrabold text-slate-900 truncate pr-4 tracking-tight">{row.name}</h2>
            <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold mt-3 shadow-sm border bg-white/80 ${meta.classes.replace(/text-/, 'text-').replace(/bg-/, 'border-')}`}>
              <span aria-hidden="true">{meta.icon}</span> {meta.label}
            </div>
          </div>
          <button 
            onClick={handleClose} 
            className="text-slate-400 hover:text-slate-900 hover:bg-slate-100 p-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded-full transition-all"
            aria-label="Close drawer"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="p-6 flex-1 space-y-6">
          {!row.participant ? (
            <div className="text-gray-500 text-center mt-12 bg-gray-50/50 p-8 rounded-2xl border border-gray-100 border-dashed">
              Has not joined yet
            </div>
          ) : (
            <div className="space-y-6">
              {/* Status Reason Card */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm relative overflow-hidden group hover:border-slate-300 transition-colors">
                <div className={`absolute top-0 left-0 w-1 h-full ${meta.classes}`}></div>
                <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-[0.2em] mb-2 block ml-2">Current State</span>
                <p className="text-slate-800 font-semibold ml-2 text-sm leading-relaxed">
                  {getStatusReason(row, now, session?.ended_at)}
                </p>
              </div>

              {/* Timestamps */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm hover:border-slate-300 transition-colors">
                <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-[0.2em] mb-4 block">Session Times</span>
                <div className="space-y-4 text-sm text-slate-700">
                  <div className="flex justify-between items-center pb-4 border-b border-slate-100/80">
                    <span className="font-semibold text-slate-600">Joined</span> 
                    <span className="text-slate-800 font-bold bg-slate-100 px-3 py-1 rounded-lg border border-slate-200/60 shadow-inner text-xs">{new Date(row.participant.joined_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                  </div>
                  {row.participant.last_seen_at && (
                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-slate-600">Last Seen</span> 
                      <span className="text-indigo-800 font-bold bg-indigo-50 px-3 py-1 rounded-lg border border-indigo-100/80 shadow-inner text-xs">{formatTimeAgo(row.participant.last_seen_at, now)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Timeline Strip */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-4 hover:border-slate-300 transition-colors">
                <h3 className="text-[10px] font-extrabold text-slate-400 uppercase tracking-[0.2em] mb-4">30-Min Activity</h3>
                {isLoading ? (
                  <div className="w-full h-10 rounded-xl bg-slate-100 animate-pulse border border-slate-200"></div>
                ) : heartbeats.length === 0 ? (
                  <div className="text-sm text-slate-500 font-medium bg-slate-50 p-4 rounded-xl text-center border border-slate-200 border-dashed">
                    No activity recorded in the last 30 minutes.
                  </div>
                ) : (
                  <>
                    <div className="flex w-full h-10 gap-0.5 rounded-xl overflow-hidden bg-slate-50 border border-slate-200/60 shadow-inner p-1">
                      {heartbeats.map((hb) => {
                        let status: Status = 'active';
                        if (!hb.meet_tab_open) status = 'offline';
                        else if (!hb.meet_tab_focused) status = 'distracted';
                        else if (hb.system_state === 'idle' || hb.system_state === 'locked') status = 'idle';

                        let bgColor = 'bg-slate-300';
                        if (status === 'active') bgColor = 'bg-emerald-500';
                        if (status === 'distracted') bgColor = 'bg-amber-400';
                        if (status === 'idle') bgColor = 'bg-yellow-400';
                        if (status === 'offline') bgColor = 'bg-rose-500';

                        return (
                          <div 
                            key={hb.id} 
                            className={`flex-1 ${bgColor} rounded-sm opacity-90 hover:opacity-100 hover:scale-y-110 transition-all cursor-pointer`}
                            title={`${new Date(hb.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} - ${STATUS_META[status].label}`} 
                          />
                        );
                      })}
                    </div>
                    {/* Timeline Markers */}
                    <div className="flex justify-between text-[11px] font-bold text-slate-400 mt-2 px-1 tracking-wide">
                      <span>-30m</span>
                      <span>-15m</span>
                      <span>Now</span>
                    </div>
                    {/* Legend */}
                    <div className="flex flex-wrap gap-4 text-xs font-bold mt-5 justify-center bg-slate-50/80 rounded-xl p-3 border border-slate-100 text-slate-600">
                      <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm"></div> Active</div>
                      <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-amber-400 shadow-sm"></div> Distracted</div>
                      <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-yellow-400 shadow-sm"></div> Idle</div>
                      <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-sm"></div> Offline</div>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
