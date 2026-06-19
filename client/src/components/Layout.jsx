import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useState, useRef, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import Timer from './Timer';

const navItems = [
  { path: '/', label: 'Dashboard', d: 'M3 11.5 12 4l9 7.5M5 10v10h14V10' },
  { path: '/leads', label: 'Leads', d: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 2v4M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM20 8v6M23 11h-6' },
  { path: '/calendar', label: 'Calendar', d: 'M3 5h18v16H3zM3 10h18M8 3v4M16 3v4' },
  { path: '/tasks', label: 'Tasks', d: 'M9 6h11M9 12h11M9 18h11' },
  { path: '/matters', label: 'Matters', d: 'M3 7h18v13H3zM8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2' },
  { path: '/contacts', label: 'Contacts', d: 'M12 8a3.4 3.4 0 1 0 0-6.8A3.4 3.4 0 0 0 12 8ZM5 20c0-3.5 3.1-6 7-6s7 2.5 7 6' },
  { path: '/activities', label: 'Notes', d: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z' },
  { path: '/documents', label: 'Documents', d: 'M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9zM13 2v7h7' },
  { path: '/billing', label: 'Billing', d: 'M3 6h18v13H3zM3 10h18M7 14h4' },
  { path: '/audit-log', label: 'Audit Log', d: 'M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2M9 5h6' },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const initials = user ? `${user.firstName?.[0] || ''}${user.lastName?.[0] || ''}`.toUpperCase() : '??';

  return (
    <div className="app">
      <header className="topbar">
        <button className="menu-toggle" onClick={() => setSidebarOpen(!sidebarOpen)} aria-label="Toggle menu">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="22" height="22">
            <path d="M3 12h18M3 6h18M3 18h18" strokeLinecap="round" />
          </svg>
        </button>
        <NavLink to="/" className="brand">
          <span className="brand-mark">
            <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.4" width="18" height="18">
              <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <span>Practice365</span>
        </NavLink>
        <div className="searchwrap">
          <svg className="search-icon-top" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15">
            <circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" strokeLinecap="round" />
          </svg>
          <input type="text" placeholder={`${user?.firstName || ''} ${user?.lastName || ''}'s Practice`} />
          <span className="kbd">⌘K</span>
        </div>
        <div className="topbar-right">
          <Timer />
          <button className="btn-create" onClick={() => navigate('/leads/intake')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" width="14" height="14">
              <path d="M12 5v14M5 12h14" strokeLinecap="round" />
            </svg>
            <span>Create new</span>
          </button>
          <button className="icon-btn" onClick={() => toast('No new notifications')} aria-label="Notifications">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="17" height="17">
              <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M13.7 21a2 2 0 0 1-3.4 0" strokeLinecap="round" />
            </svg>
            <span className="notif-dot" />
          </button>
        </div>
      </header>

      {sidebarOpen && <div className="sidebar-backdrop show" onClick={() => setSidebarOpen(false)} />}

      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <nav className="nav">
          {navItems.map(item => (
            <NavLink key={item.path} to={item.path} end={item.path === '/'}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              onClick={() => setSidebarOpen(false)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d={item.d} strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {item.label}
            </NavLink>
          ))}
          <div className="nav-divider" />
        </nav>
        <div className="sidebar-bottom">
          <div className="profile-row" onClick={() => { logout(); navigate('/login'); }}>
            <span className="avatar">{initials}</span>
            <span className="profile-text">
              <span className="profile-name">{user?.firstName} {user?.lastName}</span>
              <span className="profile-sub">{user?.role === 'attorney' ? 'Attorney' : 'Staff / Paralegal'}</span>
            </span>
          </div>
        </div>
      </aside>

      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
