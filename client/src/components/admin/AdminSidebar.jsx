import { useState, useEffect } from 'react';
import { NavLink, Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

const navItems = [
  {
    label: 'Analytics',
    path: '/admin',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10" />
        <line x1="12" y1="20" x2="12" y2="4" />
        <line x1="6" y1="20" x2="6" y2="14" />
      </svg>
    ),
  },
  {
    label: 'Events',
    path: '/admin/events',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    ),
  },
  {
    label: 'Media',
    path: '/admin/media',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
        <circle cx="8.5" cy="8.5" r="1.5" />
        <polyline points="21 15 16 10 5 21" />
      </svg>
    ),
  },
  {
    label: 'Users',
    path: '/admin/users',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    label: 'Notifications',
    path: '/admin/notifications',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
    ),
  },
  {
    label: 'AI Insights',
    path: '/admin/ai-insights',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
      </svg>
    ),
  },
  {
    label: 'Settings',
    path: '/admin/settings',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68 1.65 1.65 0 0 0 10 3.17V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    ),
  },
];

export default function AdminSidebar() {
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth < 768;
    }
    return false;
  });
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth < 768;
    }
    return false;
  });
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile) {
        setCollapsed(true);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const sidebarWidth = collapsed ? 64 : 240;

  // Mobile overlay sidebar
  if (isMobile) {
    return (
      <>
        {/* Mobile toggle button */}
        <button
          onClick={() => setMobileOpen(true)}
          className="fixed top-4 left-4 z-50 w-10 h-10 rounded-full bg-snow dark:bg-ink flex items-center justify-center text-ink dark:text-snow md:hidden"
          aria-label="Open sidebar"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>

        {/* Backdrop */}
        {mobileOpen && (
          <div
            className="fixed inset-0 bg-obsidian/50 z-40"
            onClick={() => setMobileOpen(false)}
          />
        )}

        {/* Sidebar overlay */}
        <motion.aside
          initial={{ x: -240 }}
          animate={{ x: mobileOpen ? 0 : -240 }}
          transition={{ duration: 0.25, ease: 'easeInOut' }}
          className="fixed top-0 left-0 h-screen w-[240px] bg-snow dark:bg-ink border-r border-fog dark:border-graphite z-40 flex flex-col"
        >
          <div className="h-16 flex items-center px-5">
            <Link to="/" className="flex items-center gap-2 no-underline">
              <img src="/antareslogo.svg" alt="Antares" className="h-6 w-6 shrink-0" />
              <span className="text-ink dark:text-snow font-bold text-[18px]">Antares</span>
            </Link>
          </div>
          <nav className="flex-1 px-3 py-2 flex flex-col gap-1">
            {navItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === '/admin'}
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-[14px] text-[14px] font-medium transition-colors ${
                    isActive ? 'bg-fog dark:bg-graphite text-ink dark:text-snow' : 'text-steel dark:text-ash hover:text-ink dark:hover:text-snow hover:bg-fog dark:hover:bg-graphite/50'
                  }`
                }
              >
                {item.icon}
                <span>{item.label}</span>
              </NavLink>
            ))}
          </nav>
        </motion.aside>
      </>
    );
  }

  // Desktop sidebar
  return (
    <motion.aside
      animate={{ width: sidebarWidth }}
      transition={{ duration: 0.25, ease: 'easeInOut' }}
      className="h-screen bg-snow dark:bg-ink border-r border-fog dark:border-graphite flex flex-col shrink-0 overflow-hidden"
    >
      <div className="h-16 flex items-center justify-center px-5">
        {!collapsed && (
          <Link to="/" className="flex items-center gap-2 whitespace-nowrap no-underline">
            <img src="/antareslogo.svg" alt="Antares" className="h-6 w-6 shrink-0" />
            <span className="text-ink dark:text-snow font-bold text-[18px]">Antares</span>
          </Link>
        )}
        {collapsed && (
          <Link to="/" className="no-underline">
            <img src="/antareslogo.svg" alt="Antares" className="h-6 w-6 shrink-0" />
          </Link>
        )}
      </div>

      <nav className="flex-1 px-2 py-2 flex flex-col gap-1">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/admin'}
            title={collapsed ? item.label : undefined}
            className={({ isActive }) =>
              `flex items-center ${collapsed ? 'justify-center px-2' : 'px-3 gap-3'} py-2.5 rounded-[14px] text-[14px] font-medium transition-colors ${
                isActive ? 'bg-fog dark:bg-graphite text-ink dark:text-snow' : 'text-steel dark:text-ash hover:text-ink dark:hover:text-snow hover:bg-fog dark:hover:bg-graphite/50'
              }`
            }
          >
            <span className="shrink-0 w-5 h-5 flex items-center justify-center">{item.icon}</span>
            {!collapsed && <span className="whitespace-nowrap">{item.label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* Collapse toggle */}
      <div className="p-3 border-t border-fog dark:border-graphite">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="w-full flex items-center justify-center py-2 rounded-[14px] text-steel dark:text-ash hover:text-ink dark:hover:text-snow hover:bg-fog dark:hover:bg-graphite/50 transition-colors"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ transform: collapsed ? 'rotate(180deg)' : 'none' }}
          >
            <polyline points="11 17 6 12 11 7" />
            <polyline points="18 17 13 12 18 7" />
          </svg>
        </button>
      </div>
    </motion.aside>
  );
}
