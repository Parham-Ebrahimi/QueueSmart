import { ArrowRight, Clock3, ListOrdered, Pencil, Plus, Trash2, Users } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { priorityLevels, waitingCount } from '../queueData.js';

export const serviceLimits = { name: 100, description: 500, location: 120, category: 40, duration: { min: 1, max: 480 } };

const emptyServiceForm = { name: '', description: '', category: '', location: '', openUntil: '17:00', averageMinutes: '10', priority: 'medium', isOpen: true };

function to24Hour(label) {
  const match = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(label || '');
  if (!match) return /^\d{2}:\d{2}$/.test(label || '') ? label : '17:00';
  let hours = Number(match[1]) % 12;
  if (match[3].toUpperCase() === 'PM') hours += 12;
  return `${String(hours).padStart(2, '0')}:${match[2]}`;
}

function toLabel(value) {
  const [hours, minutes] = value.split(':').map(Number);
  const suffix = hours >= 12 ? 'PM' : 'AM';
  return `${hours % 12 || 12}:${String(minutes).padStart(2, '0')} ${suffix}`;
}

export function validateService(values) {
  const errors = {};
  const name = values.name.trim();
  const description = values.description.trim();

  if (!name) errors.name = 'Service name is required.';
  else if (name.length > serviceLimits.name) errors.name = `Service name must be ${serviceLimits.name} characters or fewer.`;

  if (!description) errors.description = 'Description is required.';
  else if (description.length > serviceLimits.description) errors.description = `Description must be ${serviceLimits.description} characters or fewer.`;

  if (!values.category.trim()) errors.category = 'Category is required.';
  else if (values.category.trim().length > serviceLimits.category) errors.category = `Category must be ${serviceLimits.category} characters or fewer.`;

  if (!values.location.trim()) errors.location = 'Location is required.';
  else if (values.location.trim().length > serviceLimits.location) errors.location = `Location must be ${serviceLimits.location} characters or fewer.`;

  if (!/^\d{2}:\d{2}$/.test(values.openUntil)) errors.openUntil = 'Choose a closing time.';

  const duration = Number(values.averageMinutes);
  if (values.averageMinutes === '' || Number.isNaN(duration)) errors.averageMinutes = 'Expected duration is required.';
  else if (!Number.isInteger(duration)) errors.averageMinutes = 'Enter a whole number of minutes.';
  else if (duration < serviceLimits.duration.min || duration > serviceLimits.duration.max) errors.averageMinutes = `Enter between ${serviceLimits.duration.min} and ${serviceLimits.duration.max} minutes.`;

  if (!priorityLevels.includes(values.priority)) errors.priority = 'Choose a priority level.';

  return errors;
}

export default function AdminServicesPage({ services, onSaveService, onToggleService, onDeleteService }) {
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [values, setValues] = useState(emptyServiceForm);
  const [errors, setErrors] = useState({});
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [savedMessage, setSavedMessage] = useState('');

  function resetForm() {
    setValues(emptyServiceForm);
    setErrors({});
    setEditingId(null);
    setFormOpen(false);
  }

  function openCreateForm() {
    setEditingId(null);
    setValues(emptyServiceForm);
    setErrors({});
    setSavedMessage('');
    setFormOpen(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function openEditForm(service) {
    setEditingId(service.id);
    setValues({
      name: service.name,
      description: service.description || '',
      category: service.category,
      location: service.location,
      openUntil: to24Hour(service.openUntil),
      averageMinutes: String(service.averageMinutes),
      priority: service.priority || 'medium',
      isOpen: service.isOpen !== false,
    });
    setErrors({});
    setSavedMessage('');
    setFormOpen(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function updateField(event) {
    const { name, value, type, checked } = event.target;
    setValues(current => ({ ...current, [name]: type === 'checkbox' ? checked : value }));
    if (errors[name]) setErrors(current => ({ ...current, [name]: undefined }));
  }

  function submitForm(event) {
    event.preventDefault();
    const nextErrors = validateService(values);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    const normalized = {
      name: values.name.trim(),
      description: values.description.trim(),
      category: values.category.trim(),
      location: values.location.trim(),
      openUntil: toLabel(values.openUntil),
      averageMinutes: Number(values.averageMinutes),
      priority: values.priority,
      isOpen: values.isOpen !== false,
    };

    onSaveService(normalized, editingId);
    setSavedMessage(editingId ? `${normalized.name} was updated.` : `${normalized.name} was created.`);
    resetForm();
  }

  const nameRemaining = serviceLimits.name - values.name.length;
  const descriptionRemaining = serviceLimits.description - values.description.length;

  return (
    <>
      <div className="admin-toolbar">
        <div>
          <p className="eyebrow">MANAGE</p>
          <h2>Service management</h2>
        </div>
        <button type="button" className="primary-button" onClick={openCreateForm}><Plus size={16} />Create service</button>
      </div>

      {savedMessage && !formOpen && <div className="queue-success-message" role="status">{savedMessage}</div>}

      {formOpen && (
        <section className="admin-panel service-form-panel">
          <div className="section-heading"><div><p className="eyebrow">{editingId ? 'EDIT' : 'NEW'}</p><h2>{editingId ? 'Edit service' : 'Create service'}</h2></div></div>
          <form className="service-form" onSubmit={submitForm} noValidate>
            <div className="form-grid">
              <div className="field full-width">
                <label htmlFor="service-name">Service name <span className="required-mark">*</span></label>
                <input id="service-name" name="name" value={values.name} onChange={updateField} maxLength={serviceLimits.name} placeholder="e.g. Registrar’s Office" aria-invalid={Boolean(errors.name)} aria-describedby="service-name-hint" />
                {errors.name ? <span className="field-error">{errors.name}</span> : <span className="field-hint" id="service-name-hint">{nameRemaining} characters remaining</span>}
              </div>
              <div className="field full-width">
                <label htmlFor="service-description">Description <span className="required-mark">*</span></label>
                <textarea id="service-description" name="description" rows={3} value={values.description} onChange={updateField} maxLength={serviceLimits.description} placeholder="What does this service help visitors with?" aria-invalid={Boolean(errors.description)} />
                {errors.description ? <span className="field-error">{errors.description}</span> : <span className="field-hint">{descriptionRemaining} characters remaining</span>}
              </div>
              <div className="field">
                <label htmlFor="service-averageMinutes">Expected duration (minutes) <span className="required-mark">*</span></label>
                <input id="service-averageMinutes" type="number" inputMode="numeric" min={serviceLimits.duration.min} max={serviceLimits.duration.max} step="1" name="averageMinutes" value={values.averageMinutes} onChange={updateField} aria-invalid={Boolean(errors.averageMinutes)} />
                {errors.averageMinutes ? <span className="field-error">{errors.averageMinutes}</span> : <span className="field-hint">Average time spent serving one visitor.</span>}
              </div>
              <div className="field">
                <label htmlFor="service-priority">Priority level <span className="required-mark">*</span></label>
                <select id="service-priority" name="priority" value={values.priority} onChange={updateField} aria-invalid={Boolean(errors.priority)}>
                  {priorityLevels.map(level => <option key={level} value={level}>{level.charAt(0).toUpperCase() + level.slice(1)}</option>)}
                </select>
                {errors.priority ? <span className="field-error">{errors.priority}</span> : <span className="field-hint">High-priority services are highlighted for members.</span>}
              </div>
              <div className="field">
                <label htmlFor="service-category">Category <span className="required-mark">*</span></label>
                <input id="service-category" name="category" value={values.category} onChange={updateField} maxLength={serviceLimits.category} placeholder="e.g. Campus support" aria-invalid={Boolean(errors.category)} />
                {errors.category && <span className="field-error">{errors.category}</span>}
              </div>
              <div className="field">
                <label htmlFor="service-openUntil">Open until <span className="required-mark">*</span></label>
                <input id="service-openUntil" type="time" name="openUntil" value={values.openUntil} onChange={updateField} aria-invalid={Boolean(errors.openUntil)} />
                {errors.openUntil && <span className="field-error">{errors.openUntil}</span>}
              </div>
              <div className="field full-width">
                <label htmlFor="service-location">Location <span className="required-mark">*</span></label>
                <input id="service-location" name="location" value={values.location} onChange={updateField} maxLength={serviceLimits.location} placeholder="Building · Room" aria-invalid={Boolean(errors.location)} />
                {errors.location && <span className="field-error">{errors.location}</span>}
              </div>
            </div>
            <label className="toggle-row">
              <input type="checkbox" name="isOpen" checked={values.isOpen} onChange={updateField} />
              <span>Queue is open and accepting visitors</span>
            </label>
            <div className="form-actions">
              <button type="button" className="text-button" onClick={resetForm}>Cancel</button>
              <button type="submit" className="primary-button">{editingId ? 'Save changes' : 'Create service'}<ArrowRight size={16} /></button>
            </div>
          </form>
        </section>
      )}

      <section className="admin-panel">
        <div className="section-heading"><div><p className="eyebrow">CATALOG</p><h2>Current services</h2></div><span className="muted-count">{services.length} {services.length === 1 ? 'service' : 'services'}</span></div>
        {services.length ? (
          <div className="admin-service-list">
            {services.map(service => (
              <article className="admin-service-item" key={service.id}>
                <div className="admin-service-copy">
                  <div className="admin-card-header">
                    <span className={`status-pill ${service.isOpen === false ? 'closed' : 'open'}`}>{service.isOpen === false ? 'Closed' : 'Open'}</span>
                    <span className={`priority-pill ${service.priority}`}>{service.priority} priority</span>
                    <strong>{service.name}</strong>
                  </div>
                  <p>{service.category} · {service.location} · until {service.openUntil}</p>
                  {service.description && <p className="service-description">{service.description}</p>}
                  <div className="admin-card-meta">
                    <span><Users size={15} />{waitingCount(service)} waiting</span>
                    <span><Clock3 size={15} />{service.averageMinutes} min per visit</span>
                  </div>
                </div>
                <div className="admin-service-actions">
                  <Link className="text-button" to="/admin/queues"><ListOrdered size={15} />Queue</Link>
                  <button type="button" className="text-button" onClick={() => openEditForm(service)}><Pencil size={15} />Edit</button>
                  <button type="button" className="secondary-button" onClick={() => onToggleService(service.id)}>{service.isOpen === false ? 'Open queue' : 'Close queue'}</button>
                  <button type="button" className="danger-button" onClick={() => setConfirmDelete(service)}><Trash2 size={14} />Delete</button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-state small"><div className="empty-icon"><Plus size={24} /></div><h2>No services yet</h2><p>Create your first service to start accepting visitors.</p></div>
        )}
      </section>

      {confirmDelete && (
        <div className="confirm-overlay">
          <section className="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="delete-confirm-title">
            <h2 id="delete-confirm-title">Delete {confirmDelete.name}?</h2>
            <p>{waitingCount(confirmDelete) ? `${waitingCount(confirmDelete)} ${waitingCount(confirmDelete) === 1 ? 'person is' : 'people are'} still waiting. ` : ''}This removes the service and its queue from the demo.</p>
            <div>
              <button type="button" className="text-button" onClick={() => setConfirmDelete(null)}>Cancel</button>
              <button type="button" className="primary-button confirm-leave-button" onClick={() => { onDeleteService(confirmDelete.id); setConfirmDelete(null); }}>Delete service</button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
