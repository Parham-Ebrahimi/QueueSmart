import { ArrowRight, Bell, CheckCircle2, Clock3, Info, ListOrdered, Lock, LockOpen, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { queueWaitMinutes, waitingCount } from '../queueData.js';
import { formatRelativeTime } from '../store.js';

const typeIcons = { status: CheckCircle2, service: Info, queue: Users };

export default function AdminDashboardPage({ services, onToggleService, notifications = [], unreadCount = 0, onMarkAllRead }) {
  const openServices = services.filter(service => service.isOpen !== false).length;
  const closedServices = services.length - openServices;
  const totalWaiting = services.reduce((total, service) => total + waitingCount(service), 0);
  const averageWait = services.length ? Math.round(services.reduce((total, service) => total + queueWaitMinutes(service), 0) / services.length) : 0;
  const busiest = [...services].sort((a, b) => waitingCount(b) - waitingCount(a))[0];
  const recent = notifications.slice(0, 4);

  return (
    <>
      <div className="overview-grid four">
        <div className="overview-panel"><div className="panel-icon teal"><Users size={21} /></div><span>Open services</span><strong>{openServices}</strong><p>{closedServices ? `${closedServices} closed right now.` : 'Everything is accepting visitors.'}</p></div>
        <div className="overview-panel"><div className="panel-icon coral"><Clock3 size={21} /></div><span>Visitors waiting</span><strong>{totalWaiting}</strong><p>Across all service points.</p></div>
        <div className="overview-panel"><div className="panel-icon blue"><Info size={21} /></div><span>Average wait</span><strong>{averageWait} min</strong><p>{busiest && waitingCount(busiest) ? `Busiest: ${busiest.name}.` : 'No queues are waiting.'}</p></div>
        <div className="overview-panel"><div className="panel-icon amber"><Bell size={21} /></div><span>Unread notifications</span><strong>{unreadCount}</strong><p>Queue and service updates.</p></div>
      </div>

      <section className="admin-panel">
        <div className="section-heading"><div><p className="eyebrow">SERVICE HEALTH</p><h2>Services and queue lengths</h2></div><Link to="/admin/services">Manage services<ArrowRight size={16} /></Link></div>
        {services.length ? (
          <div className="admin-queue-grid">
            {services.map(service => {
              const waiting = waitingCount(service);
              const load = Math.min(100, Math.round((waiting / 8) * 100));
              return (
                <article key={service.id} className="admin-card">
                  <div className="admin-card-header">
                    <span className={`status-pill ${service.isOpen === false ? 'closed' : 'open'}`}>{service.isOpen === false ? 'Closed' : 'Open'}</span>
                    <span className={`priority-pill ${service.priority}`}>{service.priority}</span>
                  </div>
                  <strong className="admin-card-title">{service.name}</strong>
                  <p>{service.location}</p>
                  <div className="queue-load"><div className="queue-progress-heading"><span>Queue length</span><span>{waiting} waiting</span></div><div className="queue-progress"><span className={load > 60 ? 'busy' : ''} style={{ width: `${load}%` }} /></div></div>
                  <div className="admin-card-meta">
                    <span><Clock3 size={15} />~{queueWaitMinutes(service)} min to clear</span>
                    <span><Users size={15} />{service.averageMinutes} min each</span>
                  </div>
                  <div className="admin-card-actions">
                    <button type="button" className="secondary-button" onClick={() => onToggleService(service.id)}>{service.isOpen === false ? <><LockOpen size={14} />Open queue</> : <><Lock size={14} />Close queue</>}</button>
                    <Link className="text-button" to="/admin/queues"><ListOrdered size={15} />Manage</Link>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="empty-state small"><div className="empty-icon"><Users size={24} /></div><h2>No services yet</h2><p>Create a service to start managing queues.</p><Link className="primary-button" to="/admin/services">Create a service</Link></div>
        )}
      </section>

      <div className="dashboard-columns admin">
        <section className="admin-panel compact-panel">
          <div className="section-heading"><div><p className="eyebrow">OPERATIONS</p><h2>Queue status</h2></div></div>
          <div className="admin-ops-grid">
            <div className="admin-op-block"><span>Services open</span><strong>{openServices}</strong></div>
            <div className="admin-op-block"><span>Services closed</span><strong>{closedServices}</strong></div>
            <div className="admin-op-block"><span>Avg. queue length</span><strong>{services.length ? (totalWaiting / services.length).toFixed(1) : 0}</strong></div>
          </div>
        </section>
        <section className="admin-panel compact-panel notification-summary">
          <div className="section-heading"><div><p className="eyebrow">NOTIFICATIONS</p><h2>Recent activity</h2></div>{unreadCount > 0 && <button type="button" className="link-button" onClick={onMarkAllRead}>Mark all read</button>}</div>
          {recent.length ? (
            <ul className="notification-list compact">
              {recent.map(item => {
                const Icon = typeIcons[item.type] || Users;
                return <li key={item.id} className={item.read ? '' : 'unread'}><span className={`notification-type ${item.type}`}><Icon size={15} /></span><div><strong>{item.title}</strong><p>{item.message}</p><small>{formatRelativeTime(item.createdAt)}</small></div></li>;
              })}
            </ul>
          ) : <p className="notification-empty">No activity yet. Queue updates will appear here.</p>}
        </section>
      </div>
    </>
  );
}
