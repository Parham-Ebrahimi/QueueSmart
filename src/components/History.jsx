import { useState } from 'react';
import { CheckCircle2, ClipboardList, LogOut, UserMinus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { historyOutcomes, useHistory } from '../history.js';
import { formatClock, formatDate } from '../store.js';

const filters = [
  { id: 'all', label: 'All' },
  { id: 'served', label: 'Served' },
  { id: 'left', label: 'Left' },
  { id: 'removed', label: 'Removed' },
];

const outcomeIcons = { served: CheckCircle2, left: LogOut, removed: UserMinus };

function durationMinutes(entry) {
  return Math.max(0, Math.round((new Date(entry.endedAt) - new Date(entry.joinedAt)) / 60000));
}

export default function HistoryPage({ email }) {
  const history = useHistory(email);
  const [filter, setFilter] = useState('all');
  const visible = filter === 'all' ? history : history.filter(entry => entry.outcome === filter);
  const servedCount = history.filter(entry => entry.outcome === 'served').length;
  const averageMinutes = history.length ? Math.round(history.reduce((total, entry) => total + durationMinutes(entry), 0) / history.length) : 0;

  return (
    <>
      <div className="overview-grid history-summary">
        <div className="overview-panel compact"><span>Queues joined</span><strong>{history.length}</strong><p>All time, on this device.</p></div>
        <div className="overview-panel compact"><span>Times served</span><strong>{servedCount}</strong><p>{history.length ? `${Math.round((servedCount / history.length) * 100)}% of your visits.` : 'No visits yet.'}</p></div>
        <div className="overview-panel compact"><span>Average time in line</span><strong>{averageMinutes} min</strong><p>From joining to the final outcome.</p></div>
      </div>

      <section className="admin-panel history-panel">
        <div className="section-heading"><div><p className="eyebrow">PAST QUEUES</p><h2>Your visits</h2></div>
          <div className="filter-strip" role="tablist" aria-label="Filter history by outcome">
            {filters.map(item => <button key={item.id} type="button" role="tab" aria-selected={filter === item.id} className={filter === item.id ? 'selected' : ''} onClick={() => setFilter(item.id)}>{item.label}</button>)}
          </div>
        </div>
        {visible.length ? (
          <div className="history-table" role="table">
            <div className="history-row history-head" role="row"><span role="columnheader">Date</span><span role="columnheader">Service</span><span role="columnheader">Time in line</span><span role="columnheader">Outcome</span></div>
            {visible.map(entry => {
              const Icon = outcomeIcons[entry.outcome] || CheckCircle2;
              return (
                <div className="history-row" role="row" key={entry.id}>
                  <span role="cell"><strong>{formatDate(entry.joinedAt)}</strong><small>{formatClock(entry.joinedAt)} – {formatClock(entry.endedAt)}</small></span>
                  <span role="cell"><strong>{entry.serviceName}</strong><small>Started at position #{entry.position}</small></span>
                  <span role="cell"><strong>{durationMinutes(entry)} min</strong><small>{historyOutcomes[entry.outcome]?.description}</small></span>
                  <span role="cell"><span className={`outcome-pill ${entry.outcome}`}><Icon size={13} />{historyOutcomes[entry.outcome]?.label || entry.outcome}</span></span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="empty-state small"><div className="empty-icon"><ClipboardList size={24} /></div><h2>{history.length ? 'Nothing matches this filter' : 'No queue history yet'}</h2><p>{history.length ? 'Try a different outcome filter.' : 'Once you have been served or leave a queue, it will show up here.'}</p>{!history.length && <Link className="primary-button" to="/user/join">Join a queue</Link>}</div>
        )}
      </section>
    </>
  );
}
