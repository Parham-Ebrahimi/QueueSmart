const sessionKey = 'queuesmart-session';

export function getSession() {
  try {
    const value = JSON.parse(localStorage.getItem(sessionKey));
    return value?.email && ['user', 'admin'].includes(value.role) ? value : null;
  } catch {
    return null;
  }
}

export function saveSession(email, role) {
  const session = { email, role };
  localStorage.setItem(sessionKey, JSON.stringify(session));
  return session;
}

export function clearSession() {
  localStorage.removeItem(sessionKey);
}

export function validateAuth(values, isRegister) {
  const errors = {};
  const email = values.email.trim();

  if (!email) errors.email = 'Email is required.';
  else if (email.length > 254) errors.email = 'Email must be 254 characters or fewer.';
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'Enter a valid email address.';

  if (!values.password) errors.password = 'Password is required.';
  else if (values.password.length < 8) errors.password = 'Use at least 8 characters.';
  else if (values.password.length > 128) errors.password = 'Use 128 characters or fewer.';

  if (isRegister) {
    if (!values.confirmPassword) errors.confirmPassword = 'Confirm your password.';
    else if (values.confirmPassword !== values.password) errors.confirmPassword = 'Passwords do not match.';
  }

  return errors;
}
