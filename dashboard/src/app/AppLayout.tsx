import { Outlet } from 'react-router-dom';
import { useAuth } from './AuthProvider';

export default function AppLayout() {
  const { user, signOut } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans">
      <header className="bg-white border-b border-gray-200 px-6 py-3 flex justify-between items-center sticky top-0 z-10">
        <h1 className="font-bold text-xl text-blue-600 tracking-tight">ClassPulse</h1>
        {user && (
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium text-gray-600">{user.email}</span>
            <button 
              onClick={signOut}
              className="text-sm font-medium px-4 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-md text-gray-700 transition-colors"
            >
              Sign out
            </button>
          </div>
        )}
      </header>
      <main className="p-6 max-w-7xl mx-auto">
        <Outlet />
      </main>
    </div>
  );
}
