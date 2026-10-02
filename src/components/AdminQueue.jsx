import { Clock3, Users } from 'lucide-react';

export default function AdminQueuePage({ services, onToggleService }) {
  return (
    <>
      <div className="admin-toolbar">
        <div>
          <p className="eyebrow">LIVE</p>
          <h2>Queue management</h2>
        </div>
      </div>

      <section className="admin-panel">
        <div className="section-heading"><div><p className="eyebrow">WINDOWS</p><h2>Service lines</h2></div></div>
        <div className="admin-queue-grid">
          {services.map(service => (
            <article key={service.id} className="admin-card queue-card">
              <div className="admin-card-header">
                <span className={`status-pill ${service.isOpen === false ? 'closed' : 'open'}`}>{service.isOpen === false ? 'Closed' : 'Open'}</span>
                <strong>{service.name}</strong>
              </div>
              <p>{service.location}</p>
              <div className="admin-card-meta stack">
                <span><Users size={15} />{service.waiting} people waiting</span>
                <span><Clock3 size={15} />{service.openUntil}</span>
              </div>
              <button type="button" className="secondary-button full-width" onClick={() => onToggleService(service.id)}>{service.isOpen === false ? 'Open queue' : 'Close queue'}</button>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
