import { ArrowRight, Clock3, Users } from 'lucide-react';
import { useState } from 'react';

const emptyServiceForm = { name: '', category: '', location: '', openUntil: '', averageMinutes: '10', waiting: '0', isOpen: true };

function slugifyServiceId(value) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'service';
}

export default function AdminServicesPage({ services, onSaveService, onToggleService, onDeleteService }) {
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [values, setValues] = useState(emptyServiceForm);
  const [errors, setErrors] = useState({});

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
    setFormOpen(true);
  }

  function openEditForm(service) {
    setEditingId(service.id);
    setValues({
      name: service.name,
      category: service.category,
      location: service.location,
      openUntil: service.openUntil,
      averageMinutes: String(service.averageMinutes),
      waiting: String(service.waiting),
      isOpen: service.isOpen !== false,
    });
    setErrors({});
    setFormOpen(true);
  }

  function updateField(event) {
    const { name, value, type, checked } = event.target;
    setValues(current => ({
      ...current,
      [name]: type === 'checkbox' ? checked : value,
    }));
    if (errors[name]) setErrors(current => ({ ...current, [name]: undefined }));
  }

  function validateForm(nextValues) {
    const nextErrors = {};
    if (!nextValues.name.trim()) nextErrors.name = 'Service name is required.';
    if (!nextValues.category.trim()) nextErrors.category = 'Category is required.';
    if (!nextValues.location.trim()) nextErrors.location = 'Location is required.';
    if (!nextValues.openUntil.trim()) nextErrors.openUntil = 'Open time is required.';

    const averageMinutes = Number(nextValues.averageMinutes);
    if (!nextValues.averageMinutes || Number.isNaN(averageMinutes) || averageMinutes <= 0) {
      nextErrors.averageMinutes = 'Average wait must be greater than 0.';
    }

    const waiting = Number(nextValues.waiting);
    if (Number.isNaN(waiting) || waiting < 0) {
      nextErrors.waiting = 'Waiting count cannot be negative.';
    }

    return nextErrors;
  }

  function submitForm(event) {
    event.preventDefault();
    const nextErrors = validateForm(values);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    const normalized = {
      id: editingId || slugifyServiceId(values.name),
      name: values.name.trim(),
      category: values.category.trim(),
      location: values.location.trim(),
      openUntil: values.openUntil.trim(),
      averageMinutes: Number(values.averageMinutes),
      waiting: Math.max(0, Number(values.waiting)),
      isOpen: values.isOpen !== false,
    };

    onSaveService(normalized, editingId);
    resetForm();
  }

  return (
    <>
      <div className="admin-toolbar">
        <div>
          <p className="eyebrow">MANAGE</p>
          <h2>Service management</h2>
        </div>
        <button type="button" className="primary-button" onClick={openCreateForm}>Create service<ArrowRight size={16} /></button>
      </div>

      {formOpen && (
        <section className="admin-panel service-form-panel">
          <div className="section-heading"><div><p className="eyebrow">{editingId ? 'EDIT' : 'NEW'}</p><h2>{editingId ? 'Edit service' : 'Create service'}</h2></div></div>
          <form className="service-form" onSubmit={submitForm} noValidate>
            <div className="form-grid">
              <div className="field">
                <label htmlFor="service-name">Service name</label>
                <input id="service-name" name="name" value={values.name} onChange={updateField} aria-invalid={Boolean(errors.name)} />
                {errors.name && <span className="field-error">{errors.name}</span>}
              </div>
              <div className="field">
                <label htmlFor="service-category">Category</label>
                <input id="service-category" name="category" value={values.category} onChange={updateField} aria-invalid={Boolean(errors.category)} />
                {errors.category && <span className="field-error">{errors.category}</span>}
              </div>
              <div className="field full-width">
                <label htmlFor="service-location">Location</label>
                <input id="service-location" name="location" value={values.location} onChange={updateField} aria-invalid={Boolean(errors.location)} />
                {errors.location && <span className="field-error">{errors.location}</span>}
              </div>
              <div className="field">
                <label htmlFor="service-openUntil">Open until</label>
                <input id="service-openUntil" name="openUntil" value={values.openUntil} onChange={updateField} aria-invalid={Boolean(errors.openUntil)} />
                {errors.openUntil && <span className="field-error">{errors.openUntil}</span>}
              </div>
              <div className="field">
                <label htmlFor="service-averageMinutes">Average wait (min)</label>
                <input id="service-averageMinutes" type="number" min="1" name="averageMinutes" value={values.averageMinutes} onChange={updateField} aria-invalid={Boolean(errors.averageMinutes)} />
                {errors.averageMinutes && <span className="field-error">{errors.averageMinutes}</span>}
              </div>
              <div className="field">
                <label htmlFor="service-waiting">People waiting</label>
                <input id="service-waiting" type="number" min="0" name="waiting" value={values.waiting} onChange={updateField} aria-invalid={Boolean(errors.waiting)} />
                {errors.waiting && <span className="field-error">{errors.waiting}</span>}
              </div>
            </div>
            <label className="toggle-row">
              <input type="checkbox" name="isOpen" checked={values.isOpen} onChange={updateField} />
              <span>Open now</span>
            </label>
            <div className="form-actions">
              <button type="button" className="text-button" onClick={resetForm}>Cancel</button>
              <button type="submit" className="primary-button">{editingId ? 'Save changes' : 'Create service'}</button>
            </div>
          </form>
        </section>
      )}

      <section className="admin-panel">
        <div className="section-heading"><div><p className="eyebrow">CATALOG</p><h2>Current services</h2></div></div>
        <div className="admin-service-list">
          {services.map(service => (
            <article className="admin-service-item" key={service.id}>
              <div className="admin-service-copy">
                <div className="admin-card-header">
                  <span className={`status-pill ${service.isOpen === false ? 'closed' : 'open'}`}>{service.isOpen === false ? 'Closed' : 'Open'}</span>
                  <strong>{service.name}</strong>
                </div>
                <p>{service.category} · {service.location}</p>
                <div className="admin-card-meta">
                  <span><Users size={15} />{service.waiting} waiting</span>
                  <span><Clock3 size={15} />{service.averageMinutes} min average</span>
                </div>
              </div>
              <div className="admin-service-actions">
                <button type="button" className="text-button" onClick={() => openEditForm(service)}>Edit</button>
                <button type="button" className="secondary-button" onClick={() => onToggleService(service.id)}>{service.isOpen === false ? 'Open queue' : 'Close queue'}</button>
                <button type="button" className="danger-button" onClick={() => onDeleteService(service.id)}>Delete</button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
