import { Outlet, useLocation } from 'react-router-dom';
import AdminSidebar from './AdminSidebar.jsx';

const pathTitles = {
  '/admin': 'Analytics',
  '/admin/events': 'Event Management',
  '/admin/media': 'Media Management',
  '/admin/users': 'User Management',
  '/admin/notifications': 'Notifications',
  '/admin/settings': 'Settings',
};

/**
 * Admin layout.
 *
 * The global PillNav (rendered in App.jsx) covers top-level navigation,
 * notifications, and the user menu, so admin pages no longer need their
 * own AdminTopBar. We keep AdminSidebar for in-section navigation and
 * surface the page title as a lightweight header inside the content area.
 *
 * Outer container fills the viewport minus the PillNav's 86px clearance
 * so the sidebar and content scroll independently.
 */
export default function AdminLayout() {
  const location = useLocation();
  const title = pathTitles[location.pathname] || 'Admin';

  return (
    <div className="flex bg-obsidian" style={{ height: 'calc(100vh - 86px)' }}>
      <AdminSidebar />
      <div className="flex-1 flex flex-col min-h-0">
        <div className="px-6 pt-5 pb-3 shrink-0 border-b border-graphite/40">
          <h2 className="text-[18px] font-semibold text-snow">{title}</h2>
        </div>
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
