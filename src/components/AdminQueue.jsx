import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, CheckCircle2, Clock3, Lock, LockOpen, MapPin, Play, Smartphone, UserMinus, Users } from 'lucide-react';
import { estimateWait, queueWaitMinutes, waitingCount } from '../queueData.js';
import { formatClock, formatRelativeTime } from '../store.js';

export default function AdminQueuePage({ services, onToggleService, onServeNext, onRemoveVisitor, onMoveVisitor }) {
  const [selectedId, setSelectedId] = useState(() => services.find(service => waitingCount(service) > 0)?.id || services[0]?.id || null);
  const [confirmRemove, setConfirmRemove] = useState(null);
  const [lastServed, setLastServed] = useState(null);

  useEffect(() => {
    if (!services.some(service => service.id === selectedId)) setSelectedId(services[0]?.id || null);
  }, [services, selectedId]);

  useEffect(() => {
    if (!lastServed) return undefined;
    const timer = setTimeout(() => setLastServed(null), 4000);
    return () => clearTimeout(timer);
  }, [lastServed]);

  const service = services.find(item => item.id === selectedId) || null;
  const totalWaiting = services.reduce((total, item) => total + waitingCount(item), 0);

  if (!services.length) {
    return <div className="empty-state"><div className="empty-icon"><Users size={26} /></div><h2>No services yet</h2><p>Create a service first, then manage its queue here.</p></div>;
  }

  function serveNext() {
    if (!service?.queue.length) return;
    setLastServed({ name: service.queue[0].name, serviceName: service.name });
    onServeNext(service.id);
  }

  return (
    <>
      <div className="queue-picker">
        <div className="service-tabs" role="tablist" aria-label="Select a service">
          {services.map(item => (
            <button key={item.id} type="button" role="tab" aria-selected={item.id === selectedId} className={`service-tab ${item.id === selectedId ? 'selected' : ''}`} onClick={() => setSelectedId(item.id)}>
              <span className={`tab-dot ${item.isOpen ? 'open' : 'closed'}`} />
              <span className="tab-name">{item.name}</span>
              <span className="tab-count">{waitingCount(item)}</span>
            </button>
          ))}
        </div>
        <span className="toolbar-stat"><Users size={15} />{totalWaiting} waiting across {services.length} {services.length === 1 ? 'service' : 'services'}</span>
      </div>

      {service && (
        <section className="admin-panel queue-manager">
          <div className="queue-manager-header">
            <div>
              <div className="admin-card-header">
                <span className={`status-pill ${service.isOpen ? 'open' : 'closed'}`}>{service.isOpen ? 'Open' : 'Closed'}</span>
                <span className={`priority-pill ${service.priority}`}>{service.priority} priority</span>
                <strong>{service.name}</strong>
              </div>
              <p className="queue-manager-location"><MapPin size={14} />{service.location} · Open until {service.openUntil}</p>
            </div>
            <div className="queue-manager-actions">
              <button type="button" className="secondary-button" onClick={() => onToggleService(service.id)}>{service.isOpen ? <><Lock size={15} />Close queue</> : <><LockOpen size={15} />Open queue</>}</button>
              <button type="button" className="primary-button" onClick={serveNext} disabled={!service.queue.length}><Play size={15} />Serve next</button>
            </div>
          </div>

          <div className="queue-manager-stats">
            <div><span>Waiting</span><strong>{waitingCount(service)}</strong></div>
            <div><span>Expected duration</span><strong>{service.averageMinutes} min</strong></div>
            <div><span>Total wait to clear</span><strong>~{queueWaitMinutes(service)} min</strong></div>
            <div><span>Served recently</span><strong>{service.served.length}</strong></div>
          </div>

          {lastServed && <div className="queue-success-message" role="status"><CheckCircle2 size={17} />Now serving {lastServed.name} at {lastServed.serviceName}.</div>}

          {service.queue.length ? (
            <ol className="visitor-list" aria-label={`${service.name} queue`}>
              {service.queue.map((visitor, index) => {
                const position = index + 1;
                return (
                  <li key={visitor.id} className={`visitor-row ${position === 1 ? 'next-up' : ''}`}>
                    <span className="visitor-position">{position}</span>
                    <div className="visitor-copy">
                      <strong>{visitor.name}{visitor.isMember && <span className="member-tag"><Smartphone size={11} />App</span>}{position === 1 && <span className="next-tag">Next up</span>}</strong>
                      <small>{visitor.email}</small>
                      <small className="visitor-meta"><Clock3 size={12} />Joined {formatClock(visitor.joinedAt)} ({formatRelativeTime(visitor.joinedAt).toLowerCase()}) · est. {estimateWait(service, position)} min wait</small>
                    </div>
                    <div className="visitor-actions">
                      <button type="button" className="icon-button" aria-label={`Move ${visitor.name} up`} disabled={index === 0} onClick={() => onMoveVisitor(service.id, visitor.id, -1)}><ArrowUp size={17} /></button>
                      <button type="button" className="icon-button" aria-label={`Move ${visitor.name} down`} disabled={index === service.queue.length - 1} onClick={() => onMoveVisitor(service.id, visitor.id, 1)}><ArrowDown size={17} /></button>
                      <button type="button" className="danger-button slim" onClick={() => setConfirmRemove(visitor)}><UserMinus size={14} />Remove</button>
                    </div>
                  </li>
                );
              })}
            </ol>
          ) : (
            <div className="empty-state small"><div className="empty-icon"><Users size={24} /></div><h2>The queue is empty</h2><p>{service.isOpen ? 'New visitors will appear here as soon as they join.' : 'This queue is closed. Open it to accept new visitors.'}</p></div>
          )}

          {service.served.length > 0 && (
            <div className="served-strip">
              <div className="section-heading"><div><p className="eyebrow">RECENTLY SERVED</p><h2>Completed visits</h2></div></div>
              <ul>
                {service.served.map(visitor => <li key={visitor.id}><CheckCircle2 size={15} /><span><strong>{visitor.name}</strong><small>Served at {formatClock(visitor.servedAt)}</small></span></li>)}
              </ul>
            </div>
          )}
        </section>
      )}

      {confirmRemove && (
        <div className="confirm-overlay">
          <section className="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="remove-confirm-title">
            <h2 id="remove-confirm-title">Remove {confirmRemove.name}?</h2>
            <p>They will lose their place in the {service?.name} queue. This is a UI-only simulation for the demo.</p>
            <div>
              <button type="button" className="text-button" onClick={() => setConfirmRemove(null)}>Keep in queue</button>
              <button type="button" className="primary-button confirm-leave-button" onClick={() => { onRemoveVisitor(service.id, confirmRemove.id); setConfirmRemove(null); }}>Remove visitor</button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
