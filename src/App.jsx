import { useState } from 'react';
import { ArrowRight, Check, Clock3, Eye, EyeOff, Info, Plus, Users } from 'lucide-react';
import { Link, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import AppShell from './components/AppShell.jsx';
import Brand from './components/Brand.jsx';
import FormField from './components/FormField.jsx';
import { getSession, saveSession, validateAuth } from './auth.js';

function AuthPage({ isRegister }) {
  const navigate = useNavigate();
  const [values, setValues] = useState({ email: '', password: '', confirmPassword: '', role: 'user' });
  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const session = getSession();
  if (session) return <Navigate to={`/${session.role}/dashboard`} replace />;

  function change(event) {
    const { name, value } = event.target;
    setValues(current => ({ ...current, [name]: value }));
    if (errors[name]) setErrors(current => ({ ...current, [name]: undefined }));
  }

  function submit(event) {
    event.preventDefault();
    const nextErrors = validateAuth(values, isRegister);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    saveSession(values.email.trim().toLowerCase(), values.role);
    navigate(`/${values.role}/dashboard`, { replace: true });
  }

  return (
    <div className="auth-layout">
      <div className="auth-main">
        <div className="auth-inner">
          <Brand />
          <div className="auth-content">
            <p className="eyebrow">{isRegister ? 'GET STARTED' : 'WELCOME BACK'}</p>
            <h1 className={isRegister ? '' : 'auth-title-only'}>{isRegister ? 'Create your account' : 'Sign in to QueueSmart'}</h1>
            {isRegister && <p className="auth-subtitle">A simpler way to keep your place in line.</p>}
            <form onSubmit={submit} noValidate>
              <div className="role-picker-label">Continue as</div>
              <div className="role-picker" role="group" aria-label="Account type">
                <button type="button" className={values.role === 'user' ? 'selected' : ''} onClick={() => setValues(current => ({ ...current, role: 'user' }))}>User</button>
                <button type="button" className={values.role === 'admin' ? 'selected' : ''} onClick={() => setValues(current => ({ ...current, role: 'admin' }))}>Administrator</button>
              </div>
              <FormField label="Email address" id="email" name="email" type="email" placeholder="you@example.com" autoComplete="email" maxLength={254} value={values.email} onChange={change} error={errors.email} required />
              <div className="password-field">
                <FormField label="Password" id="password" name="password" type={showPassword ? 'text' : 'password'} placeholder={isRegister ? 'At least 8 characters' : 'Enter your password'} autoComplete={isRegister ? 'new-password' : 'current-password'} maxLength={128} value={values.password} onChange={change} error={errors.password} required />
                <button type="button" className="password-toggle" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button>
              </div>
              {isRegister && <FormField label="Confirm password" id="confirmPassword" name="confirmPassword" type="password" placeholder="Re-enter your password" autoComplete="new-password" maxLength={128} value={values.confirmPassword} onChange={change} error={errors.confirmPassword} required />}
              <button type="submit" className="primary-button auth-submit">{isRegister ? 'Create account' : 'Sign in'}<ArrowRight size={18} /></button>
            </form>
            <p className="auth-switch">{isRegister ? 'Already have an account?' : 'New to QueueSmart?'} <Link to={isRegister ? '/login' : '/register'}>{isRegister ? 'Sign in' : 'Create an account'}</Link></p>
          </div>
        </div>
      </div>
      <aside className="auth-aside" aria-hidden="true">
        <div className="aside-content">
          <h2>Less waiting.<br />More living.</h2>
          <p>Stay informed from the moment you join a queue to the moment it is your turn.</p>
          <div className="queue-visual">
            <div className="visual-heading"><span>Current queue</span><span className="live-badge"><span /> LIVE</span></div>
            <div className="visual-service"><span className="visual-service-icon"><Users size={21} /></span><span><strong>Student Services</strong><small>Campus Center</small></span></div>
            <div className="visual-divider" />
            <div className="visual-stats"><span><small>Your position</small><strong>03 <span>in line</span></strong></span><span><small>Estimated wait</small><strong>12 <span>min</span></strong></span></div>
            <div className="visual-progress"><span /></div>
            <div className="visual-update"><Check size={15} /> Your place is confirmed</div>
          </div>
          <div className="aside-decoration"><span>01</span><span>02</span><span>03</span></div>
        </div>
      </aside>
    </div>
  );
}

const pageContent = {
  '/user/dashboard': { title: 'Dashboard', eyebrow: 'YOUR WORKSPACE', heading: 'Good to see you', description: 'Keep track of your queues and find the services you need.' },
  '/user/join': { title: 'Join a queue', eyebrow: 'SERVICES', heading: 'Find a service', description: 'Available organizations and services will appear here.' },
  '/user/status': { title: 'Queue status', eyebrow: 'YOUR PLACE', heading: 'Queue status', description: 'Your current position and wait time will appear here.' },
  '/user/history': { title: 'History', eyebrow: 'PAST VISITS', heading: 'Queue history', description: 'Your previous queues will appear here.' },
  '/admin/dashboard': { title: 'Dashboard', eyebrow: 'ADMIN WORKSPACE', heading: 'Service overview', description: 'See activity across your organization at a glance.' },
  '/admin/services': { title: 'Services', eyebrow: 'ADMIN WORKSPACE', heading: 'Services', description: 'Create and manage the services your organization offers.' },
  '/admin/queues': { title: 'Manage queues', eyebrow: 'ADMIN WORKSPACE', heading: 'Queue management', description: 'Manage visitors and keep each service moving.' },
};

function WorkspacePage({ session }) {
  const location = useLocation();
  const page = pageContent[location.pathname];
  if (!page || !location.pathname.startsWith(`/${session.role}/`)) return <Navigate to={`/${session.role}/dashboard`} replace />;
  const dashboard = location.pathname.endsWith('/dashboard');
  return (
    <AppShell session={session} title={page.title}>
      <div className="page-heading"><p className="eyebrow">{page.eyebrow}</p><h1>{page.heading}</h1><p>{page.description}</p></div>
      {dashboard ? (
        <div className="overview-grid">
          <div className="overview-panel"><div className="panel-icon teal"><Users size={21} /></div><span>{session.role === 'admin' ? 'Active queues' : 'Your active queues'}</span><strong>0</strong><p>{session.role === 'admin' ? 'Queues will appear as services open.' : 'Join a service to get started.'}</p></div>
          <div className="overview-panel"><div className="panel-icon coral"><Clock3 size={21} /></div><span>{session.role === 'admin' ? 'Services' : 'Estimated wait'}</span><strong>{session.role === 'admin' ? '0' : '--'}</strong><p>{session.role === 'admin' ? 'Manage services from the sidebar.' : 'Wait times appear after joining.'}</p></div>
          <div className="overview-panel"><div className="panel-icon blue"><Info size={21} /></div><span>Notifications</span><strong>0</strong><p>Updates will show here.</p></div>
        </div>
      ) : (
        <div className="empty-state"><div className="empty-icon">{location.pathname.includes('services') ? <Plus size={26} /> : <Users size={26} />}</div><h2>{page.heading}</h2><p>{page.description}</p></div>
      )}
    </AppShell>
  );
}

export default function App() {
  useLocation();
  const session = getSession();
  return (
    <Routes>
      <Route path="/login" element={<AuthPage key="login" isRegister={false} />} />
      <Route path="/register" element={<AuthPage key="register" isRegister />} />
      <Route path="/user/*" element={session ? <WorkspacePage session={session} /> : <Navigate to="/login" replace />} />
      <Route path="/admin/*" element={session ? <WorkspacePage session={session} /> : <Navigate to="/login" replace />} />
      <Route path="*" element={<Navigate to={session ? `/${session.role}/dashboard` : '/login'} replace />} />
    </Routes>
  );
}
