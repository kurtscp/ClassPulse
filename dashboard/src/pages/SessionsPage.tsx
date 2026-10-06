import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Session } from '../lib/types';
import { useNavigate } from 'react-router-dom';

function parseRosterText(text: string): string[] {
  const lines = text.split('\n');
  const uniqueNames = new Set<string>();
  const parsed: string[] = [];

  for (const line of lines) {
    const col = line.split(',')[0] || '';
    let name = col.trim();
    if (!name) continue;
    if (name.length > 60) name = name.substring(0, 60);

    const lower = name.toLowerCase();
    if (!uniqueNames.has(lower)) {
      uniqueNames.add(lower);
      parsed.push(name);
    }
  }
  return parsed;
}

export default function SessionsPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const navigate = useNavigate();

  // Create Form State
  const [className, setClassName] = useState('');
  const [meetLink, setMeetLink] = useState('');
  const [rosterText, setRosterText] = useState('');
  const [selectedPrevSession, setSelectedPrevSession] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSessions = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('sessions').select('*').order('started_at', { ascending: false });
    if (!error && data) setSessions(data as Session[]);
    setLoading(false);
  };

  useEffect(() => {
    loadSessions();
  }, []);

  const handleCopyPrevRoster = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value;
    setSelectedPrevSession(id);
    if (!id) return;
    
    const { data } = await supabase.from('roster_entries').select('student_name').eq('session_id', id).order('student_name');
    if (data && data.length > 0) {
      setRosterText(data.map(d => d.student_name).join('\n'));
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setCreating(true);

    try {
      const { data: sessData, error: sessErr } = await supabase.rpc('create_session', {
        p_class_name: className,
        p_meet_link: meetLink || null
      });

      if (sessErr) throw sessErr;
      const newSession = sessData as any as Session;

      const parsedNames = parseRosterText(rosterText);
      if (parsedNames.length > 0) {
        const inserts = parsedNames.map(name => ({
          session_id: newSession.id,
          student_name: name
        }));
        
        const { error: rostErr } = await supabase.from('roster_entries').insert(inserts);
        if (rostErr) throw rostErr;
      }

      navigate(`/sessions/${newSession.id}`);
    } catch (err: any) {
      setError(err.message || 'Error creating session');
      setCreating(false);
    }
  };

  const parsedPreview = parseRosterText(rosterText);

  if (loading) return <div className="p-4">Loading sessions...</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Your Sessions</h1>
        <button onClick={() => setShowCreate(!showCreate)} className="bg-blue-600 text-white px-4 py-2 rounded font-medium hover:bg-blue-700 transition-colors">
          {showCreate ? 'Cancel' : 'Create Session'}
        </button>
      </div>

      {showCreate && (
        <form onSubmit={handleCreate} className="bg-white p-6 shadow-sm border border-gray-200 rounded-lg space-y-4">
          {error && <div className="p-3 bg-red-50 text-red-700 rounded text-sm">{error}</div>}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Class Name</label>
              <input required maxLength={100} value={className} onChange={e => setClassName(e.target.value)} className="w-full border border-gray-300 p-2 rounded focus:ring-1 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Meet Link (Optional)</label>
              <input type="url" value={meetLink} onChange={e => setMeetLink(e.target.value)} className="w-full border border-gray-300 p-2 rounded focus:ring-1 focus:ring-blue-500" />
            </div>
          </div>
          
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="block text-sm font-medium">Roster (Optional)</label>
              <select value={selectedPrevSession} onChange={handleCopyPrevRoster} className="text-sm border border-gray-300 p-1 rounded">
                <option value="">-- Copy from previous session --</option>
                {sessions.map(s => (
                  <option key={s.id} value={s.id}>{s.class_name} ({new Date(s.started_at).toLocaleDateString()})</option>
                ))}
              </select>
            </div>
            <textarea 
              rows={4} 
              value={rosterText} 
              onChange={e => setRosterText(e.target.value)} 
              placeholder="Paste one name per line, or CSV format (first column)..."
              className="w-full border border-gray-300 p-2 rounded font-mono text-sm focus:ring-1 focus:ring-blue-500"
            />
            <div className="text-xs text-gray-500 mt-1 font-medium">
              {parsedPreview.length} students found (duplicates and blank lines dropped)
            </div>
          </div>

          <div className="pt-2">
            <button type="submit" disabled={creating} className="w-full md:w-auto bg-green-600 text-white px-6 py-2 rounded font-medium hover:bg-green-700 disabled:opacity-50 transition-colors">
              {creating ? 'Creating...' : 'Launch Session'}
            </button>
          </div>
        </form>
      )}

      <div className="grid gap-4">
        {sessions.map(s => (
          <div key={s.id} onClick={() => navigate(`/sessions/${s.id}`)} className="bg-white p-5 shadow-sm border border-gray-200 rounded-lg cursor-pointer hover:shadow-md transition-shadow flex justify-between items-center group">
            <div>
              <h3 className="font-bold text-lg text-gray-900 group-hover:text-blue-700 transition-colors">
                {s.class_name} 
                <span className="text-sm font-mono bg-gray-100 text-gray-600 px-2 py-0.5 rounded ml-3">
                  {s.class_code}
                </span>
              </h3>
              <p className="text-sm text-gray-500 mt-1">{new Date(s.started_at).toLocaleString()}</p>
            </div>
            <div className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${s.status === 'live' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
              {s.status}
            </div>
          </div>
        ))}
        {sessions.length === 0 && !showCreate && (
          <div className="text-center p-12 border-2 border-dashed border-gray-300 rounded-lg text-gray-500">
            No sessions yet. Click "Create Session" to get started.
          </div>
        )}
      </div>
    </div>
  );
}
