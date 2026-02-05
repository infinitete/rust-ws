export type ClientMessage =
  | { type: 'JOIN'; username: string }
  | { type: 'CHAT'; content: string };

export type ServerMessage =
  | { type: 'USER_JOINED'; username: string; users: string[] }
  | { type: 'USER_LEFT'; username: string; users: string[] }
  | { type: 'CHAT'; username: string; content: string; timestamp: string }
  | { type: 'ERROR'; message: string };

export interface ChatMessage {
  id: string;
  username: string;
  content: string;
  timestamp: Date;
  isSystem?: boolean;
}

export interface ConnectionState {
  isConnected: boolean;
  username: string | null;
}
