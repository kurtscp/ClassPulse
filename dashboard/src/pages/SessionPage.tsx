import { useParams } from 'react-router-dom';
import { SessionProvider, useSessionContext } from '../app/SessionContext';
import { sessionTabs } from '../features/registry';
import { useState } from 'react';
import { supabase } from '../lib/supabase';

function RosterManager() {
  const { session, roster, refresh } = useSessionContext();
  const [open, setOpen] = useState(false);
  const [addText, setAddText] = useState('');
  const [processing, setProcessing] = useState(false);

  if (!session) return null;

  const handleAdd = async () => {
    const lines = addText.split('\n');
    const uniqueNames = new Set<string>();
    const parsed: string[] = [];
    
    for (const line of lines) {
      const col = line.split(',')[0] || '';
      let name = col.trim();
      if (!name) continue;
      if (name.length > 60) name = name.substring(0, 60);
      const lower = name.toLowerCase();
      
      const exists = roster.some(r => r.student_name.toLowerCase() === lower);
      if (!uniqueNames.has(lower) && !exists) {
        uniqueNames.add(lower);
        parsed.push(name);
      }
    }

    if (parsed.length === 0) {
      alert("No new valid names found.");
      return;
    }

    setProcessing(true);
    const inserts = parsed.map(n => ({ session_id: session.id, student_name: n }));
    await supabase.from('roster_entries').insert(inserts);
    setAddText('');
    setProcessing(false);
    refresh();
  };

  const handleRemove = async (id: string) => {
    if (!confirm('Remove this unclaimed name from the roster?')) return;
    setProcessing(true);
    await supabase.from('roster_entries').delete().eq('id', id);
    setProcessing(false);
  };

  const handleRelease = async (id: string) => {
    if (!confirm("Release this entry? This deletes the student's data for this session.")) return;
    setProcessing(true);
    const { error } = await supabase.rpc('release_roster_entry', { p_entry_id: id });
    if (error) alert(error.message);
    setProcessing(false);
  };

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-sm font-medium rounded-md transition-colors border border-gray-200">
        Manage Roster
      </button>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white p-6 rounded-lg max-w-lg w-full max-h-[90vh] overflow-y-auto space-y-6 shadow-xl">
        <div className="flex justify-between items-center border-b pb-3">
          <h2 className="text-xl font-bold">Manage Roster</h2>
          <button onClick={() => setOpen(false)} className="text-gray-500 hover:text-black font-bold text-lg leading-none">&times;</button>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Add Students</label>
          <textarea 
            value={addText} 
            onChange={e => setAddText(e.target.value)} 
            placeholder="One per line or CSV..." 
            className="w-full border border-gray-300 p-2 rounded text-sm font-mono focus:ring-1 focus:ring-blue-500" 
            rows={3} 
          />
          <button 
            onClick={handleAdd} 
            disabled={processing} 
            className="mt-2 bg-blue-600 text-white px-4 py-1.5 rounded text-sm font-medium disabled:opacity-50 hover:bg-blue-700 transition-colors"
          >
            Add Names
          </button>
        </div>

        <div>
          <h3 className="font-bold mb-3 flex items-center gap-2">
            Current Roster 
            <span className="bg-gray-100 text-gray-700 text-xs px-2 py-0.5 rounded-full">{roster.length}</span>
          </h3>
          <ul className="space-y-2">
            {roster.sort((a,b) => a.student_name.localeCompare(b.student_name)).map(r => (
              <li key={r.id} className="flex justify-between items-center text-sm p-2 border border-gray-200 rounded bg-gray-50">
                <span className={r.participant_id ? 'font-semibold text-green-700' : 'text-gray-700 font-medium'}>
                  {r.student_name} {r.participant_id ? '✓' : ''}
                </span>
                {r.participant_id ? (
                  <button onClick={() => handleRelease(r.id)} disabled={processing} className="text-red-600 hover:text-red-800 disabled:opacity-50 text-xs font-semibold uppercase tracking-wider">Release</button>
                ) : (
                  <button onClick={() => handleRemove(r.id)} disabled={processing} className="text-gray-500 hover:text-gray-700 disabled:opacity-50 text-xs font-semibold uppercase tracking-wider">Remove</button>
                )}
              </li>
            ))}
            {roster.length === 0 && <p className="text-sm text-gray-500 italic">No roster entries.</p>}
          </ul>
        </div>
      </div>
    </div>
  );
}

function SessionInner() {
  const { session, loading, error, refresh } = useSessionContext();
  const [activeTab, setActiveTab] = useState(sessionTabs[0].id);

  if (loading) return <div className="p-4">Loading session...</div>;
  if (error || !session) return <div className="p-4 text-red-600 bg-red-50 rounded border border-red-200">{error || 'Session not found'}</div>;

  const handleEndSession = async () => {
    if (!confirm('Are you sure you want to end this session?')) return;
    await supabase.from('sessions').update({ status: 'ended', ended_at: new Date().toISOString() }).eq('id', session.id);
    refresh();
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(session.class_code);
  };

  const ActiveComponent = sessionTabs.find(t => t.id === activeTab)?.component;

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 shadow-sm border border-gray-200 rounded-lg flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{session.class_name}</h1>
          <div className="flex flex-wrap items-center gap-3 mt-3">
            <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${session.status === 'live' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
              {session.status}
            </span>
            <button 
              onClick={handleCopyCode} 
              className="font-mono bg-gray-100 px-3 py-1 rounded text-sm font-semibold text-gray-700 hover:bg-gray-200 transition-colors border border-gray-200 flex items-center gap-1 cursor-pointer"
              title="Copy Class Code"
            >
              {session.class_code} 📋
            </button>
            {session.meet_link && (
              <a href={session.meet_link} target="_blank" rel="noreferrer" className="text-blue-600 hover:text-blue-800 hover:underline text-sm font-medium">
                Open Google Meet ↗
              </a>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-3">
          {session.status === 'live' && (
            <button onClick={handleEndSession} className="px-4 py-2 bg-red-600 text-white rounded-md font-medium hover:bg-red-700 transition-colors shadow-sm">
              End Session
            </button>
          )}
          <RosterManager />
        </div>
      </div>

      <div className="flex gap-1 border-b border-gray-200 overflow-x-auto">
        {sessionTabs.map(tab => (
          <button 
            key={tab.id} 
            onClick={() => setActiveTab(tab.id)}
            className={`px-5 py-3 font-medium text-sm border-b-2 transition-colors whitespace-nowrap ${activeTab === tab.id ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="bg-white p-6 shadow-sm border border-gray-200 rounded-lg min-h-[400px]">
        {ActiveComponent && <ActiveComponent />}
      </div>
    </div>
  );
}

export default function SessionPage() {
  const { sessionId } = useParams();
  if (!sessionId) return null;
  return (
    <SessionProvider sessionId={sessionId}>
      <SessionInner />
    </SessionProvider>
  );
}
