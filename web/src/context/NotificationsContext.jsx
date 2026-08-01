import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api.js';
import { useAuth } from './AuthContext.jsx';

const NotificationsContext = createContext(null);
const POLL_MS = 60_000;

export function NotificationsProvider({ children }) {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!user) {
      setItems([]);
      setUnreadCount(0);
      return;
    }
    setLoading(true);
    try {
      const { notifications, unreadCount: unread } = await api.notifications();
      setItems(notifications);
      setUnreadCount(unread);
    } catch {
      /* offline or signed out — keep whatever we had */
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    refresh();
    if (!user) return undefined;
    const timer = setInterval(refresh, POLL_MS);
    return () => clearInterval(timer);
  }, [refresh, user]);

  const markRead = useCallback(
    async (id) => {
      setItems((current) => current.map((n) => (n.id === id ? { ...n, read: true } : n)));
      setUnreadCount((count) => Math.max(0, count - 1));
      await api.markRead(id).catch(() => refresh());
    },
    [refresh],
  );

  const markAllRead = useCallback(async () => {
    setItems((current) => current.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
    await api.markAllRead().catch(() => refresh());
  }, [refresh]);

  const value = useMemo(
    () => ({ items, unreadCount, loading, refresh, markRead, markAllRead }),
    [items, unreadCount, loading, refresh, markRead, markAllRead],
  );

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export function useNotifications() {
  const context = useContext(NotificationsContext);
  if (!context) throw new Error('useNotifications must be used inside <NotificationsProvider>');
  return context;
}
