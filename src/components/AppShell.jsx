import { useEffect, useRef, useState } from 'react';
import { Bell, CalendarClock, CheckCircle2, ClipboardList, Info, LayoutDashboard, ListOrdered, LogOut, Menu, Settings2, Users, X } from 'lucide-react';
import { NavLink, useNavigate } from 'react-router-dom';
import Brand from './Brand.jsx';
import { clearSession } from '../auth.js';
import { clearNotifications, markAllRead, markRead, useNotifications } from '../notifications.js';
import { formatRelativeTime } from '../store.js';

const typeIcons = { status: CheckCircle2, service: Info, queue: Users };

function NotificationsMenu({ role }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const { notifications, unreadCount } = useNotifications(role);

  useEffect(() => {
    if (!open) return undefined;
    function handleClick(event) {
      if (!wrapRef.current?.contains(event.target)) setOpen(false);
    }
    function handleKey(event) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  return (
    <div className="notifications-wrap" ref={wrapRef}>
      <button className="icon-button notification-button" aria-label={unreadCount ? `Notifications, ${unreadCount} unread` : 'Notifications'} aria-expanded={open} onClick={() => setOpen(!open)}>
        <Bell size={20} />
        {unreadCount > 0 && <span className="notification-dot" aria-hidden="true" />}
      </button>
      {open && (
        <div className="notification-popover" role="dialog" aria-label="Notifications">
          <div className="notification-popover-head">
            <strong>Notifications{unreadCount > 0 && <span className="unread-count">{unreadCount}</span>}</strong>
            {notifications.length > 0 && <div className="notification-popover-actions">{unreadCount > 0 && <button type="button" className="link-button" onClick={() => markAllRead(role)}>Mark all read</button>}<button type="button" className="link-button muted" onClick={() => clearNotifications(role)}>Clear</button></div>}
          </div>
          {notifications.length ? (
            <ul className="notification-list">
              {notifications.slice(0, 8).map(item => {
                const Icon = typeIcons[item.type] || Users;
                return (
                  <li key={item.id} className={item.read ? '' : 'unread'}>
                    <button type="button" onClick={() => markRead(item.id)}>
                      <span className={`notification-type ${item.type}`}><Icon size={15} /></span>
                      <div><strong>{item.title}</strong><p>{item.message}</p><small>{formatRelativeTime(item.createdAt)}</small></div>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : <p className="notification-empty">You’re all caught up. Queue updates will appear here.</p>}
        </div>
      )}
    </div>
  );
}

const userItems = [
  { path: '/user/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/user/join', label: 'Join a queue', icon: Users },
  { path: '/user/status', label: 'Queue status', icon: CalendarClock },
  { path: '/user/settings', label: 'Account settings', icon: Settings2 },
  { path: '/user/history', label: 'History', icon: ClipboardList },
];

const adminItems = [
  { path: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/admin/services', label: 'Services', icon: Settings2 },
  { path: '/admin/queues', label: 'Manage queues', icon: ListOrdered },
];

export default function AppShell({ session, profile = session, children, title }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();
  const items = session.role === 'admin' ? adminItems : userItems;
  const accountEmail = profile.email || session.email;
  const initials = (profile.displayName || accountEmail).slice(0, 1).toUpperCase();

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
          <div className="sidebar-profile"><span className="avatar">{initials}</span><span><strong>{accountEmail}</strong><small>{session.role === 'admin' ? 'Administrator' : 'Member'}</small></span></div>
          <button className="nav-item signout" onClick={signOut}><LogOut size={19} strokeWidth={1.9} /><span>Sign out</span></button>
        </div>
      </aside>
      <div className="app-main">
        <header className="topbar">
          <div className="topbar-left"><button className="icon-button menu-button" aria-label="Open menu" onClick={() => setMenuOpen(true)}><Menu size={22} /></button><span className="topbar-title">{title}</span></div>
          <div className="topbar-actions">
            <span className="role-label">{session.role === 'admin' ? 'Admin view' : 'User view'}</span>
            <NotificationsMenu role={session.role} />
            <span className="avatar topbar-avatar">{initials}</span>
          </div>
        </header>
        <main className="content">{children}</main>
      </div>
    </div>
  );
}
