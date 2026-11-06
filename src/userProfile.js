export function getUserProfile(accountEmail) {
  return { displayName: accountEmail.split('@')[0], email: accountEmail };
}
