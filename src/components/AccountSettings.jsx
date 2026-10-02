import { useState } from 'react';
import { CheckCircle2, Save } from 'lucide-react';
import FormField from './FormField.jsx';
import { getUserProfile, notifyProfileUpdated } from '../userProfile.js';

function validateSettings(values) {
  const errors = {};
  const displayName = values.displayName.trim();
  const email = values.email.trim();
  const hasPassword = Boolean(values.newPassword || values.confirmPassword);

  if (!displayName) errors.displayName = 'Display name is required.';
  else if (displayName.length > 60) errors.displayName = 'Display name must be 60 characters or fewer.';

  if (!email) errors.email = 'Email address is required.';
  else if (email.length > 254) errors.email = 'Email must be 254 characters or fewer.';
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'Enter a valid email address.';

  if (hasPassword) {
    if (!values.newPassword) errors.newPassword = 'Enter a new password.';
    else if (values.newPassword.length < 8) errors.newPassword = 'Use at least 8 characters.';
    else if (values.newPassword.length > 128) errors.newPassword = 'Use 128 characters or fewer.';
    if (!values.confirmPassword) errors.confirmPassword = 'Confirm your new password.';
    else if (values.confirmPassword !== values.newPassword) errors.confirmPassword = 'Passwords do not match.';
  }

  return errors;
}

export default function AccountSettings({ email }) {
  const [savedProfile, setSavedProfile] = useState(() => getUserProfile(email));
  const [values, setValues] = useState(() => ({
    ...getUserProfile(email),
    newPassword: '',
    confirmPassword: '',
  }));
  const [errors, setErrors] = useState({});
  const [feedback, setFeedback] = useState(null);

  function change(event) {
    const { name, value } = event.target;
    setValues(current => ({ ...current, [name]: value }));
    setErrors(current => ({ ...current, [name]: undefined }));
    setFeedback(null);
  }

  function submit(event) {
    event.preventDefault();
    const nextErrors = validateSettings(values);
    setErrors(nextErrors);
    setFeedback(null);
    if (Object.keys(nextErrors).length) return;

    try {
      localStorage.setItem(`queuesmart-account-settings:${email.toLowerCase()}`, JSON.stringify({
        displayName: values.displayName.trim(),
        email: values.email.trim(),
      }));
      const nextProfile = { displayName: values.displayName.trim(), email: values.email.trim() };
      setSavedProfile(nextProfile);
      const passwordEntered = Boolean(values.newPassword || values.confirmPassword);
      setValues(current => ({ ...current, displayName: current.displayName.trim(), email: current.email.trim(), newPassword: '', confirmPassword: '' }));
      setFeedback({ type: 'success', message: passwordEntered ? 'Profile saved on this device. Password changes are demo-only and were not stored.' : 'Profile saved on this device. Your password was not changed.' });
      notifyProfileUpdated();
    } catch {
      setFeedback({ type: 'error', message: 'Settings could not be saved in this browser. Please try again.' });
    }
  }

  const hasChanges = values.displayName.trim() !== savedProfile.displayName
    || values.email.trim() !== savedProfile.email
    || Boolean(values.newPassword || values.confirmPassword);

  return (
    <section className="account-settings-card">
      <div className="account-settings-header">
        <h2>Personal information</h2>
        <p>Update the profile details shown in this demo. Changes are saved only in this browser.</p>
      </div>
      <form onSubmit={submit} noValidate>
        <div className="account-settings-fields">
          <FormField label="Display name" id="displayName" name="displayName" type="text" autoComplete="name" maxLength={60} placeholder="Your name" value={values.displayName} onChange={change} error={errors.displayName} required />
          <FormField label="Email address" id="settingsEmail" name="email" type="email" autoComplete="email" maxLength={254} placeholder="you@example.com" value={values.email} onChange={change} error={errors.email} required />
        </div>
        <div className="account-settings-password">
          <div className="account-settings-header">
            <h2>Change password</h2>
            <p>Optional. Leave both fields blank to keep the current password. Passwords are not stored or changed in this demo.</p>
          </div>
          <div className="account-settings-fields">
            <FormField label="New password" id="newPassword" name="newPassword" type="password" autoComplete="new-password" maxLength={128} placeholder="At least 8 characters" value={values.newPassword} onChange={change} error={errors.newPassword} />
            <FormField label="Confirm new password" id="confirmNewPassword" name="confirmPassword" type="password" autoComplete="new-password" maxLength={128} placeholder="Re-enter new password" value={values.confirmPassword} onChange={change} error={errors.confirmPassword} />
          </div>
        </div>
        <div className="account-settings-actions">
          <button type="submit" className="primary-button" disabled={!hasChanges}><Save size={16} />Save changes</button>
          {feedback && <p className={`settings-feedback ${feedback.type}`} role="status">{feedback.type === 'success' && <CheckCircle2 size={17} />}{feedback.message}</p>}
        </div>
      </form>
    </section>
  );
}
