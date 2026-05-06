/**
 * Consumer WebSocket client — Surreal Commerce Protocol v1
 *
 * Connects to the shared API Gateway WebSocket used by admin, kiosk, and consumer.
 * Sends `identify` with role=consumer, visitorId, optional customerId.
 * Auto-handles:
 *   - envelope parsing (v, id, type, topic, data, ack)
 *   - automatic ack reply for ack-required messages
 *   - lastSeenMessageId tracking in sessionStorage
 *   - resume-on-reconnect
 *   - ping keepalive
 *   - exponential backoff reconnect
 *   - visibility-aware heartbeat pause
 *   - BroadcastChannel dedupe for admin_nudge across tabs
 *
 * Exposes an onMessage callback that receives `(type, data, fullEnvelope)` for
 * every non-system message.
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { getVisitorId } from '@/services/eventTracker';

const WEBSOCKET_URL = 'wss://gx86vaqflf.execute-api.us-east-1.amazonaws.com/production';
const PING_INTERVAL_MS = 5 * 60 * 1000;
const MAX_RECONNECT_ATTEMPTS = 10;
const LAST_SEEN_KEY = 'surreal_ws_last_seen';
const NUDGE_CHANNEL = 'surreal-nudges';

function getClientUUID() {
  const KEY = 'surreal_client_uuid';
  let uuid = null;
  try { uuid = localStorage.getItem(KEY); } catch { /* ignore */ }
  if (!uuid) {
    uuid = crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    try { localStorage.setItem(KEY, uuid); } catch { /* ignore */ }
  }
  return uuid;
}

function getLastSeenMessageId() {
  try { return sessionStorage.getItem(LAST_SEEN_KEY); } catch { return null; }
}
function setLastSeenMessageId(id) {
  if (!id) return;
  try { sessionStorage.setItem(LAST_SEEN_KEY, id); } catch { /* ignore */ }
}

/**
 * @param {object} options
 * @param {boolean} options.enabled — connect when true
 * @param {string|null} options.customerId — if logged in, enables cross-device channel
 * @param {object|null} options.customerTraits — optional { email, name, phone } sent with identify
 * @param {function} options.onMessage — (type, data, envelope) =>
 */
export function useCommerceWebSocket({ enabled = true, customerId = null, customerTraits = null, onMessage } = {}) {
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const pingIntervalRef = useRef(null);
  const reconnectAttempts = useRef(0);
  const intentionalClose = useRef(false);
  const broadcastChannelRef = useRef(null);
  const seenNudgeIdsRef = useRef(new Set());
  const onMessageRef = useRef(onMessage);
  const customerIdRef = useRef(customerId);
  const customerTraitsRef = useRef(customerTraits);
  const enabledRef = useRef(enabled);
  const identifiedRef = useRef(false);

  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => { onMessageRef.current = onMessage; }, [onMessage]);
  useEffect(() => { customerIdRef.current = customerId; }, [customerId]);
  useEffect(() => { customerTraitsRef.current = customerTraits; }, [customerTraits]);
  useEffect(() => { enabledRef.current = enabled; }, [enabled]);

  // Re-identify if customerId OR traits change mid-session (user logs in or
  // completes the pickup contact form). This is how email/name/phone get
  // back-filled onto the CHECKOUT_STATE record so admins see the customer in
  // the Checkout Stalls table.
  const traitsKey = customerTraits ? `${customerTraits.email || ''}|${customerTraits.name || ''}|${customerTraits.phone || ''}` : '';
  useEffect(() => {
    if (identifiedRef.current && wsRef.current?.readyState === WebSocket.OPEN) {
      sendIdentify();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId, traitsKey]);

  const send = useCallback((payload) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(typeof payload === 'string' ? payload : JSON.stringify(payload));
      return true;
    }
    return false;
  }, []);

  const sendIdentify = useCallback(() => {
    const visitorId = getVisitorId();
    const clientUUID = getClientUUID();
    const traits = customerTraitsRef.current || {};
    send({
      action: 'identify',
      role: 'consumer',
      visitorId,
      customerId: customerIdRef.current || null,
      clientUUID,
      userEmail: traits.email || null,
      userName: traits.name || null,
      userPhone: traits.phone || null,
      userAgent: navigator.userAgent,
    });
    identifiedRef.current = true;
  }, [send]);

  const sendAck = useCallback((ackOf) => {
    send({ action: 'ack', ackOf });
  }, [send]);

  const subscribe = useCallback((topics) => {
    const arr = Array.isArray(topics) ? topics : [topics];
    send({ action: 'subscribe', topics: arr });
  }, [send]);

  const unsubscribe = useCallback((topics) => {
    const arr = Array.isArray(topics) ? topics : [topics];
    send({ action: 'unsubscribe', topics: arr });
  }, [send]);

  // ─── Event-driven checkout state tracking ───
  // Server computes dwellMs server-side from stepEnteredAt, so the client
  // only needs to announce lifecycle events. No more 30s polling.
  //
  // IMPORTANT: we include visitorId in every message so the server doesn't
  // have to read it from the CONNECTIONS table. That read races with
  // `handleIdentify` (which does a table scan before writing the row) and on
  // iPhone's slower/unstable network the race is often lost → stall never
  // gets created.
  const sendCheckoutStarted = useCallback(({ step, cartId, cartTotal }) => {
    return send({ action: 'checkout_started', step, cartId, cartTotal, visitorId: getVisitorId() });
  }, [send]);

  const sendCheckoutStepChanged = useCallback(({ step, cartId, cartTotal }) => {
    return send({ action: 'checkout_step_changed', step, cartId, cartTotal, visitorId: getVisitorId() });
  }, [send]);

  const sendCheckoutResumed = useCallback(({ step, cartId, cartTotal } = {}) => {
    send({ action: 'checkout_resumed', step, cartId, cartTotal, visitorId: getVisitorId() });
  }, [send]);

  const sendCheckoutEnded = useCallback(() => {
    send({ action: 'checkout_ended', visitorId: getVisitorId() });
  }, [send]);

  const sendProductView = useCallback((productId, categoryId) => {
    send({ action: 'product_view', productId, categoryId });
  }, [send]);

  const sendNudgeAction = useCallback((nudgeId, action) => {
    send({ action: 'nudge_action', nudgeId, action });
  }, [send]);

  // Handle an incoming envelope
  const handleEnvelope = useCallback((envelope) => {
    const { id, type, data, ack, nudgeId } = envelope;
    if (id) setLastSeenMessageId(id);

    // Auto-ack critical messages
    if (ack && id) sendAck(id);

    // Dedupe admin_nudge across tabs via BroadcastChannel
    if (type === 'admin_nudge' && nudgeId) {
      if (seenNudgeIdsRef.current.has(nudgeId)) return;
      seenNudgeIdsRef.current.add(nudgeId);
      if (broadcastChannelRef.current) {
        // Announce we have claimed this nudge
        try { broadcastChannelRef.current.postMessage({ nudgeId, claimed: true }); } catch { /* ignore */ }
      }
    }

    // Dispatch to consumer callback
    onMessageRef.current?.(type, data || {}, envelope);
  }, [sendAck]);

  const connect = useCallback(() => {
    if (!enabledRef.current) return;
    if (wsRef.current?.readyState === WebSocket.OPEN || wsRef.current?.readyState === WebSocket.CONNECTING) return;

    intentionalClose.current = false;

    try {
      wsRef.current = new WebSocket(WEBSOCKET_URL);

      wsRef.current.onopen = () => {
        reconnectAttempts.current = 0;
        setIsConnected(true);

        sendIdentify();

        // Attempt resume with last seen message id
        const lastSeen = getLastSeenMessageId();
        if (lastSeen) {
          send({ action: 'resume', lastSeenMessageId: lastSeen });
        }

        if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = setInterval(() => {
          if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ action: 'ping' }));
          }
        }, PING_INTERVAL_MS);
      };

      wsRef.current.onmessage = (event) => {
        let parsed;
        try { parsed = JSON.parse(event.data); } catch { return; }

        // Ignore system messages
        if (parsed.type === 'pong' || parsed.type === 'identified' ||
            parsed.type === 'subscribed' || parsed.type === 'unsubscribed') return;

        // Protocol v1 envelope?
        if (parsed.v === 1) {
          handleEnvelope(parsed);
        } else {
          // Legacy messages — dispatch type + payload directly
          onMessageRef.current?.(parsed.type, parsed, parsed);
        }
      };

      wsRef.current.onclose = () => {
        setIsConnected(false);
        identifiedRef.current = false;
        if (pingIntervalRef.current) {
          clearInterval(pingIntervalRef.current);
          pingIntervalRef.current = null;
        }
        if (!intentionalClose.current && enabledRef.current && reconnectAttempts.current < MAX_RECONNECT_ATTEMPTS) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttempts.current++;
            connect();
          }, delay);
        }
      };

      wsRef.current.onerror = (err) => {
        console.warn('[CommerceWS] error:', err?.message || err);
      };
    } catch (err) {
      console.warn('[CommerceWS] connect failed:', err.message);
    }
  }, [handleEnvelope, send, sendIdentify]);

  const disconnect = useCallback(() => {
    intentionalClose.current = true;
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }
    if (wsRef.current) {
      try { wsRef.current.close(); } catch { /* ignore */ }
      wsRef.current = null;
    }
    setIsConnected(false);
    identifiedRef.current = false;
  }, []);

  // BroadcastChannel for cross-tab nudge dedupe
  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return;
    const ch = new BroadcastChannel(NUDGE_CHANNEL);
    broadcastChannelRef.current = ch;
    ch.onmessage = (ev) => {
      const { nudgeId, claimed } = ev.data || {};
      if (claimed && nudgeId) {
        seenNudgeIdsRef.current.add(nudgeId);
      }
    };
    return () => {
      try { ch.close(); } catch { /* ignore */ }
      broadcastChannelRef.current = null;
    };
  }, []);

  // Connect / disconnect on enabled change
  useEffect(() => {
    if (enabled) connect(); else disconnect();
    return () => disconnect();
  }, [enabled, connect, disconnect]);

  return {
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
  };
}
