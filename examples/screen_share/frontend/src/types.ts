export type ClientMessage =
  | { type: 'JOIN'; username: string; room_id: string }
  | { type: 'START_SHARING' }
  | { type: 'STOP_SHARING' }
  | { type: 'REQUEST_OFFER'; to: string }
  | { type: 'OFFER'; to: string; sdp: string }
  | { type: 'ANSWER'; to: string; sdp: string }
  | { type: 'ICE_CANDIDATE'; to: string; candidate: string };

export type ServerMessage =
  | { type: 'JOINED'; username: string; room_id: string; users: UserInfo[] }
  | { type: 'USER_JOINED'; username: string; users: UserInfo[] }
  | { type: 'USER_LEFT'; username: string; users: UserInfo[] }
  | { type: 'SHARING_STARTED'; username: string }
  | { type: 'SHARING_STOPPED'; username: string }
  | { type: 'REQUEST_OFFER'; from: string }
  | { type: 'OFFER'; from: string; sdp: string }
  | { type: 'ANSWER'; from: string; sdp: string }
  | { type: 'ICE_CANDIDATE'; from: string; candidate: string }
  | { type: 'ERROR'; message: string };

export interface UserInfo {
  username: string;
  is_sharing: boolean;
}

export interface PeerState {
  username: string;
  connection: RTCPeerConnection;
  stream: MediaStream | null;
}

export interface RoomState {
  users: UserInfo[];
  localStream: MediaStream | null;
  isSharing: boolean;
  peers: Map<string, PeerState>;
}

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';
