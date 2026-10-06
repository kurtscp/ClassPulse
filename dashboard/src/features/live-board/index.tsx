import { useSessionContext } from '../../app/SessionContext';
import { STATUS_META } from '../../lib/status';
import { formatTimeAgo } from '../../lib/format';

export default function LiveBoard() {
  const { rows, now, session } = useSessionContext();

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

  // Sort rows alphabetically for stability
  const sortedRows = [...rows].sort((a, b) => a.name.localeCompare(b.name));

  return (
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
    </div>
  );
}
