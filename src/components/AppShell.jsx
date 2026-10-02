import { useState } from 'react';
import { Bell, CalendarClock, ClipboardList, LayoutDashboard, LogOut, Menu, Settings2, Users, X } from 'lucide-react';
import { NavLink, useNavigate } from 'react-router-dom';
import Brand from './Brand.jsx';
import { clearSession } from '../auth.js';

const userItems = [
  { path: '/user/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/user/join', label: 'Join a queue', icon: Users },
  { path: '/user/status', label: 'Queue status', icon: CalendarClock },
  { path: '/user/history', label: 'History', icon: ClipboardList },
];

const adminItems = [
  { path: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/admin/services', label: 'Services', icon: Settings2 },
  { path: '/admin/queues', label: 'Manage queues', icon: Users },
];

export default function AppShell({ session, children, title }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const navigate = useNavigate();
  const items = session.role === 'admin' ? adminItems : userItems;
  const initials = session.email.slice(0, 1).toUpperCase();

  function signOut() {
    clearSession();
    navigate('/login', { replace: true });
  }

  return (
    <div className="app-layout">
      {menuOpen && <button className="mobile-scrim" aria-label="Close menu" onClick={() => setMenuOpen(false)} />}
      <aside className={`sidebar ${menuOpen ? 'sidebar-open' : ''}`}>
        <div className="sidebar-top">
          <Brand light />
          <button className="icon-button sidebar-close" aria-label="Close menu" onClick={() => setMenuOpen(false)}><X size={20} /></button>
        </div>
        <div className="workspace-picker">
          <span className="workspace-icon">Q</span>
          <span><strong>QueueSmart</strong><small>{session.role === 'admin' ? 'Administrator workspace' : 'Personal workspace'}</small></span>
        </div>
        <div className="nav-caption">WORKSPACE</div>
        <nav className="side-nav" aria-label="Main navigation">
          {items.map(({ path, label, icon: Icon }) => (
            <NavLink key={path} to={path} onClick={() => setMenuOpen(false)} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <Icon size={19} strokeWidth={1.9} /><span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-profile"><span className="avatar">{initials}</span><span><strong>{session.email}</strong><small>{session.role === 'admin' ? 'Administrator' : 'Member'}</small></span></div>
          <button className="nav-item signout" onClick={signOut}><LogOut size={19} strokeWidth={1.9} /><span>Sign out</span></button>
        </div>
      </aside>
      <div className="app-main">
        <header className="topbar">
          <div className="topbar-left"><button className="icon-button menu-button" aria-label="Open menu" onClick={() => setMenuOpen(true)}><Menu size={22} /></button><span className="topbar-title">{title}</span></div>
          <div className="topbar-actions">
            <span className="role-label">{session.role === 'admin' ? 'Admin view' : 'User view'}</span>
            <div className="notifications-wrap">
              <button className="icon-button notification-button" aria-label="Notifications" aria-expanded={notificationsOpen} onClick={() => setNotificationsOpen(!notificationsOpen)}><Bell size={20} /></button>
              {notificationsOpen && <div className="notification-popover"><strong>Notifications</strong><p>Queue updates will appear here.</p></div>}
            </div>
            <span className="avatar topbar-avatar">{initials}</span>
          </div>
        </header>
        <main className="content">{children}</main>
      </div>
    </div>
  );
}
