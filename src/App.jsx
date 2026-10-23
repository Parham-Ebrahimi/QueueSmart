import { useEffect, useRef, useState } from 'react';
import { AlertCircle, ArrowRight, Bell, Check, CheckCircle2, Clock3, Eye, EyeOff, Info, MapPin, RefreshCw, Timer, Users } from 'lucide-react';
import { Link, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import AdminDashboardPage from './components/AdminDashboard.jsx';
import AdminQueuePage from './components/AdminQueue.jsx';
import AdminServicesPage from './components/AdminServices.jsx';
import AppShell from './components/AppShell.jsx';
import AccountSettings from './components/AccountSettings.jsx';
import Brand from './components/Brand.jsx';
import FormField from './components/FormField.jsx';
import HistoryPage from './components/History.jsx';
import { createService as createServiceApi, deleteService as deleteServiceApi, getQueueEntry, joinQueue as joinQueueApi, leaveQueue as leaveQueueApi, listQueues, listServices as listServicesApi, loginAccount, moveQueueEntry, registerAccount, removeQueueEntry, serveNextInQueue, updateService as updateServiceApi } from './api.js';
import { getSession, saveSession, validateAuth } from './auth.js';
import { addNotification, markAllRead, useNotifications } from './notifications.js';
import { applyQueueViews, createServiceId, findService, getActiveQueue, loadServices, queueWaitMinutes, resolveQueue, saveActiveQueue, saveServices, waitingCount } from './queueData.js';
import { formatClock, formatRelativeTime } from './store.js';
import { getUserProfile, subscribeToProfileUpdates } from './userProfile.js';

function AuthPage({ isRegister }) {
  const navigate = useNavigate();
  const [values, setValues] = useState({ email: '', password: '', confirmPassword: '', role: 'user' });
  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const session = getSession();
  if (session) return <Navigate to={`/${session.role}/dashboard`} replace />;

  function change(event) {
    const { name, value } = event.target;
    setValues(current => ({ ...current, [name]: value }));
    setFormError('');
    if (errors[name]) setErrors(current => ({ ...current, [name]: undefined }));
  }

  function chooseRole(role) {
    setValues(current => ({ ...current, role }));
    setFormError('');
  }

  async function submit(event) {
    event.preventDefault();
    if (submitting) return;
    const nextErrors = validateAuth(values, isRegister);
    setErrors(nextErrors);
    setFormError('');
    if (Object.keys(nextErrors).length) return;

    setSubmitting(true);
    try {
      const saved = saveSession(await (isRegister ? registerAccount(values) : loginAccount(values)));
      navigate(`/${saved.role}/dashboard`, { replace: true });
    } catch (error) {
      // Field errors from the server show under their inputs; anything else shows above the form.
      const { role: roleError, ...fieldErrors } = error.details || {};
      setErrors(fieldErrors);
      if (roleError || !Object.keys(fieldErrors).length) setFormError(roleError || error.message);
      setSubmitting(false);
    }
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
              {formError && <div className="auth-alert" role="alert"><AlertCircle size={17} />{formError}</div>}
              <div className="role-picker-label">Continue as</div>
              <div className="role-picker" role="group" aria-label="Account type">
                <button type="button" className={values.role === 'user' ? 'selected' : ''} onClick={() => chooseRole('user')}>User</button>
                <button type="button" className={values.role === 'admin' ? 'selected' : ''} onClick={() => chooseRole('admin')}>Administrator</button>
              </div>
              <FormField label="Email address" id="email" name="email" type="email" placeholder="you@example.com" autoComplete="email" maxLength={254} value={values.email} onChange={change} error={errors.email} required />
              <div className="password-field">
                <FormField label="Password" id="password" name="password" type={showPassword ? 'text' : 'password'} placeholder={isRegister ? 'At least 8 characters' : 'Enter your password'} autoComplete={isRegister ? 'new-password' : 'current-password'} maxLength={128} value={values.password} onChange={change} error={errors.password} required />
                <button type="button" className="password-toggle" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button>
              </div>
              {isRegister && <FormField label="Confirm password" id="confirmPassword" name="confirmPassword" type="password" placeholder="Re-enter your password" autoComplete="new-password" maxLength={128} value={values.confirmPassword} onChange={change} error={errors.confirmPassword} required />}
              <button type="submit" className="primary-button auth-submit" disabled={submitting}>{submitting ? (isRegister ? 'Creating account…' : 'Signing in…') : <>{isRegister ? 'Create account' : 'Sign in'}<ArrowRight size={18} /></>}</button>
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
  '/user/history': { title: 'History', eyebrow: 'PAST VISITS', heading: 'Queue history', description: 'Every queue you have joined, with the date, service, and outcome.' },
  '/admin/dashboard': { title: 'Dashboard', eyebrow: 'ADMIN WORKSPACE', heading: 'Service overview', description: 'See activity across your organization at a glance.' },
  '/admin/services': { title: 'Services', eyebrow: 'ADMIN WORKSPACE', heading: 'Services', description: 'Create and manage the services your organization offers.' },
  '/admin/queues': { title: 'Manage queues', eyebrow: 'ADMIN WORKSPACE', heading: 'Queue management', description: 'Manage visitors and keep each service moving.' },
};

const statusLabels = { waiting: 'Waiting', 'almost-ready': 'Almost Ready', served: 'Served', removed: 'Removed' };

function UserDashboard({ services, queue, onJoin, notifications, unreadCount, onMarkAllRead }) {
  const active = queue && (queue.status === 'waiting' || queue.status === 'almost-ready') ? queue : null;
  const service = queue?.service || null;
  const openServices = services.filter(item => item.isOpen);
  const totalWaiting = services.reduce((total, item) => total + waitingCount(item), 0);
  const averageWait = openServices.length ? Math.round(openServices.reduce((total, item) => total + queueWaitMinutes(item), 0) / openServices.length) : 0;
  const recent = notifications.slice(0, 4);

  return (
    <>
      <div className="overview-grid">
        <div className="overview-panel"><div className="panel-icon teal"><Users size={21} /></div><span>Open services</span><strong>{openServices.length}</strong><p>Services accepting queue entries right now.</p></div>
        <div className="overview-panel"><div className="panel-icon coral"><Clock3 size={21} /></div><span>People waiting</span><strong>{totalWaiting}</strong><p>Across all available services.</p></div>
        <div className="overview-panel"><div className="panel-icon blue"><Bell size={21} /></div><span>Unread notifications</span><strong>{unreadCount}</strong><p>{averageWait ? `Average wait is about ${averageWait} min.` : 'No queues are waiting right now.'}</p></div>
      </div>
      {service && queue.status !== 'removed' ? (
        <section className="current-queue-card">
          <div className="current-queue-copy"><p className="eyebrow">YOUR CURRENT QUEUE</p><h2>{service.name}</h2><p><MapPin size={15} />{service.location}</p></div>
          <div className="current-queue-position"><span>{queue.status === 'served' ? 'Queue status' : 'Your position'}</span><strong>{queue.status === 'served' ? <CheckCircle2 size={30} /> : `#${queue.position}`}</strong><small>{statusLabels[queue.status]}{active ? ` · about ${queue.waitMinutes} min` : ''}</small></div>
          <Link className="primary-button" to="/user/status">View queue status<ArrowRight size={17} /></Link>
        </section>
      ) : (
        <section className="empty-state"><div className="empty-icon"><Users size={26} /></div><h2>You’re not in a queue yet</h2><p>Choose an available service to save your place in line.</p><Link className="primary-button" to="/user/join">Join a queue<ArrowRight size={17} /></Link></section>
      )}
      <div className="dashboard-columns">
        <div>
          <div className="section-heading"><div><p className="eyebrow">AVAILABLE NOW</p><h2>Active services</h2></div><Link to="/user/join">See all services<ArrowRight size={16} /></Link></div>
          <div className="service-preview-grid">
            {services.slice(0, 4).map(item => {
              const alreadyJoined = active?.serviceId === item.id;
              const isClosed = !item.isOpen;
              return <article className="service-preview" key={item.id}><span className="service-category">{item.category}</span><h3>{item.name}</h3><p><MapPin size={14} />{item.location}</p><span className="service-wait"><Clock3 size={14} />{waitingCount(item)} {waitingCount(item) === 1 ? 'person' : 'people'} waiting · ~{queueWaitMinutes(item)} min</span><button className={`service-preview-action ${alreadyJoined ? 'joined' : ''}`} onClick={() => !active && !isClosed && onJoin(item)} disabled={Boolean(active) || isClosed}>{alreadyJoined ? <><Check size={15} />In your queue</> : isClosed ? 'Closed' : active ? 'Leave current queue to join' : <>Join queue<ArrowRight size={15} /></>}</button></article>;
            })}
          </div>
        </div>
        <aside className="notification-summary">
          <div className="section-heading"><div><p className="eyebrow">NOTIFICATIONS</p><h2>Recent updates</h2></div>{unreadCount > 0 && <button type="button" className="link-button" onClick={onMarkAllRead}>Mark all read</button>}</div>
          {recent.length ? (
            <ul className="notification-list compact">
              {recent.map(item => <li key={item.id} className={item.read ? '' : 'unread'}><span className={`notification-type ${item.type}`}>{item.type === 'status' ? <CheckCircle2 size={15} /> : item.type === 'service' ? <Info size={15} /> : <Users size={15} />}</span><div><strong>{item.title}</strong><p>{item.message}</p><small>{formatRelativeTime(item.createdAt)}</small></div></li>)}
            </ul>
          ) : <p className="notification-empty">You’re all caught up. Queue updates will appear here.</p>}
        </aside>
      </div>
    </>
  );
}

function JoinQueuePage({ services, queue, onJoin, onLeave }) {
  const active = queue && (queue.status === 'waiting' || queue.status === 'almost-ready') ? queue : null;
  if (!services.length) {
    return <div className="empty-state"><div className="empty-icon"><Users size={26} /></div><h2>No services available</h2><p>Services will appear here when an administrator adds them.</p></div>;
  }
  return (
    <div className="service-list">
      {services.map(service => {
        const alreadyJoined = active?.serviceId === service.id;
        const isClosed = !service.isOpen;
        const waiting = waitingCount(service);
        return (
          <article className="service-card" key={service.id}>
            <div className="service-card-main"><div className="service-tags"><span className="service-category">{service.category}</span><span className={`priority-pill ${service.priority}`}>{service.priority} priority</span></div><h2>{service.name}</h2><p><MapPin size={15} />{service.location}</p><p className="service-description">{service.description}</p><div className="service-meta"><span><Users size={15} />{waiting} {waiting === 1 ? 'person' : 'people'} waiting</span><span><Clock3 size={15} />~{queueWaitMinutes(service)} min wait</span><span><Timer size={15} />{service.averageMinutes} min per visit</span></div></div>
            <div className="service-card-action"><span className={`open-status ${isClosed ? 'closed' : ''}`}><span />{isClosed ? 'Closed for now' : `Open until ${service.openUntil}`}</span>{alreadyJoined ? <div className="queue-card-actions"><button className="primary-button" disabled><Check size={17} />In your queue</button><button className="text-button danger" onClick={onLeave}>Leave queue</button></div> : <button className="primary-button" onClick={() => !isClosed && onJoin(service)} disabled={Boolean(active) || isClosed}>{isClosed ? 'Closed' : active ? 'Leave current queue to join' : 'Join queue'}{!active && !isClosed && <ArrowRight size={17} />}</button>}</div>
          </article>
        );
      })}
      {active && <p className="queue-notice"><Info size={16} />You can join one queue at a time. Leave your current queue before joining another.</p>}
    </div>
  );
}

function QueueStatusPage({ queue, onRefresh, onLeave, onStartAnother, joinMessage }) {
  if (!queue) return <div className="empty-state"><div className="empty-icon"><Users size={26} /></div><h2>You’re not in a queue yet</h2><p>Choose an available service and join its queue to see your place here.</p><Link className="primary-button" to="/user/join">Find a service<ArrowRight size={17} /></Link></div>;

  const { service } = queue;
  const isServed = queue.status === 'served';
  const isRemoved = queue.status === 'removed';
  const finished = isServed || isRemoved;
  const progress = finished ? 100 : Math.round(((queue.initialPosition - queue.position) / queue.initialPosition) * 100);
  const ticket = `QS-${service.id.replace(/[^a-z0-9]/gi, '').slice(0, 3).toUpperCase()}-${queue.initialPosition.toString().padStart(2, '0')}`;
  const note = isServed
    ? 'You’ve been served. Thanks for using QueueSmart — this visit has been added to your history.'
    : isRemoved
      ? 'An administrator removed you from this queue. You can join another service at any time.'
      : queue.status === 'almost-ready'
        ? 'Almost your turn. Please head to the service location now so you are ready when called.'
        : 'Your position updates automatically every few seconds as people ahead of you are served.';

  return (
    <>
    {joinMessage && <div className="queue-success-message" role="status"><CheckCircle2 size={17} />{joinMessage}</div>}
    <section className="queue-status-card">
      <div className="queue-status-top"><div><span className={`queue-status-badge ${queue.status}`}><span />{statusLabels[queue.status]}</span><h2>{service.name}</h2><p><MapPin size={15} />{service.location}</p></div><div className="queue-ticket"><span>QUEUE TICKET</span><strong>{ticket}</strong></div></div>
      <div className="queue-status-stats"><div><span>Your position</span><strong>{finished ? statusLabels[queue.status] : `#${queue.position}`}</strong></div><div><span>Estimated wait</span><strong>{finished ? '0 min' : `~${queue.waitMinutes} min`}</strong></div><div><span>People ahead</span><strong>{finished ? '0' : Math.max(0, queue.position - 1)}</strong></div></div>
      <div className="queue-progress-heading"><span>Queue progress</span><span>{finished ? 'Complete' : `${Math.max(0, progress)}%`}</span></div><div className="queue-progress"><span style={{ width: `${Math.max(0, progress)}%` }} /></div>
      <ol className="status-timeline" aria-label="Status updates">
        <li className="done"><span /><strong>Joined</strong><small>{formatClock(queue.joinedAt)} · position #{queue.initialPosition}</small></li>
        <li className={queue.status === 'waiting' ? 'current' : 'done'}><span /><strong>Waiting</strong><small>{queue.status === 'waiting' ? `${Math.max(0, queue.position - 1)} ahead of you` : 'Moved through the line'}</small></li>
        <li className={queue.status === 'almost-ready' ? 'current' : finished ? 'done' : ''}><span /><strong>Almost ready</strong><small>Head to {service.location.split('·')[0].trim()}</small></li>
        <li className={isServed ? 'done' : isRemoved ? 'removed' : ''}><span /><strong>{isRemoved ? 'Removed' : 'Served'}</strong><small>{isServed ? 'Visit complete' : isRemoved ? 'Removed by an administrator' : 'Your turn at the counter'}</small></li>
      </ol>
      <div className={`queue-status-note ${isServed ? 'served-note' : ''} ${isRemoved ? 'removed-note' : ''}`}><Info size={17} /><p>{note}</p></div>
      <div className="queue-status-actions">{finished ? <><Link className="primary-button" to="/user/dashboard">Back to dashboard<ArrowRight size={16} /></Link><button className="text-button" onClick={onStartAnother}>Join another queue</button></> : <><button className="primary-button" onClick={onRefresh}><RefreshCw size={16} />Refresh status</button><button className="text-button danger" onClick={onLeave}>Leave queue</button></>}</div>
    </section>
    </>
  );
}

// How often open workspace pages re-read queues, so users see admin actions and vice versa.
const queuePollMs = 5000;

function WorkspacePage({ session }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [services, setServices] = useState(() => loadServices());
  const [serviceApiError, setServiceApiError] = useState('');
  const [queueError, setQueueError] = useState('');
  const [activeQueue, setActiveQueue] = useState(() => getActiveQueue());
  const [activeEntry, setActiveEntry] = useState(null);
  const [profile, setProfile] = useState(() => getUserProfile(session.email));
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false);
  const [joinMessage, setJoinMessage] = useState('');
  const { notifications, unreadCount } = useNotifications(session.role);
  const queue = resolveQueue(services, activeQueue, activeEntry);
  const previousPosition = useRef(queue?.position ?? null);
  const serviceSyncRequest = useRef(null);
  const activeQueueRef = useRef(activeQueue);
  activeQueueRef.current = activeQueue;
  // Bumped on join/leave so a poll that started earlier cannot bring back a queue the user just left.
  const queueGeneration = useRef(0);

  // Updates the ref right away so a refresh started in the same handler already sees the new queue.
  function replaceActiveQueue(next) {
    activeQueueRef.current = next;
    setActiveQueue(next);
  }

  function commitServices(next) {
    setServices(next);
    saveServices(next);
  }

  function mergeQueueViews(views) {
    setServices(current => {
      const next = applyQueueViews(current, views);
      saveServices(next);
      return next;
    });
  }

  async function refreshQueues() {
    const generation = queueGeneration.current;
    const views = await listQueues(session.token);
    mergeQueueViews(views);
    if (session.role !== 'user' || generation !== queueGeneration.current) return;

    const current = activeQueueRef.current;
    if (!current) {
      // Pick the queue back up if the server says this user is waiting (for example after signing in elsewhere).
      const mine = views.find(view => view.myEntry)?.myEntry;
      if (mine) {
        previousPosition.current = mine.position;
        setActiveEntry(mine);
        setActiveQueue({ serviceId: mine.serviceId, entryId: mine.id, initialPosition: mine.initialPosition, joinedAt: mine.joinedAt });
      }
      return;
    }
    try {
      const entry = await getQueueEntry(current.serviceId, current.entryId, session.token);
      if (generation === queueGeneration.current) setActiveEntry(entry);
    } catch (error) {
      // The server forgets queues when it restarts, so drop an entry it no longer knows about.
      if (error.status === 404 && generation === queueGeneration.current) {
        setActiveQueue(null);
        setActiveEntry(null);
      }
    }
  }

  useEffect(() => {
    let cancelled = false;
    if (!serviceSyncRequest.current) {
      serviceSyncRequest.current = (async () => {
        const localServices = loadServices();
        let remoteServices = (await listServicesApi(session.token)).services;
        if (!remoteServices.length && session.role === 'admin') {
          remoteServices = [];
          for (const service of localServices) {
            remoteServices.push(await createServiceApi(service, session.token));
          }
        }
        return remoteServices;
      })();
    }

    serviceSyncRequest.current.then(remoteServices => {
      if (cancelled) return;
      const syncedServices = remoteServices.map(service => ({
        ...service,
        averageMinutes: service.expectedDuration,
        queue: [],
        served: [],
        serverBacked: true,
      }));
      setServices(syncedServices);
      saveServices(syncedServices);
      setServiceApiError('');
      return refreshQueues();
    }).catch(error => {
      if (!cancelled) setServiceApiError(error.message);
    });
    return () => { cancelled = true; };
  }, [session.role, session.token]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const timer = setInterval(() => refreshQueues().catch(() => {}), queuePollMs);
    return () => clearInterval(timer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => saveActiveQueue(activeQueue), [activeQueue]);
  useEffect(() => subscribeToProfileUpdates(() => setProfile(getUserProfile(session.email))), [session.email]);
  useEffect(() => {
    if (location.pathname !== '/user/status') setJoinMessage('');
  }, [location.pathname]);
  useEffect(() => {
    if (queue && (queue.status === 'served' || queue.status === 'removed')) setJoinMessage('');
  }, [queue?.status]);

  // Notify once when a queue entry finishes (the server records it in history), and on position changes.
  useEffect(() => {
    if (!queue || session.role !== 'user') return;
    const before = previousPosition.current;
    previousPosition.current = queue.position;
    if ((queue.status === 'served' || queue.status === 'removed') && !activeQueue.outcomeRecorded) {
      addNotification({ audience: 'user', type: 'status', title: queue.status === 'served' ? `You’ve been served at ${queue.service.name}` : `Removed from ${queue.service.name}`, message: queue.status === 'served' ? 'Thanks for visiting. This queue has been added to your history.' : 'An administrator removed you from this queue. You can join another service.' });
      setActiveQueue(current => (current ? { ...current, outcomeRecorded: true } : current));
      return;
    }
    if (before !== null && before > queue.position && queue.position > 0) {
      addNotification({ audience: 'user', type: queue.status === 'almost-ready' ? 'status' : 'queue', title: queue.position === 1 ? 'You’re next!' : queue.status === 'almost-ready' ? 'Almost your turn' : `You moved up to #${queue.position}`, message: queue.position === 1 ? `Please head to ${queue.service.location} now.` : `${queue.position - 1} ${queue.position - 1 === 1 ? 'person is' : 'people are'} ahead of you at ${queue.service.name}.` });
    }
  }, [queue?.position, queue?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  const page = pageContent[location.pathname];
  if (!page || !location.pathname.startsWith(`/${session.role}/`)) return <Navigate to={`/${session.role}/dashboard`} replace />;
  const dashboard = location.pathname.endsWith('/dashboard');
  const userPage = session.role === 'user';

  async function joinQueue(service) {
    let entry;
    try {
      entry = await joinQueueApi(service.id, { name: profile.displayName }, session.token);
    } catch (error) {
      setQueueError(error.message);
      if (error.code === 'ALREADY_IN_QUEUE') refreshQueues().catch(() => {});
      return;
    }
    queueGeneration.current += 1;
    previousPosition.current = entry.position;
    setQueueError('');
    setActiveEntry(entry);
    replaceActiveQueue({ serviceId: service.id, entryId: entry.id, initialPosition: entry.initialPosition, joinedAt: entry.joinedAt });
    refreshQueues().catch(() => {});
    setJoinMessage(`You’ve joined ${service.name} at position #${entry.position}. Estimated wait: about ${entry.estimatedWaitMinutes} min.`);
    addNotification({ audience: 'user', type: 'queue', title: `Joined ${service.name}`, message: `You are #${entry.position} in line. Estimated wait is about ${entry.estimatedWaitMinutes} min.` });
    addNotification({ audience: 'admin', type: 'queue', title: `New visitor at ${service.name}`, message: `${profile.displayName} joined the queue (position #${entry.position}).` });
    navigate('/user/status');
  }

  function refreshQueueStatus() {
    refreshQueues().then(() => setQueueError(''), error => setQueueError(error.message));
  }

  async function confirmLeaveQueue() {
    if (queue && (queue.status === 'waiting' || queue.status === 'almost-ready')) {
      try {
        await leaveQueueApi(queue.service.id, session.token);
      } catch (error) {
        // NOT_IN_QUEUE means the server already ended this visit, so clearing it locally is still right.
        if (error.code !== 'NOT_IN_QUEUE') {
          setQueueError(error.message);
          setLeaveConfirmOpen(false);
          return;
        }
      }
      addNotification({ audience: 'user', type: 'status', title: `Left ${queue.service.name}`, message: 'Your place in line was released. You can join another service any time.' });
      addNotification({ audience: 'admin', type: 'queue', title: `Visitor left ${queue.service.name}`, message: `${profile.displayName} left the queue.` });
    }
    queueGeneration.current += 1;
    previousPosition.current = null;
    replaceActiveQueue(null);
    setActiveEntry(null);
    setLeaveConfirmOpen(false);
    setJoinMessage('');
    setQueueError('');
    refreshQueues().catch(() => {});
  }

  function startAnotherQueue() {
    queueGeneration.current += 1;
    previousPosition.current = null;
    replaceActiveQueue(null);
    setActiveEntry(null);
    setJoinMessage('');
    navigate('/user/join');
  }

  async function saveAdminService(serviceData, editingId) {
    const existing = editingId ? findService(services, editingId) : null;
    if (existing) {
      const saved = await updateServiceApi(editingId, serviceData, session.token);
      commitServices(services.map(item => (item.id === editingId ? {
        ...existing,
        ...saved,
        averageMinutes: saved.expectedDuration,
        serverBacked: true,
      } : item)));
      setServiceApiError('');
      addNotification({ audience: 'admin', type: 'service', title: `${serviceData.name} updated`, message: 'Service details were saved.' });
      return;
    }
    const saved = await createServiceApi({ ...serviceData, id: createServiceId(serviceData.name, services) }, session.token);
    const created = { ...serviceData, ...saved, averageMinutes: saved.expectedDuration, serverBacked: true, queue: [], served: [] };
    commitServices([...services, created]);
    setServiceApiError('');
    addNotification({ audience: 'admin', type: 'service', title: `${created.name} created`, message: `${created.isOpen ? 'The queue is open' : 'The queue is closed'} and the service is listed for members.` });
    if (created.isOpen) addNotification({ audience: 'user', type: 'service', title: `New service: ${created.name}`, message: `${created.name} is now accepting visitors at ${created.location}.` });
  }

  async function toggleAdminService(serviceId) {
    const service = findService(services, serviceId);
    if (!service) return;
    const isOpen = !service.isOpen;
    const saved = await updateServiceApi(serviceId, { ...service, isOpen }, session.token);
    commitServices(services.map(item => (item.id === serviceId ? { ...item, ...saved, averageMinutes: saved.expectedDuration, serverBacked: true } : item)));
    setServiceApiError('');
    addNotification({ audience: 'all', type: 'service', title: `${service.name} is now ${isOpen ? 'open' : 'closed'}`, message: isOpen ? `${service.name} is accepting new visitors again.` : `${service.name} is no longer accepting new visitors. People already in line will still be served.` });
  }

  async function deleteAdminService(serviceId) {
    const service = findService(services, serviceId);
    await deleteServiceApi(serviceId, session.token);
    commitServices(services.filter(item => item.id !== serviceId));
    setServiceApiError('');
    if (service) addNotification({ audience: 'admin', type: 'service', title: `${service.name} deleted`, message: 'The service and its queue were removed.' });
  }

  async function runQueueAction(action) {
    try {
      await action();
      setQueueError('');
    } catch (error) {
      setQueueError(error.message);
      refreshQueues().catch(() => {});
    }
  }

  function serveNextVisitor(serviceId) {
    return runQueueAction(async () => {
      const { served, queue: view } = await serveNextInQueue(serviceId, session.token);
      mergeQueueViews([view]);
      addNotification({ audience: 'admin', type: 'status', title: `${served.name} was served`, message: `${view.serviceName} now has ${view.waitingCount} people waiting.` });
    });
  }

  function removeQueueVisitor(serviceId, visitorId) {
    return runQueueAction(async () => {
      const { removed, queue: view } = await removeQueueEntry(serviceId, visitorId, session.token);
      mergeQueueViews([view]);
      addNotification({ audience: 'admin', type: 'queue', title: `${removed.name} removed`, message: `Removed from the ${view.serviceName} queue.` });
    });
  }

  function moveQueueVisitor(serviceId, visitorId, direction) {
    return runQueueAction(async () => {
      const { queue: view } = await moveQueueEntry(serviceId, visitorId, direction, session.token);
      mergeQueueViews([view]);
    });
  }

  return (
    <AppShell session={session} profile={profile} title={page.title}>
      <div className="page-heading"><p className="eyebrow">{page.eyebrow}</p><h1>{userPage && dashboard ? `Good to see you, ${profile.displayName}` : page.heading}</h1><p>{page.description}</p></div>
      {queueError && <div className="auth-alert" role="alert"><AlertCircle size={17} />{queueError}</div>}
      {userPage && location.pathname === '/user/join' && serviceApiError && (
        <div className="auth-alert" role="alert">
          <AlertCircle size={17} />
          {services.length
            ? 'The service API is unavailable. Showing saved local services; any wait estimate will be labelled as a local fallback.'
            : 'Services could not be loaded from the server. Check that the backend is running, then reload this page.'}
        </div>
      )}
      {userPage && dashboard ? <UserDashboard services={services} queue={queue} onJoin={joinQueue} notifications={notifications} unreadCount={unreadCount} onMarkAllRead={() => markAllRead('user')} /> : null}
      {userPage && location.pathname === '/user/join' ? <JoinQueuePage services={services} queue={queue} onJoin={joinQueue} onLeave={() => setLeaveConfirmOpen(true)} /> : null}
      {userPage && location.pathname === '/user/status' ? <QueueStatusPage queue={queue} onRefresh={refreshQueueStatus} onLeave={() => setLeaveConfirmOpen(true)} onStartAnother={startAnotherQueue} joinMessage={joinMessage} /> : null}
      {userPage && location.pathname === '/user/history' ? <HistoryPage session={session} /> : null}
      {userPage && location.pathname === '/user/settings' ? <AccountSettings email={session.email} /> : null}
      {userPage && leaveConfirmOpen && <div className="confirm-overlay"><section className="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="leave-confirm-title"><h2 id="leave-confirm-title">Leave this queue?</h2><p>Your current place in this queue will be released. You can join another service afterward.</p><div><button type="button" className="text-button" onClick={() => setLeaveConfirmOpen(false)}>Keep my place</button><button type="button" className="primary-button confirm-leave-button" onClick={confirmLeaveQueue}>Leave queue</button></div></section></div>}
      {!userPage && dashboard ? <AdminDashboardPage services={services} onToggleService={toggleAdminService} notifications={notifications} unreadCount={unreadCount} onMarkAllRead={() => markAllRead('admin')} /> : null}
      {!userPage && location.pathname === '/admin/services' ? <AdminServicesPage services={services} onSaveService={saveAdminService} onToggleService={toggleAdminService} onDeleteService={deleteAdminService} apiError={serviceApiError} /> : null}
      {!userPage && location.pathname === '/admin/queues' ? <AdminQueuePage services={services} onToggleService={toggleAdminService} onServeNext={serveNextVisitor} onRemoveVisitor={removeQueueVisitor} onMoveVisitor={moveQueueVisitor} /> : null}
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
      <Route path="/user/*" element={session ? <WorkspacePage key={session.email + session.role} session={session} /> : <Navigate to="/login" replace />} />
      <Route path="/admin/*" element={session ? <WorkspacePage key={session.email + session.role} session={session} /> : <Navigate to="/login" replace />} />
      <Route path="*" element={<Navigate to={session ? `/${session.role}/dashboard` : '/login'} replace />} />
    </Routes>
  );
}
