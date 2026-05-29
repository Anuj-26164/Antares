import { Outlet } from 'react-router-dom';
import AdminSidebar from './AdminSidebar.jsx';
import AdminTopBar from './AdminTopBar.jsx';

export default function AdminLayout() {
  return (
    <div className="flex h-screen bg-obsidian">
      <AdminSidebar />
      <div className="flex-1 flex flex-col min-h-0">
        <AdminTopBar />
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
