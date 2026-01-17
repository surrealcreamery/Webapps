import { useEffect, useRef, useCallback } from 'react';
import { WEBSOCKET_URL } from '@/constants/admin/adminConstants';

/**
 * Hook for real-time order updates via WebSocket
 * @param {Function} onNewOrder - Callback when a new order arrives
 * @param {boolean} enabled - Whether to connect
 */
export function useOrdersWebSocket(onNewOrder, enabled = true) {
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;

  const connect = useCallback(() => {
    if (!enabled || !WEBSOCKET_URL || WEBSOCKET_URL.includes('YOUR_WEBSOCKET')) {
      console.log('[WebSocket] Not configured or disabled');
      return;
    }

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    console.log('[WebSocket] Connecting to:', WEBSOCKET_URL);

    try {
      wsRef.current = new WebSocket(WEBSOCKET_URL);

      wsRef.current.onopen = () => {
        console.log('[WebSocket] Connected');
        reconnectAttempts.current = 0;
      };

      wsRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('[WebSocket] Message received:', data);

          if (data.type === 'new_order' && onNewOrder) {
            onNewOrder(data.order);
          }
        } catch (error) {
          console.error('[WebSocket] Failed to parse message:', error);
        }
      };

      wsRef.current.onclose = (event) => {
        console.log('[WebSocket] Disconnected:', event.code, event.reason);

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
  }, [enabled, onNewOrder]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
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

  return {
    isConnected: wsRef.current?.readyState === WebSocket.OPEN,
    reconnect: connect,
    disconnect,
  };
}
