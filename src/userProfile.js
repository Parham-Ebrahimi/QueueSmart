const profileUpdatedEvent = 'queuesmart-profile-updated';

export function getUserProfile(accountEmail) {
  try {
    const profile = JSON.parse(localStorage.getItem(`queuesmart-account-settings:${accountEmail.toLowerCase()}`));
    if (profile?.displayName && profile?.email) return profile;
  } catch {
    // Fall back to the signed-in mock account values.
  }
  return { displayName: accountEmail.split('@')[0], email: accountEmail };
}

export function notifyProfileUpdated() {
  window.dispatchEvent(new Event(profileUpdatedEvent));
}

export function subscribeToProfileUpdates(callback) {
  window.addEventListener(profileUpdatedEvent, callback);
  return () => window.removeEventListener(profileUpdatedEvent, callback);
}
