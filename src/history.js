import { useEffect, useState } from 'react';
import { getUserHistory } from './api.js';

export const historyOutcomes = {
  served: { label: 'Served', description: 'You reached the front and were helped.' },
  left: { label: 'Left queue', description: 'You left before being served.' },
  removed: { label: 'Removed', description: 'An administrator removed you from the queue.' },
};

// Loads the signed-in user's participation history from GET /api/users/:userId/history.
// The server records every visit when it ends, so this page only reads.
export function useHistory(session) {
  const [state, setState] = useState({ history: [], loading: true, error: '' });

  useEffect(() => {
    let cancelled = false;
    getUserHistory(session.id, session.token)
      .then(history => !cancelled && setState({ history, loading: false, error: '' }))
      .catch(error => !cancelled && setState({ history: [], loading: false, error: error.message }));
    return () => { cancelled = true; };
  }, [session.id, session.token]);

  return state;
}
