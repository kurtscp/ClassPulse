import { sessionTabs } from '../features/registry';

export default function SessionPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Session View</h1>
      <div className="flex gap-4 mb-4">
        {sessionTabs.map(tab => (
          <button key={tab.id} className="px-4 py-2 bg-blue-500 text-white rounded">{tab.label}</button>
        ))}
      </div>
      <div className="p-4 bg-white shadow rounded">
        Session Content — coming soon
      </div>
    </div>
  );
}
