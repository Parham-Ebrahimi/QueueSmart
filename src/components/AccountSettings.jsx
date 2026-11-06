import { useEffect, useState } from 'react';
import { CheckCircle2, Save } from 'lucide-react';
import FormField from './FormField.jsx';
import { changePassword, updateProfile } from '../api.js';
import { saveSession } from '../auth.js';

function validateProfile(values) {
  const errors = {};
  const fullName = values.fullName.trim();
  const email = values.email.trim();

  if (!fullName) errors.fullName = 'Full name is required.';
  else if (fullName.length > 100) errors.fullName = 'Full name must be 100 characters or fewer.';

  if (!email) errors.email = 'Email address is required.';
  else if (email.length > 254) errors.email = 'Email must be 254 characters or fewer.';
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'Enter a valid email address.';
  if (values.contact.trim().length > 100) errors.contact = 'Contact must be 100 characters or fewer.';
  return errors;
}

function validatePassword(values) {
  const errors = {};
  if (!values.currentPassword) errors.currentPassword = 'Enter your current password.';
  if (!values.newPassword) errors.newPassword = 'Enter a new password.';
  else if (values.newPassword.length < 8) errors.newPassword = 'Use at least 8 characters.';
  else if (values.newPassword.length > 128) errors.newPassword = 'Use 128 characters or fewer.';
  if (values.confirmPassword !== values.newPassword) errors.confirmPassword = 'Passwords do not match.';
  return errors;
}

export default function AccountSettings({ session, profile, onProfileSaved }) {
  const [values, setValues] = useState({ fullName: profile.displayName, email: profile.email, contact: profile.contact || '' });
  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [profileErrors, setProfileErrors] = useState({});
  const [passwordErrors, setPasswordErrors] = useState({});
  const [profileFeedback, setProfileFeedback] = useState(null);
  const [passwordFeedback, setPasswordFeedback] = useState(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    setValues({ fullName: profile.displayName, email: profile.email, contact: profile.contact || '' });
  }, [profile.displayName, profile.email, profile.contact]);

  function change(event) {
    const { name, value } = event.target;
    setValues(current => ({ ...current, [name]: value }));
    setProfileErrors(current => ({ ...current, [name]: undefined }));
    setProfileFeedback(null);
  }

  async function submitProfile(event) {
    event.preventDefault();
    const nextErrors = validateProfile(values);
    setProfileErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    setSavingProfile(true);
    try {
      const result = await updateProfile(values, session.token);
      saveSession(result);
      onProfileSaved({ displayName: result.profile.fullName, email: result.profile.email, contact: result.profile.contact });
      setProfileFeedback({ type: 'success', message: 'Profile saved.' });
      if (result.profile.email !== session.email) window.location.reload();
    } catch (error) {
      setProfileErrors(error.details || {});
      setProfileFeedback({ type: 'error', message: error.message });
    } finally {
      setSavingProfile(false);
    }
  }

  async function submitPassword(event) {
    event.preventDefault();
    const nextErrors = validatePassword(passwords);
    setPasswordErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    setSavingPassword(true);
    try {
      await changePassword(passwords, session.token);
      setPasswords({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setPasswordFeedback({ type: 'success', message: 'Password updated.' });
    } catch (error) {
      setPasswordErrors(error.details || {});
      setPasswordFeedback({ type: 'error', message: error.message });
    } finally {
      setSavingPassword(false);
    }
  }

  const hasChanges = values.fullName.trim() !== profile.displayName
    || values.email.trim() !== profile.email
    || values.contact.trim() !== (profile.contact || '');

  return (
    <section className="account-settings-card">
      <div className="account-settings-header">
        <h2>Personal information</h2>
      </div>
      <form onSubmit={submitProfile} noValidate>
        <div className="account-settings-fields">
          <FormField label="Full name" id="fullName" name="fullName" type="text" autoComplete="name" maxLength={100} value={values.fullName} onChange={change} error={profileErrors.fullName} required />
          <FormField label="Email address" id="settingsEmail" name="email" type="email" autoComplete="email" maxLength={254} value={values.email} onChange={change} error={profileErrors.email} required />
          <FormField label="Contact (optional)" id="contact" name="contact" type="text" maxLength={100} value={values.contact} onChange={change} error={profileErrors.contact} />
        </div>
        <div className="account-settings-actions">
          <button type="submit" className="primary-button" disabled={!hasChanges || savingProfile}><Save size={16} />Save profile</button>
          {profileFeedback && <p className={`settings-feedback ${profileFeedback.type}`} role="status">{profileFeedback.type === 'success' && <CheckCircle2 size={17} />}{profileFeedback.message}</p>}
        </div>
      </form>
      <div className="account-settings-password">
        <div className="account-settings-header"><h2>Change password</h2></div>
      </div>
      <form onSubmit={submitPassword} noValidate>
        <div className="account-settings-fields">
          <FormField label="Current password" id="currentPassword" name="currentPassword" type="password" autoComplete="current-password" value={passwords.currentPassword} onChange={event => { setPasswords(current => ({ ...current, currentPassword: event.target.value })); setPasswordErrors({}); setPasswordFeedback(null); }} error={passwordErrors.currentPassword} required />
          <FormField label="New password" id="newPassword" name="newPassword" type="password" autoComplete="new-password" maxLength={128} value={passwords.newPassword} onChange={event => { setPasswords(current => ({ ...current, newPassword: event.target.value })); setPasswordErrors({}); setPasswordFeedback(null); }} error={passwordErrors.newPassword} required />
          <FormField label="Confirm new password" id="confirmNewPassword" name="confirmPassword" type="password" autoComplete="new-password" maxLength={128} value={passwords.confirmPassword} onChange={event => { setPasswords(current => ({ ...current, confirmPassword: event.target.value })); setPasswordErrors({}); setPasswordFeedback(null); }} error={passwordErrors.confirmPassword} required />
        </div>
        <div className="account-settings-actions">
          <button type="submit" className="primary-button" disabled={savingPassword}><Save size={16} />Update password</button>
          {passwordFeedback && <p className={`settings-feedback ${passwordFeedback.type}`} role="status">{passwordFeedback.type === 'success' && <CheckCircle2 size={17} />}{passwordFeedback.message}</p>}
        </div>
      </form>
    </section>
  );
}
