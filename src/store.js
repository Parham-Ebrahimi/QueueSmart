import { useEffect, useState } from 'react';

// Minimal localStorage-backed list store shared by notifications and history.
// Writes broadcast a window event so every mounted component stays in sync.
export function createListStore(storageKey, eventName, seed = () => []) {
  function read() {
    try {
      const value = JSON.parse(localStorage.getItem(storageKey));
      if (Array.isArray(value)) return value;
    } catch {
      // Fall through to the seeded list.
    }
    const seeded = seed();
    localStorage.setItem(storageKey, JSON.stringify(seeded));
    return seeded;
  }

  function write(items) {
    localStorage.setItem(storageKey, JSON.stringify(items));
    window.dispatchEvent(new Event(eventName));
    return items;
  }

  function subscribe(callback) {
    window.addEventListener(eventName, callback);
    window.addEventListener('storage', callback);
    return () => {
      window.removeEventListener(eventName, callback);
      window.removeEventListener('storage', callback);
    };
  }

  function useItems() {
    const [items, setItems] = useState(read);
    useEffect(() => subscribe(() => setItems(read())), []);
    return items;
  }

  return { read, write, subscribe, useItems };
}

export function createId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function formatRelativeTime(isoDate) {
  const diff = Date.now() - new Date(isoDate).getTime();
  const minutes = Math.round(diff / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? 'Yesterday' : `${days} days ago`;
}

export function formatClock(isoDate) {
  return new Date(isoDate).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export function formatDate(isoDate) {
  return new Date(isoDate).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
}
