import { useEffect, useRef, useCallback, useState } from 'react';

const WEBSOCKET_URL = 'wss://gx86vaqflf.execute-api.us-east-1.amazonaws.com/production';

// Get or create a stable client UUID for this browser
function getOrCreateClientUUID() {
  const STORAGE_KEY = 'surreal_client_uuid';
  let uuid = localStorage.getItem(STORAGE_KEY);
  if (!uuid) {
    uuid = crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(STORAGE_KEY, uuid);
  }
  return uuid;
}

/**
 * WebSocket hook for kiosk mode — connects to AWS API Gateway WebSocket
 * for real-time sync with paired POS device.
 */
export function useKioskWebSocket(options = {}) {
  const { enabled = false, deviceId, onViewProduct, onCloseProduct, onCartSync, onCheckoutStatus, onCartRequest, onLocationSync } = options;

  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const pingIntervalRef = useRef(null);
  const reconnectAttempts = useRef(0);
  const intentionalClose = useRef(false);
  const [isConnected, setIsConnected] = useState(false);

  // Use refs for callbacks to avoid reconnecting when they change
  const onViewProductRef = useRef(onViewProduct);
  const onCloseProductRef = useRef(onCloseProduct);
  const onCartSyncRef = useRef(onCartSync);
  const onCheckoutStatusRef = useRef(onCheckoutStatus);
  const onCartRequestRef = useRef(onCartRequest);
  const onLocationSyncRef = useRef(onLocationSync);
  useEffect(() => { onViewProductRef.current = onViewProduct; }, [onViewProduct]);
  useEffect(() => { onCloseProductRef.current = onCloseProduct; }, [onCloseProduct]);
  useEffect(() => { onCartSyncRef.current = onCartSync; }, [onCartSync]);
  useEffect(() => { onCheckoutStatusRef.current = onCheckoutStatus; }, [onCheckoutStatus]);
  useEffect(() => { onCartRequestRef.current = onCartRequest; }, [onCartRequest]);
  useEffect(() => { onLocationSyncRef.current = onLocationSync; }, [onLocationSync]);

  // Store enabled/deviceId in refs so connect/disconnect don't need them as deps
  const enabledRef = useRef(enabled);
  const deviceIdRef = useRef(deviceId);
  enabledRef.current = enabled;
  deviceIdRef.current = deviceId;

  const connect = useCallback(() => {
    if (!enabledRef.current || !deviceIdRef.current) return;
    if (wsRef.current?.readyState === WebSocket.OPEN || wsRef.current?.readyState === WebSocket.CONNECTING) return;

    intentionalClose.current = false;
    console.log('[KioskWS] Connecting...');

    try {
      wsRef.current = new WebSocket(WEBSOCKET_URL);

      wsRef.current.onopen = () => {
        console.log('[KioskWS] Connected');
        reconnectAttempts.current = 0;
        setIsConnected(true);

        // Use a kiosk-specific clientUUID so the server's stale-connection
        // cleanup doesn't kill the consumer or MDM agent connections.
        const kioskUUID = `kiosk-${deviceIdRef.current}`;
        wsRef.current.send(JSON.stringify({
          action: 'identify',
          role: 'kiosk',
          clientUUID: kioskUUID,
          deviceId: deviceIdRef.current,
          userAgent: navigator.userAgent,
        }));

        // Start ping keepalive (5 min)
        if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = setInterval(() => {
          if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ action: 'ping' }));
          }
        }, 5 * 60 * 1000);

        // Request cart state from partner on connect/reconnect
        wsRef.current.send(JSON.stringify({ action: 'forward', type: 'cart_request', payload: {} }));
      };

      wsRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'pong' || data.type === 'identified') return;
          console.log('[KioskWS] Message:', data.type);

          // Handle device commands (refresh, lockout, pairing_updated, etc.)
          if (data.type === 'command') {
            console.log('[KioskWS] Command received:', data.command);
            if (data.command === 'refresh') {
              window.location.reload();
              return;
            }
            if (data.command === 'lockout') {
              localStorage.removeItem('kioskTerminal');
              localStorage.removeItem('surreal_kiosk_device_id');
              window.location.reload();
              return;
            }
            if (data.command === 'pairing_updated') {
              window.location.reload();
              return;
            }
          }

          if (data.type === 'view_product' && onViewProductRef.current) {
            onViewProductRef.current(data.payload, data.fromDeviceId);
          }
          if (data.type === 'close_product' && onCloseProductRef.current) {
            onCloseProductRef.current(data.fromDeviceId);
          }
          if (data.type === 'cart_sync' && onCartSyncRef.current) {
            onCartSyncRef.current(data.payload, data.fromDeviceId);
          }
          if ((data.type === 'checkout_started' || data.type === 'checkout_status') && onCheckoutStatusRef.current) {
            onCheckoutStatusRef.current(data.payload, data.fromDeviceId);
          }
          if (data.type === 'cart_request' && onCartRequestRef.current) {
            onCartRequestRef.current(data.fromDeviceId);
          }
          if (data.type === 'location_sync' && onLocationSyncRef.current) {
            onLocationSyncRef.current(data.payload, data.fromDeviceId);
          }
        } catch (err) {
          console.error('[KioskWS] Parse error:', err);
        }
      };

      wsRef.current.onclose = () => {
        console.log('[KioskWS] Disconnected, intentional:', intentionalClose.current);
        setIsConnected(false);
        if (pingIntervalRef.current) {
          clearInterval(pingIntervalRef.current);
          pingIntervalRef.current = null;
        }
        // Always reconnect unless intentionally closed — never give up
        if (!intentionalClose.current && enabledRef.current) {
          const delay = Math.min(1000 * Math.pow(2, Math.min(reconnectAttempts.current, 6)), 60000);
          console.log(`[KioskWS] Reconnecting in ${delay}ms (attempt ${reconnectAttempts.current + 1})...`);
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttempts.current++;
            connect();
          }, delay);
        }
      };

      wsRef.current.onerror = (err) => {
        console.error('[KioskWS] Error:', err);
      };
    } catch (err) {
      console.error('[KioskWS] Failed to connect:', err);
    }
  }, []); // No deps — uses refs for everything

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
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsConnected(false);
  }, []);

  // Connect/disconnect based on enabled state
  useEffect(() => {
    if (enabled && deviceId) {
      connect();
    } else {
      disconnect();
    }
    return () => disconnect();
  }, [enabled, deviceId, connect, disconnect]);

  // Reconnect immediately when network comes back online
  useEffect(() => {
    if (!enabled || !deviceId) return;
    const handleOnline = () => {
      console.log('[KioskWS] Network online — reconnecting immediately');
      reconnectAttempts.current = 0;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      connect();
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [enabled, deviceId, connect]);

  // Send a forwarded message to the paired POS device
  const sendForward = useCallback((type, payload) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      console.log('[KioskWS] Sending forward:', type, payload);
      wsRef.current.send(JSON.stringify({ action: 'forward', type, payload }));
    } else {
      console.warn('[KioskWS] Cannot send forward, WS not open. readyState:', wsRef.current?.readyState);
    }
  }, []);

  return { isConnected, sendForward, disconnect };
}
