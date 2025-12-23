import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';

interface WebSocketMessage {
  type: string;
  data?: any;
  message?: string;
}

export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const queryClient = useQueryClient();
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 5;

  const connect = () => {
    try {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      
      wsRef.current = new WebSocket(wsUrl);

      wsRef.current.onopen = () => {
        console.log('📡 [WEBSOCKET] Connected to real-time updates');
        reconnectAttemptsRef.current = 0;
      };

      wsRef.current.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          console.log('📡 [WEBSOCKET] Received message:', message);

          switch (message.type) {
            case 'MENU_UPDATED':
              // Invalidate menu queries to refresh the data
              queryClient.invalidateQueries({ queryKey: ['/api/amenities/menu'] });
              console.log('🍽️ [WEBSOCKET] Menu updated, refreshing data');
              break;
            case 'CONNECTED':
              console.log('📡 [WEBSOCKET] Welcome:', message.message);
              break;
            default:
              console.log('📡 [WEBSOCKET] Unknown message type:', message.type);
          }
        } catch (error) {
          console.error('📡 [WEBSOCKET] Error parsing message:', error);
        }
      };

      wsRef.current.onclose = () => {
        console.log('📡 [WEBSOCKET] Connection closed');
        
        // Attempt to reconnect with exponential backoff
        if (reconnectAttemptsRef.current < maxReconnectAttempts) {
          const delay = Math.pow(2, reconnectAttemptsRef.current) * 1000; // 1s, 2s, 4s, 8s, 16s
          reconnectAttemptsRef.current++;
          
          console.log(`📡 [WEBSOCKET] Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current}/${maxReconnectAttempts})`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, delay);
        } else {
          console.log('📡 [WEBSOCKET] Max reconnection attempts reached');
        }
      };

      wsRef.current.onerror = (error) => {
        console.error('📡 [WEBSOCKET] Error:', error);
      };

    } catch (error) {
      console.error('📡 [WEBSOCKET] Failed to create connection:', error);
    }
  };

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  return {
    isConnected: wsRef.current?.readyState === WebSocket.OPEN,
    send: (message: any) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify(message));
      }
    }
  };
}