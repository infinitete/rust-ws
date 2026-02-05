import { useState, useEffect, useRef, useCallback } from 'react';
import useWebSocket, { ReadyState } from 'react-use-websocket';
import { ServerMessage, ClientMessage, ChatMessage } from '../types';

const WS_URL = 'ws://localhost:8080';

export const useChat = (username: string | null) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [users, setUsers] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const processedMessages = useRef<Set<string>>(new Set());
  const hasJoined = useRef(false);

  const { sendMessage, lastMessage, readyState } = useWebSocket(
    username ? WS_URL : null,
    {
      shouldReconnect: () => true,
      reconnectAttempts: 10,
      reconnectInterval: 3000,
      onOpen: () => {
        if (username && !hasJoined.current) {
          const joinMsg: ClientMessage = { type: 'JOIN', username };
          sendMessage(JSON.stringify(joinMsg));
          hasJoined.current = true;
        }
      },
      onClose: () => {
        hasJoined.current = false;
      },
    }
  );

  const isConnected = readyState === ReadyState.OPEN;

  const sendChat = useCallback((content: string) => {
    if (isConnected && content.trim()) {
      const chatMsg: ClientMessage = { type: 'CHAT', content: content.trim() };
      sendMessage(JSON.stringify(chatMsg));
    }
  }, [sendMessage, isConnected]);

  useEffect(() => {
    if (lastMessage?.data) {
      try {
        const msg = JSON.parse(lastMessage.data) as ServerMessage;

        if (msg.type === 'USER_JOINED') {
          setUsers(msg.users);
          const systemMsg: ChatMessage = {
            id: `join-${msg.username}-${Date.now()}`,
            username: 'System',
            content: `${msg.username} joined the chat`,
            timestamp: new Date(),
            isSystem: true,
          };
          setMessages(prev => [...prev, systemMsg]);
        } else if (msg.type === 'USER_LEFT') {
          setUsers(msg.users);
          const systemMsg: ChatMessage = {
            id: `leave-${msg.username}-${Date.now()}`,
            username: 'System',
            content: `${msg.username} left the chat`,
            timestamp: new Date(),
            isSystem: true,
          };
          setMessages(prev => [...prev, systemMsg]);
        } else if (msg.type === 'CHAT') {
          const msgId = `${msg.username}-${msg.timestamp}-${msg.content.slice(0, 20)}`;
          if (!processedMessages.current.has(msgId)) {
            processedMessages.current.add(msgId);
            const chatMsg: ChatMessage = {
              id: msgId,
              username: msg.username,
              content: msg.content,
              timestamp: new Date(parseInt(msg.timestamp) * 1000),
            };
            setMessages(prev => [...prev, chatMsg]);
          }
        } else if (msg.type === 'ERROR') {
          console.error('Server error:', msg.message);
        }
      } catch (e) {
        console.error('Failed to parse message:', e);
      }
    }
  }, [lastMessage]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return {
    messages,
    users,
    isConnected,
    sendChat,
    messagesEndRef,
  };
};
