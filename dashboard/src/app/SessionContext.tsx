import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import type { Session, Participant, RosterEntry } from '../lib/types';
import { resolveSettings } from '../lib/settings';
import type { Settings } from '../lib/settings';
import { buildBoardRows } from '../lib/board';
import type { BoardRow } from '../lib/board';

type SessionContextType = {
  session: Session | null;
  participants: Participant[];
  roster: RosterEntry[];
  rows: BoardRow[];
  settings: Settings;
  now: Date;
  loading: boolean;
  error: string | null;
  refresh: () => void;
};

const SessionContext = createContext<SessionContextType>({} as SessionContextType);

export const SessionProvider = ({ sessionId, children }: { sessionId: string; children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [roster, setRoster] = useState<RosterEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [sessRes, partRes, rosRes] = await Promise.all([
        supabase.from('sessions').select('*').eq('id', sessionId).single(),
        supabase.from('participants').select('*').eq('session_id', sessionId),
        supabase.from('roster_entries').select('*').eq('session_id', sessionId)
      ]);
      
      if (sessRes.error) throw sessRes.error;
      
      setSession(sessRes.data as Session);
      setParticipants((partRes.data as Participant[]) || []);
      setRoster((rosRes.data as RosterEntry[]) || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load session');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    const channel = supabase.channel(`session-${sessionId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sessions', filter: `id=eq.${sessionId}` }, (payload) => {
        if (payload.eventType === 'UPDATE') {
          setSession(prev => prev ? { ...prev, ...(payload.new as Session) } : payload.new as Session);
        } else if (payload.eventType === 'DELETE') {
          setSession(null);
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'participants', filter: `session_id=eq.${sessionId}` }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setParticipants(prev => [...prev, payload.new as Participant]);
        } else if (payload.eventType === 'UPDATE') {
          setParticipants(prev => prev.map(p => p.id === payload.new.id ? { ...p, ...(payload.new as Participant) } : p));
        } else if (payload.eventType === 'DELETE') {
          setParticipants(prev => prev.filter(p => p.id !== payload.old?.id));
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'roster_entries', filter: `session_id=eq.${sessionId}` }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setRoster(prev => [...prev, payload.new as RosterEntry]);
        } else if (payload.eventType === 'UPDATE') {
          setRoster(prev => prev.map(r => r.id === payload.new.id ? { ...r, ...(payload.new as RosterEntry) } : r));
        } else if (payload.eventType === 'DELETE') {
          setRoster(prev => prev.filter(r => r.id !== payload.old?.id));
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId]);

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 5000);
    return () => clearInterval(interval);
  }, []);

  const settings = session ? resolveSettings(session.settings) : resolveSettings({});
  const rows = buildBoardRows(roster, participants, settings, now);

  return (
    <SessionContext.Provider value={{ session, participants, roster, rows, settings, now, loading, error, refresh: loadData }}>
      {children}
    </SessionContext.Provider>
  );
};

export const useSessionContext = () => useContext(SessionContext);
