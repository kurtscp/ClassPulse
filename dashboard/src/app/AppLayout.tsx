import { Outlet } from 'react-router-dom';

export default function AppLayout() {
  return (
    <div className="min-h-screen bg-gray-100 text-gray-900">
      <header className="bg-white shadow p-4 font-bold text-xl">ClassPulse Dashboard</header>
      <main className="p-4">
        <Outlet />
      </main>
    </div>
  );
}
