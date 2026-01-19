import { useEffect, useRef, useCallback } from 'react';
import { getAuth } from 'firebase/auth';
import { WEBSOCKET_URL } from '@/constants/admin/adminConstants';

// Get or create a stable client UUID for this browser
function getOrCreateClientUUID() {
  const STORAGE_KEY = 'surreal_client_uuid';
  let uuid = localStorage.getItem(STORAGE_KEY);
  if (!uuid) {
    uuid = crypto.randomUUID();
    localStorage.setItem(STORAGE_KEY, uuid);
  }
  return uuid;
}

// Get stored device ID if registered
function getStoredDeviceId() {
  return localStorage.getItem('surreal_device_id');
}

// Check if page was remotely refreshed (and clear the flag)
export function checkRemoteRefresh() {
  const wasRefreshed = sessionStorage.getItem('surreal_remote_refresh') === 'true';
  if (wasRefreshed) {
    sessionStorage.removeItem('surreal_remote_refresh');
  }
  return wasRefreshed;
}

/**
 * Hook for real-time order updates via WebSocket
 * @param {Function} onNewOrder - Callback when a new order arrives
 * @param {Object} options - Additional options
 * @param {boolean} options.enabled - Whether to connect (default: true)
 * @param {Function} options.onConnectionsUpdated - Callback when connections change
 */
export function useOrdersWebSocket(onNewOrder, options = {}) {
  const { enabled = true, onConnectionsUpdated } = typeof options === 'boolean'
    ? { enabled: options }
    : options;

  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const pingIntervalRef = useRef(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;

  // Track active subscriptions so we can re-subscribe on reconnect
  const activeSubscriptionsRef = useRef(new Set());

  // Use refs for callbacks to avoid reconnecting when they change
  const onNewOrderRef = useRef(onNewOrder);
  const onConnectionsUpdatedRef = useRef(onConnectionsUpdated);
  useEffect(() => {
    onNewOrderRef.current = onNewOrder;
  }, [onNewOrder]);
  useEffect(() => {
    onConnectionsUpdatedRef.current = onConnectionsUpdated;
  }, [onConnectionsUpdated]);

  // Helper to send all active subscriptions
  const sendActiveSubscriptions = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      activeSubscriptionsRef.current.forEach(topic => {
        console.log('[WebSocket] Sending subscription for:', topic);
        wsRef.current.send(JSON.stringify({ action: 'subscribe', topic }));
      });
    }
  }, []);

  const connect = useCallback(() => {
    if (!enabled || !WEBSOCKET_URL || WEBSOCKET_URL.includes('YOUR_WEBSOCKET')) {
      console.log('[WebSocket] Not configured or disabled');
      return;
    }

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    // Also check if we're already connecting
    if (wsRef.current?.readyState === WebSocket.CONNECTING) {
      console.log('[WebSocket] Already connecting, skipping...');
      return;
    }

    console.log('[WebSocket] Connecting to:', WEBSOCKET_URL);

    try {
      wsRef.current = new WebSocket(WEBSOCKET_URL);

      wsRef.current.onopen = () => {
        console.log('[WebSocket] Connected');
        reconnectAttempts.current = 0;

        // Send identification message with clientUUID, deviceId, and Firebase user info
        const clientUUID = getOrCreateClientUUID();
        const deviceId = getStoredDeviceId();
        const auth = getAuth();
        const user = auth.currentUser;
        const identifyMessage = {
          action: 'identify',
          clientUUID,
          deviceId,
          userAgent: navigator.userAgent,
          // Include Firebase user info if logged in
          userEmail: user?.email || null,
          userName: user?.displayName || null,
        };
        console.log('[WebSocket] Sending identify:', identifyMessage);
        wsRef.current.send(JSON.stringify(identifyMessage));

        // Re-send any active subscriptions after connecting/reconnecting
        sendActiveSubscriptions();

        // Start ping interval to keep connection alive (AWS API Gateway has 10-min idle timeout)
        // Ping every 5 minutes
        if (pingIntervalRef.current) {
          clearInterval(pingIntervalRef.current);
        }
        pingIntervalRef.current = setInterval(() => {
          if (wsRef.current?.readyState === WebSocket.OPEN) {
            console.log('[WebSocket] Sending ping...');
            wsRef.current.send(JSON.stringify({ action: 'ping' }));
          }
        }, 5 * 60 * 1000); // 5 minutes
      };

      wsRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          // Don't log pong messages to reduce noise
          if (data.type !== 'pong') {
            console.log('[WebSocket] Message received:', data);
          }

          if (data.type === 'new_order' && onNewOrderRef.current) {
            onNewOrderRef.current(data.order);
          }

          // Handle connections updated (device connected/disconnected/identified)
          if (data.type === 'connections_updated' && onConnectionsUpdatedRef.current) {
            onConnectionsUpdatedRef.current();
          }

          // Handle remote commands
          if (data.type === 'command') {
            console.log('[WebSocket] Command received:', data.command);
            if (data.command === 'refresh') {
              console.log('[WebSocket] Refreshing page...');
              // Set flag so we can show a message after reload
              sessionStorage.setItem('surreal_remote_refresh', 'true');
              window.location.reload();
            }
          }
        } catch (error) {
          console.error('[WebSocket] Failed to parse message:', error);
        }
      };

      wsRef.current.onclose = (event) => {
        console.log('[WebSocket] Disconnected:', event.code, event.reason);

        // Clear ping interval
        if (pingIntervalRef.current) {
          clearInterval(pingIntervalRef.current);
          pingIntervalRef.current = null;
        }

        // Attempt to reconnect with exponential backoff
        if (enabled && reconnectAttempts.current < maxReconnectAttempts) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
          console.log(`[WebSocket] Reconnecting in ${delay}ms...`);
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttempts.current++;
            connect();
          }, delay);
        }
      };

      wsRef.current.onerror = (error) => {
        console.error('[WebSocket] Error:', error);
      };
    } catch (error) {
      console.error('[WebSocket] Failed to create connection:', error);
    }
  }, [enabled, sendActiveSubscriptions]);

  const disconnect = useCallback(() => {
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
  }, []);

  useEffect(() => {
    connect();

    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  // Subscribe to a topic (e.g., 'connections' for device management updates)
  const subscribe = useCallback((topic) => {
    // Add to active subscriptions set
    activeSubscriptionsRef.current.add(topic);

    // Send immediately if connected
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      console.log('[WebSocket] Subscribing to:', topic);
      wsRef.current.send(JSON.stringify({ action: 'subscribe', topic }));
    } else {
      console.log('[WebSocket] Queued subscription for:', topic, '(will send when connected)');
    }
  }, []);

  // Unsubscribe from a topic
  const unsubscribe = useCallback((topic) => {
    // Remove from active subscriptions set
    activeSubscriptionsRef.current.delete(topic);

    // Send immediately if connected
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      console.log('[WebSocket] Unsubscribing from:', topic);
      wsRef.current.send(JSON.stringify({ action: 'unsubscribe', topic }));
    }
  }, []);

  return {
    isConnected: wsRef.current?.readyState === WebSocket.OPEN,
    reconnect: connect,
    disconnect,
    subscribe,
    unsubscribe,
  };
}
