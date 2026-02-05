import { useState, useCallback, useEffect, useRef } from 'react';
import useWebSocket, { ReadyState } from 'react-use-websocket';
import { ClientMessage, ServerMessage, ConnectionStatus } from '../types';

interface UseSignalingProps {
  username: string;
  roomId: string;
  onMessage: (msg: ServerMessage) => void;
}

export const useSignaling = ({ username, roomId, onMessage }: UseSignalingProps) => {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting');
  
  const onMessageRef = useRef(onMessage);
  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  const { sendMessage: sendRawMessage, lastJsonMessage, readyState } = useWebSocket(
    'ws://localhost:8080',
    {
      shouldReconnect: () => true,
      reconnectAttempts: 10,
      reconnectInterval: 3000,
      onOpen: () => {
        console.log('WebSocket connected');
        setConnectionStatus('connected');
      },
      onClose: () => {
        console.log('WebSocket disconnected');
        setConnectionStatus('disconnected');
      },
      onError: (event) => {
        console.error('WebSocket error:', event);
        setConnectionStatus('error');
      },
    }
  );

  useEffect(() => {
    if (lastJsonMessage) {
      onMessageRef.current(lastJsonMessage as ServerMessage);
    }
  }, [lastJsonMessage]);

  const sendMessage = useCallback((msg: ClientMessage) => {
    sendRawMessage(JSON.stringify(msg));
  }, [sendRawMessage]);

  useEffect(() => {
    if (readyState === ReadyState.OPEN) {
      console.log(`Joining room ${roomId} as ${username}`);
      sendMessage({
        type: 'JOIN',
        username,
        room_id: roomId,
      });
    }
  }, [readyState, username, roomId, sendMessage]);

  return {
    sendMessage,
    connectionStatus,
    readyState
  };
};
