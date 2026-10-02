import { useEffect, useState } from 'react';
import { ArrowRight, Check, CheckCircle2, Clock3, Eye, EyeOff, Info, MapPin, Plus, RefreshCw, Users } from 'lucide-react';
import { Link, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import AdminDashboardPage from './components/AdminDashboard.jsx';
import AdminQueuePage from './components/AdminQueue.jsx';
import AdminServicesPage from './components/AdminServices.jsx';
import AppShell from './components/AppShell.jsx';
import AccountSettings from './components/AccountSettings.jsx';
import Brand from './components/Brand.jsx';
import FormField from './components/FormField.jsx';
import { getSession, saveSession, validateAuth } from './auth.js';
import { advanceQueue, createQueueEntry, findService, getActiveQueue, mockServices, saveActiveQueue } from './queueData.js';
import { getUserProfile, subscribeToProfileUpdates } from './userProfile.js';

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
  '/user/join': { title: 'Join a queue', eyebrow: 'SERVICES', heading: 'Find a service', description: 'Choose an open service and join its queue in a few seconds.' },
  '/user/status': { title: 'Queue status', eyebrow: 'YOUR PLACE', heading: 'Queue status', description: 'Track your place in line and get a clear estimate of your wait.' },
  '/user/settings': { title: 'Account settings', eyebrow: 'YOUR ACCOUNT', heading: 'Account settings', description: 'Manage the profile details used in your QueueSmart demo.' },
  '/user/history': { title: 'History', eyebrow: 'PAST VISITS', heading: 'Queue history', description: 'Your previous queues will appear here.' },
  '/admin/dashboard': { title: 'Dashboard', eyebrow: 'ADMIN WORKSPACE', heading: 'Service overview', description: 'See activity across your organization at a glance.' },
  '/admin/services': { title: 'Services', eyebrow: 'ADMIN WORKSPACE', heading: 'Services', description: 'Create and manage the services your organization offers.' },
  '/admin/queues': { title: 'Manage queues', eyebrow: 'ADMIN WORKSPACE', heading: 'Queue management', description: 'Manage visitors and keep each service moving.' },
};

function UserDashboard({ queue, onJoin }) {
  const service = queue?.status !== 'served' && queue ? findService(queue.serviceId) : null;
  const waitMinutes = service && queue.status !== 'served' ? Math.max(0, queue.position - 1) * service.averageMinutes : 0;
  const statusLabel = queue?.status === 'served' ? 'Served' : queue?.status === 'almost-ready' ? 'Almost Ready' : 'Waiting';

  return (
    <>
      <div className="overview-grid">
        <div className="overview-panel"><div className="panel-icon teal"><Users size={21} /></div><span>Available services</span><strong>{mockServices.length}</strong><p>Services accepting demo queue entries.</p></div>
        <div className="overview-panel"><div className="panel-icon coral"><Clock3 size={21} /></div><span>People waiting</span><strong>{mockServices.reduce((total, item) => total + item.waiting, 0)}</strong><p>Across all available services.</p></div>
        <div className="overview-panel"><div className="panel-icon blue"><Info size={21} /></div><span>Average wait</span><strong>{Math.round(mockServices.reduce((total, item) => total + item.waiting * item.averageMinutes, 0) / mockServices.length)} min</strong><p>Based on the current sample queues.</p></div>
      </div>
      {service ? (
        <section className="current-queue-card">
          <div className="current-queue-copy"><p className="eyebrow">YOUR CURRENT QUEUE</p><h2>{service.name}</h2><p><MapPin size={15} />{service.location}</p></div>
          <div className="current-queue-position"><span>{queue.status === 'served' ? 'Queue status' : 'Your position'}</span><strong>{queue.status === 'served' ? <CheckCircle2 size={30} /> : `#${queue.position}`}</strong><small>{statusLabel}{queue.status !== 'served' ? ` · about ${waitMinutes} min` : ''}</small></div>
          <Link className="primary-button" to="/user/status">View queue status<ArrowRight size={17} /></Link>
        </section>
      ) : (
        <section className="empty-state"><div className="empty-icon"><Users size={26} /></div><h2>You’re not in a queue yet</h2><p>Choose an available service to save your place in line.</p><Link className="primary-button" to="/user/join">Join a queue<ArrowRight size={17} /></Link></section>
      )}
      <div className="section-heading"><div><p className="eyebrow">AVAILABLE NOW</p><h2>Popular services</h2></div><Link to="/user/join">See all services<ArrowRight size={16} /></Link></div>
      <div className="service-preview-grid">
        {mockServices.slice(0, 2).map(item => {
          const activeQueue = queue?.status !== 'served' ? queue : null;
          const alreadyJoined = activeQueue?.serviceId === item.id;
          const isClosed = item.isOpen === false;
          return <article className="service-preview" key={item.id}><span className="service-category">{item.category}</span><h3>{item.name}</h3><p><MapPin size={14} />{item.location}</p><span className="service-wait"><Clock3 size={14} />{item.waiting} {item.waiting === 1 ? 'person' : 'people'} waiting</span><button className={`service-preview-action ${alreadyJoined ? 'joined' : ''}`} onClick={() => !activeQueue && !isClosed && onJoin(item)} disabled={Boolean(activeQueue) || isClosed}>{alreadyJoined ? <><Check size={15} />In your queue</> : isClosed ? 'Closed' : activeQueue ? 'Leave current queue to join' : <>Join queue<ArrowRight size={15} /></>}</button></article>;
        })}
      </div>
    </>
  );
}

function JoinQueuePage({ queue, onJoin, onLeave }) {
  return (
    <div className="service-list">
      {mockServices.map(service => {
        const activeQueue = queue?.status !== 'served' ? queue : null;
        const alreadyJoined = activeQueue?.serviceId === service.id;
        const isClosed = service.isOpen === false;
        return (
          <article className="service-card" key={service.id}>
            <div className="service-card-main"><span className="service-category">{service.category}</span><h2>{service.name}</h2><p><MapPin size={15} />{service.location}</p><div className="service-meta"><span><Users size={15} />{service.waiting} {service.waiting === 1 ? 'person' : 'people'} waiting</span><span><Clock3 size={15} />~{service.waiting * service.averageMinutes} min wait</span></div></div>
            <div className="service-card-action"><span className={`open-status ${isClosed ? 'closed' : ''}`}><span />{isClosed ? 'Closed for now' : `Open until ${service.openUntil}`}</span>{alreadyJoined ? <div className="queue-card-actions"><button className="primary-button" disabled><Check size={17} />In your queue</button><button className="text-button" onClick={onLeave}>Leave queue</button></div> : <button className="primary-button" onClick={() => !isClosed && onJoin(service)} disabled={Boolean(activeQueue) || isClosed}>{isClosed ? 'Closed' : activeQueue ? 'Leave current queue to join' : 'Join queue'}{!activeQueue && !isClosed && <ArrowRight size={17} />}</button>}</div>
          </article>
        );
      })}
      {queue && queue.status !== 'served' && <p className="queue-notice"><Info size={16} />You can join one queue at a time. Leave your current queue before joining another.</p>}
    </div>
  );
}

function QueueStatusPage({ queue, onAdvance, onLeave, onStartAnother, joinMessage }) {
  const service = queue && findService(queue.serviceId);
  if (!queue || !service) return <div className="empty-state"><div className="empty-icon"><Users size={26} /></div><h2>You’re not in a queue yet</h2><p>Choose an available service and join its queue to see your place here.</p><Link className="primary-button" to="/user/join">Find a service<ArrowRight size={17} /></Link></div>;

  const isServed = queue.status === 'served';
  const statusLabel = isServed ? 'Served' : queue.status === 'almost-ready' ? 'Almost Ready' : 'Waiting';
  const progress = isServed ? 100 : Math.round(((queue.initialPosition - queue.position) / queue.initialPosition) * 100);
  const waitMinutes = Math.max(0, queue.position - 1) * service.averageMinutes;

  return (
    <>
    {joinMessage && <div className="queue-success-message" role="status"><CheckCircle2 size={17} />{joinMessage}</div>}
    <section className="queue-status-card">
      <div className="queue-status-top"><div><span className={`queue-status-badge ${queue.status}`}><span />{statusLabel}</span><h2>{service.name}</h2><p><MapPin size={15} />{service.location}</p></div><div className="queue-ticket"><span>QUEUE TICKET</span><strong>QS-{service.id.replace(/[^a-z0-9]/gi, '').slice(0, 3).toUpperCase()}-{queue.initialPosition.toString().padStart(2, '0')}</strong></div></div>
      <div className="queue-status-stats"><div><span>Your position</span><strong>{isServed ? 'Served' : `#${queue.position}`}</strong></div><div><span>Estimated wait</span><strong>{isServed ? '0 min' : `~${waitMinutes} min`}</strong></div><div><span>People ahead</span><strong>{isServed ? '0' : Math.max(0, queue.position - 1)}</strong></div></div>
      <div className="queue-progress-heading"><span>Queue progress</span><span>{isServed ? 'Complete' : `${Math.round(progress)}%`}</span></div><div className="queue-progress"><span style={{ width: `${progress}%` }} /></div>
      <div className={`queue-status-note ${isServed ? 'served-note' : ''}`}><Info size={17} /><p>{isServed ? 'You’ve been served. This demo queue is complete.' : 'This queue uses sample data. Use “Simulate next update” to preview how your position changes.'}</p></div>
      <div className="queue-status-actions">{isServed ? <><Link className="primary-button" to="/user/dashboard">Back to dashboard<ArrowRight size={16} /></Link><button className="text-button" onClick={onStartAnother}>Join another queue</button></> : <><button className="primary-button" onClick={onAdvance}><RefreshCw size={16} />Simulate next update</button><button className="text-button" onClick={onLeave}>Leave queue</button></>}</div>
    </section>
    </>
  );
}

function WorkspacePage({ session }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [queue, setQueue] = useState(() => getActiveQueue());
  const [profile, setProfile] = useState(() => getUserProfile(session.email));
  const [adminServices, setAdminServices] = useState(() => mockServices.map(service => ({ ...service })));
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false);
  const [joinMessage, setJoinMessage] = useState('');
  useEffect(() => saveActiveQueue(queue), [queue]);
  useEffect(() => subscribeToProfileUpdates(() => setProfile(getUserProfile(session.email))), [session.email]);
  useEffect(() => {
    if (location.pathname !== '/user/status') setJoinMessage('');
  }, [location.pathname]);
  useEffect(() => {
    mockServices.splice(0, mockServices.length, ...adminServices.map(service => ({ ...service })));
  }, [adminServices]);
  const page = pageContent[location.pathname];
  if (!page || !location.pathname.startsWith(`/${session.role}/`)) return <Navigate to={`/${session.role}/dashboard`} replace />;
  const dashboard = location.pathname.endsWith('/dashboard');
  const userPage = session.role === 'user';

  function joinQueue(service) {
    const entry = createQueueEntry(service);
    setQueue(entry);
    setJoinMessage(`You’ve joined ${service.name}.`);
    navigate('/user/status');
  }

  function advanceQueuePosition() {
    const next = advanceQueue(queue);
    if (!next || next.position === queue?.position) return;
    setQueue(next);
  }

  function confirmLeaveQueue() {
    setQueue(null);
    setLeaveConfirmOpen(false);
    setJoinMessage('');
  }

  function startAnotherQueue() {
    setQueue(null);
    setJoinMessage('');
    navigate('/user/join');
  }

  function saveAdminService(serviceData) {
    setAdminServices(current => {
      const existing = current.findIndex(item => item.id === serviceData.id);
      if (existing >= 0) {
        const next = [...current];
        next[existing] = { ...serviceData };
        return next;
      }
      return [...current, { ...serviceData }];
    });
  }

  function toggleAdminService(serviceId) {
    setAdminServices(current => current.map(service => service.id === serviceId ? { ...service, isOpen: service.isOpen === false } : service));
  }

  function deleteAdminService(serviceId) {
    setAdminServices(current => current.filter(service => service.id !== serviceId));
  }

  return (
    <AppShell session={session} profile={profile} title={page.title}>
      <div className="page-heading"><p className="eyebrow">{page.eyebrow}</p><h1>{userPage && dashboard ? `Good to see you, ${profile.displayName}` : page.heading}</h1><p>{page.description}</p></div>
      {userPage && dashboard ? <UserDashboard queue={queue} onJoin={joinQueue} /> : null}
      {userPage && location.pathname === '/user/join' ? <JoinQueuePage queue={queue} onJoin={joinQueue} onLeave={() => setLeaveConfirmOpen(true)} /> : null}
      {userPage && location.pathname === '/user/status' ? <QueueStatusPage queue={queue} onAdvance={advanceQueuePosition} onLeave={() => setLeaveConfirmOpen(true)} onStartAnother={startAnotherQueue} joinMessage={joinMessage} /> : null}
      {userPage && location.pathname === '/user/settings' ? <AccountSettings email={session.email} /> : null}
      {userPage && leaveConfirmOpen && <div className="confirm-overlay"><section className="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="leave-confirm-title"><h2 id="leave-confirm-title">Leave this queue?</h2><p>Your current place will be removed from this demo queue. You can join another service afterward.</p><div><button type="button" className="text-button" onClick={() => setLeaveConfirmOpen(false)}>Keep my place</button><button type="button" className="primary-button confirm-leave-button" onClick={confirmLeaveQueue}>Leave queue</button></div></section></div>}
      {!userPage && dashboard ? <AdminDashboardPage services={adminServices} /> : null}
      {!userPage && location.pathname === '/admin/services' ? <AdminServicesPage services={adminServices} onSaveService={saveAdminService} onToggleService={toggleAdminService} onDeleteService={deleteAdminService} /> : null}
      {!userPage && location.pathname === '/admin/queues' ? <AdminQueuePage services={adminServices} onToggleService={toggleAdminService} /> : null}
      {!userPage && !dashboard && location.pathname !== '/admin/services' && location.pathname !== '/admin/queues' ? (
        <div className="empty-state"><div className="empty-icon">{location.pathname.includes('services') ? <Plus size={26} /> : <Users size={26} />}</div><h2>{page.heading}</h2><p>{page.description}</p></div>
      ) : null}
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
