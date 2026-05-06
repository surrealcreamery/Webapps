/**
 * WebSocketContext — Surreal Commerce Protocol v1 client wrapper
 *
 * Wraps useCommerceWebSocket and exposes a unified API for child contexts/components:
 *   - hydrate-on-identify: replays active promos, notifications, and pending nudges
 *   - subscribe/unsubscribe to topics
 *   - send arbitrary actions
 *   - tracks active flash promos, server-pushed notifications, and admin nudges
 *   - persists dismissed notification ids in localStorage
 *
 * Detects logged-in customerId from `sessionStorage.accountSession` and
 * re-identifies the socket when the customer logs in / out (storage event).
 */

import React, {
  createContext, useContext, useState, useEffect, useCallback, useMemo, useRef,
} from 'react';
import { useCommerceWebSocket } from '@/hooks/useCommerceWebSocket';

const SESSION_KEY = 'accountSession';
const DISMISSED_KEY = 'surrealDismissedNotifications';
const SEEN_NUDGES_KEY = 'surrealSeenNudges';

function readCustomerIdFromSession() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.customerId || null;
  } catch {
    return null;
  }
}

function loadDismissed() {
  try { return JSON.parse(localStorage.getItem(DISMISSED_KEY)) || []; } catch { return []; }
}
function saveDismissed(ids) {
  try { localStorage.setItem(DISMISSED_KEY, JSON.stringify(ids)); } catch { /* ignore */ }
}

const WebSocketContext = createContext({
  isConnected: false,
  notifications: [],
  flashPromos: [],
  activeNudge: null,
  pushedPromos: [],
  subscribe: () => {},
  unsubscribe: () => {},
  send: () => {},
  sendCheckoutStarted: () => {},
  sendCheckoutStepChanged: () => {},
  sendCheckoutResumed: () => {},
  sendCheckoutEnded: () => {},
  sendProductView: () => {},
  sendNudgeAction: () => {},
  setCustomerTraits: () => {},
  dismissNotification: () => {},
  dismissNudge: () => {},
  onMessage: () => () => {},
});

export const useWebSocket = () => useContext(WebSocketContext);

export const WebSocketProvider = ({ children, enabled = true }) => {
  const [customerId, setCustomerId] = useState(() => readCustomerIdFromSession());
  // Customer traits (email/name/phone) learned during checkout. Sent with the
  // next WS identify so the server can back-fill CHECKOUT_STATE records and
  // show the customer in admin Audiences → Checkout Stalls.
  const [customerTraits, setCustomerTraits] = useState(null);

  // Server-pushed state
  const [serverNotifications, setServerNotifications] = useState([]); // from hydrate + push
  const [flashPromos, setFlashPromos] = useState([]);
  const [pushedPromos, setPushedPromos] = useState([]); // visitor-targeted promo_pushed
  const [activeNudge, setActiveNudge] = useState(null); // most recent unhandled admin_nudge
  const [dismissed, setDismissed] = useState(loadDismissed);

  // Subscribers registered via onMessage()
  const listenersRef = useRef(new Set());

  // Watch sessionStorage for login/logout (other tabs + same tab via interval fallback)
  useEffect(() => {
    const sync = () => {
      const next = readCustomerIdFromSession();
      setCustomerId(prev => (prev === next ? prev : next));
    };
    window.addEventListener('storage', sync);
    // Same-tab updates: poll lightly (sessionStorage doesn't fire storage event in same tab)
    const interval = setInterval(sync, 5000);
    return () => {
      window.removeEventListener('storage', sync);
      clearInterval(interval);
    };
  }, []);

  // Handle envelope-level messages by type
  const handleMessage = useCallback((type, data, envelope) => {
    switch (type) {
      case 'hydrate': {
        if (Array.isArray(data?.notifications)) setServerNotifications(data.notifications);
        if (Array.isArray(data?.promos)) setFlashPromos(data.promos);
        if (Array.isArray(data?.nudges) && data.nudges.length > 0) {
          // Show oldest unconfirmed nudge
          setActiveNudge(data.nudges[0]);
        }
        break;
      }
      case 'notification': {
        setServerNotifications(prev => {
          if (prev.some(n => n.notificationId === data.notificationId)) return prev;
          return [...prev, data];
        });
        break;
      }
      case 'flash_promo': {
        setFlashPromos(prev => {
          if (prev.some(p => p.promoId === data.promoId)) return prev;
          return [...prev, data];
        });
        break;
      }
      case 'promo_pushed': {
        setPushedPromos(prev => [...prev, data]);
        break;
      }
      case 'admin_nudge': {
        // Display newest active nudge
        setActiveNudge({ ...data, nudgeId: envelope?.nudgeId || data?.nudgeId });
        break;
      }
      default:
        break;
    }

    // Fan out to listeners
    listenersRef.current.forEach(fn => {
      try { fn(type, data, envelope); } catch (err) { console.warn('[WSContext] listener error:', err); }
    });
  }, []);

  const {
    isConnected,
    send,
    subscribe,
    unsubscribe,
    sendCheckoutStarted,
    sendCheckoutStepChanged,
    sendCheckoutResumed,
    sendCheckoutEnded,
    sendProductView,
    sendNudgeAction,
  } = useCommerceWebSocket({
    enabled,
    customerId,
    customerTraits,
    onMessage: handleMessage,
  });

  // Filter dismissed notifications
  const visibleNotifications = useMemo(
    () => serverNotifications.filter(n => !dismissed.includes(n.notificationId)),
    [serverNotifications, dismissed]
  );

  const dismissNotification = useCallback((notificationId) => {
    setDismissed(prev => {
      if (prev.includes(notificationId)) return prev;
      const updated = [...prev, notificationId];
      saveDismissed(updated);
      return updated;
    });
  }, []);

  const dismissNudge = useCallback(() => {
    setActiveNudge(prev => {
      if (prev?.nudgeId) {
        try { sendNudgeAction(prev.nudgeId, 'dismissed'); } catch { /* ignore */ }
      }
      return null;
    });
  }, [sendNudgeAction]);

  // Allow children (e.g. SegmentContext, CartContext) to listen to specific events
  const onMessage = useCallback((fn) => {
    listenersRef.current.add(fn);
    return () => { listenersRef.current.delete(fn); };
  }, []);

  const value = useMemo(() => ({
    isConnected,
    notifications: visibleNotifications,
    flashPromos,
    pushedPromos,
    activeNudge,
    subscribe,
    unsubscribe,
    send,
    sendCheckoutStarted,
    sendCheckoutStepChanged,
    sendCheckoutResumed,
    sendCheckoutEnded,
    sendProductView,
    sendNudgeAction,
    setCustomerTraits,
    dismissNotification,
    dismissNudge,
    onMessage,
  }), [
    isConnected, visibleNotifications, flashPromos, pushedPromos, activeNudge,
    subscribe, unsubscribe, send,
    sendCheckoutStarted, sendCheckoutStepChanged, sendCheckoutResumed, sendCheckoutEnded,
    sendProductView, sendNudgeAction,
    dismissNotification, dismissNudge, onMessage,
  ]);

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  );
};
