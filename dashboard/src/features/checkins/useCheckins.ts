import { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import type { Checkin, CheckinResponse } from '../../lib/types';

export function useCheckins(sessionId: string | undefined) {
  const [checkins, setCheckins] = useState<Checkin[]>([]);
  const [responses, setResponses] = useState<CheckinResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [reloadTrigger, setReloadTrigger] = useState(0);

  // Keep a ref of current checkin IDs so realtime response listener can quickly match
  const checkinIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    checkinIdsRef.current = new Set(checkins.map((c) => c.id));
  }, [checkins]);

  useEffect(() => {
    let ignore = false;

    async function fetchData() {
      if (!sessionId) {
        setCheckins([]);
        setResponses([]);
        setLoading(false);
        return;
      }

      setError(null);
      try {
        const { data: checkinData, error: checkinErr } = await supabase
          .from('checkins')
          .select('*')
          .eq('session_id', sessionId)
          .order('sent_at', { ascending: false });

        if (checkinErr) throw checkinErr;
        if (ignore) return;

        const loadedCheckins = (checkinData as Checkin[]) || [];
        setCheckins(loadedCheckins);

        const checkinIds = loadedCheckins.map((c) => c.id);
        checkinIdsRef.current = new Set(checkinIds);

        if (checkinIds.length > 0) {
          const { data: respData, error: respErr } = await supabase
            .from('checkin_responses')
            .select('*')
            .in('checkin_id', checkinIds);

          if (respErr) throw respErr;
          if (ignore) return;
          setResponses((respData as CheckinResponse[]) || []);
        } else {
          setResponses([]);
        }
      } catch (err: unknown) {
        if (ignore) return;
        const msg = err instanceof Error ? err.message : 'Failed to load check-ins';
        setError(msg);
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    fetchData();

    if (!sessionId) return;

    // Realtime channel for checkins and checkin_responses
    const channel = supabase
      .channel(`checkins-realtime-${sessionId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'checkins', filter: `session_id=eq.${sessionId}` },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newCheckin = payload.new as Checkin;
            checkinIdsRef.current.add(newCheckin.id);
            setCheckins((prev) => {
              if (prev.some((c) => c.id === newCheckin.id)) return prev;
              return [newCheckin, ...prev].sort(
                (a, b) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime()
              );
            });
          } else if (payload.eventType === 'UPDATE') {
            const updated = payload.new as Checkin;
            setCheckins((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
          } else if (payload.eventType === 'DELETE') {
            const deletedId = (payload.old as { id: string })?.id;
            if (deletedId) {
              checkinIdsRef.current.delete(deletedId);
              setCheckins((prev) => prev.filter((c) => c.id !== deletedId));
              setResponses((prev) => prev.filter((r) => r.checkin_id !== deletedId));
            }
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'checkin_responses' },
        (payload) => {
          const newResp = payload.new as CheckinResponse;
          if (checkinIdsRef.current.has(newResp.checkin_id)) {
            setResponses((prev) => {
              const alreadyExists = prev.some(
                (r) => r.checkin_id === newResp.checkin_id && r.participant_id === newResp.participant_id
              );
              if (alreadyExists) return prev;
              return [...prev, newResp];
            });
          }
        }
      )
      .subscribe();

    return () => {
      ignore = true;
      supabase.removeChannel(channel);
    };
  }, [sessionId, reloadTrigger]);

  const refresh = useCallback(() => {
    setLoading(true);
    setReloadTrigger((count) => count + 1);
  }, []);

  const sendCheckin = useCallback(async () => {
    if (!sessionId) return;
    setSending(true);
    setError(null);
    try {
      const { data, error: insertErr } = await supabase
        .from('checkins')
        .insert({ session_id: sessionId })
        .select()
        .single();

      if (insertErr) throw insertErr;

      if (data) {
        const newCheckin = data as Checkin;
        checkinIdsRef.current.add(newCheckin.id);
        setCheckins((prev) => {
          if (prev.some((c) => c.id === newCheckin.id)) return prev;
          return [newCheckin, ...prev].sort(
            (a, b) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime()
          );
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : (err as any)?.message || 'Failed to send check-in';
      setError(msg);
      throw err;
    } finally {
      setSending(false);
    }
  }, [sessionId]);

  const responsesByCheckinId = useMemo(() => {
    const map: Record<string, CheckinResponse[]> = {};
    for (const resp of responses) {
      if (!map[resp.checkin_id]) {
        map[resp.checkin_id] = [];
      }
      map[resp.checkin_id].push(resp);
    }
    return map;
  }, [responses]);

  const latestCheckin = checkins.length > 0 ? checkins[0] : null;
  const earlierCheckins = checkins.length > 1 ? checkins.slice(1) : [];

  return {
    checkins,
    responses,
    responsesByCheckinId,
    latestCheckin,
    earlierCheckins,
    loading,
    error,
    sending,
    sendCheckin,
    refresh
  };
}
