/**
 * NotificationContext — Fetches and manages on-site notifications for the consumer storefront.
 *
 * Fetches active notifications from analytics-api (public, no auth).
 * Tracks dismissed notifications in localStorage.
 * Re-fetches when the visitor's segment changes.
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useSegment } from '@/contexts/commerce/SegmentContext';
import { useWebSocket } from '@/contexts/commerce/WebSocketContext';

const NotificationContext = createContext({
  notifications: [],
  dismissNotification: () => {},
});

export const useNotifications = () => useContext(NotificationContext);

const ANALYTICS_API_URL = import.meta.env.VITE_ANALYTICS_API_URL || 'https://jkvxu5q42hr5obu5tezrn4jg6a0uyqms.lambda-url.us-east-1.on.aws';
const DISMISSED_KEY = 'surrealDismissedNotifications';

function loadDismissed() {
  try {
    return JSON.parse(localStorage.getItem(DISMISSED_KEY)) || [];
  } catch {
    return [];
  }
}

function saveDismissed(ids) {
  try {
    localStorage.setItem(DISMISSED_KEY, JSON.stringify(ids));
  } catch { /* quota exceeded — non-critical */ }
}

export const NotificationProvider = ({ children }) => {
  const { currentSegment } = useSegment();
  const { onMessage: onWsMessage } = useWebSocket();
  const [notifications, setNotifications] = useState([]);
  const [dismissed, setDismissed] = useState(loadDismissed);

  const segmentId = currentSegment?.segmentId || null;

  // Fetch active notifications
  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const resp = await fetch(ANALYTICS_API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'getActiveNotifications', segmentId }),
        });
        const data = await resp.json();
        setNotifications(data.notifications || []);
      } catch (err) {
        console.warn('[NotificationContext] Failed to fetch notifications:', err.message);
      }
    };

    fetchNotifications();
  }, [segmentId]);

  // Live-push: append new notifications received via WebSocket
  useEffect(() => {
    if (!onWsMessage) return undefined;
    return onWsMessage((type, data) => {
      if (type === 'notification' && data?.notificationId) {
        setNotifications(prev => {
          if (prev.some(n => n.notificationId === data.notificationId)) return prev;
          // Honor segment targeting client-side as a defense-in-depth
          if (data.targetSegmentId && segmentId && data.targetSegmentId !== segmentId) return prev;
          return [...prev, data];
        });
      }
    });
  }, [onWsMessage, segmentId]);

  // Filter out dismissed
  const visibleNotifications = useMemo(() =>
    notifications.filter(n => !dismissed.includes(n.notificationId)),
    [notifications, dismissed]
  );

  const dismissNotification = useCallback((notificationId) => {
    setDismissed(prev => {
      const updated = [...prev, notificationId];
      saveDismissed(updated);
      return updated;
    });
  }, []);

  const value = useMemo(() => ({
    notifications: visibleNotifications,
    dismissNotification,
  }), [visibleNotifications, dismissNotification]);

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};
