import { Clock3, Info, Users } from 'lucide-react';

export default function AdminDashboardPage({ services }) {
  const openServices = services.filter(service => service.isOpen !== false).length;
  const closedServices = services.length - openServices;
  const totalWaiting = services.reduce((total, service) => total + Number(service.waiting || 0), 0);
  const averageWait = services.length
    ? Math.round(
        services.reduce(
          (total, service) => total + Number(service.waiting || 0) * Number(service.averageMinutes || 0),
          0,
        ) / services.length,
      )
    : 0;

  return (
    <>
      <div className="overview-grid">
        <div className="overview-panel"><div className="panel-icon teal"><Users size={21} /></div><span>Open services</span><strong>{openServices}</strong><p>Currently accepting visitors.</p></div>
        <div className="overview-panel"><div className="panel-icon coral"><Clock3 size={21} /></div><span>Visitors waiting</span><strong>{totalWaiting}</strong><p>Across all service points.</p></div>
        <div className="overview-panel"><div className="panel-icon blue"><Info size={21} /></div><span>Average wait</span><strong>{averageWait} min</strong><p>Based on active queue volume.</p></div>
      </div>

      <section className="admin-panel">
        <div className="section-heading"><div><p className="eyebrow">SERVICE HEALTH</p><h2>Service overview</h2></div></div>
        <div className="admin-queue-grid">
          {services.map(service => (
            <article key={service.id} className="admin-card">
              <div className="admin-card-header">
                <span className={`status-pill ${service.isOpen === false ? 'closed' : 'open'}`}>{service.isOpen === false ? 'Closed' : 'Open'}</span>
                <strong>{service.name}</strong>
              </div>
              <p>{service.location}</p>
              <div className="admin-card-meta">
                <span><Users size={15} />{service.waiting} waiting</span>
                <span><Clock3 size={15} />~{service.averageMinutes} min</span>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="admin-panel compact-panel">
        <div className="section-heading"><div><p className="eyebrow">OPERATIONS</p><h2>Queue status</h2></div></div>
        <div className="admin-ops-grid">
          <div className="admin-op-block"><span>Services open</span><strong>{openServices}</strong></div>
          <div className="admin-op-block"><span>Services closed</span><strong>{closedServices}</strong></div>
          <div className="admin-op-block"><span>Avg. queue length</span><strong>{services.length ? Math.round(totalWaiting / services.length) : 0}</strong></div>
        </div>
      </section>
    </>
  );
}
