export type ClientMessage =
  | { type: 'JOIN'; username: string }
  | { type: 'FILE_OFFER'; to: string; file_id: string; filename: string; size: number; chunk_size: number; checksum: string }
  | { type: 'FILE_ACCEPT'; from: string; file_id: string }
  | { type: 'FILE_REJECT'; from: string; file_id: string }
  | { type: 'FILE_CHUNK_ACK'; file_id: string; chunk_index: number };

export type ServerMessage =
  | { type: 'SERVER_CONFIG'; max_file_size: number; chunk_size: number }
  | { type: 'USER_JOINED'; username: string; users: string[] }
  | { type: 'USER_LEFT'; username: string; users: string[] }
  | { type: 'FILE_OFFER_RECEIVED'; from: string; file_id: string; filename: string; size: number; checksum: string }
  | { type: 'FILE_ACCEPTED'; file_id: string; to: string }
  | { type: 'FILE_REJECTED'; file_id: string }
  | { type: 'FILE_COMPLETE'; file_id: string }
  | { type: 'FILE_ERROR'; file_id: string; error: string }
  | { type: 'ERROR'; message: string };

export interface FileOffer {
  file_id: string;
  from: string;
  filename: string;
  size: number;
  checksum: string;
}

export interface TransferProgress {
  file_id: string;
  filename: string;
  direction: 'upload' | 'download';
  progress: number;
  transferred: number;
  total: number;
  status: 'pending' | 'transferring' | 'verifying' | 'completed' | 'error';
  error?: string;
  blobUrl?: string;
  checksumValid?: boolean;
}
