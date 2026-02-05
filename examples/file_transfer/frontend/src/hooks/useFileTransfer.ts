import { useState, useCallback, useRef, useEffect } from 'react';
import useWebSocket, { ReadyState } from 'react-use-websocket';
import { ClientMessage, ServerMessage, FileOffer, TransferProgress } from '../types';

const DEFAULT_CHUNK_SIZE = 64 * 1024;
const WS_URL = 'ws://localhost:8081';

function uuidToBytes(uuid: string): Uint8Array {
  const hex = uuid.replace(/-/g, '');
  const bytes = new Uint8Array(16);
  for (let i = 0; i < 16; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return bytes;
}

function bytesToUuid(bytes: Uint8Array): string {
  const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
  return `${hex.substr(0, 8)}-${hex.substr(8, 4)}-${hex.substr(12, 4)}-${hex.substr(16, 4)}-${hex.substr(20)}`;
}

async function computeSHA256(data: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function computeFileSHA256(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  return computeSHA256(buffer);
}

interface ServerConfig {
  maxFileSize: number;
  chunkSize: number;
}

interface DownloadState {
  chunks: Map<number, Blob>;
  receivedBytes: number;
  totalSize: number;
  filename: string;
  expectedChecksum: string;
  expectedChunks: number;
}

interface UseFileTransferReturn {
  isConnected: boolean;
  username: string | null;
  users: string[];
  offers: FileOffer[];
  transfers: TransferProgress[];
  serverConfig: ServerConfig | null;
  login: (username: string) => void;
  sendFileOffer: (file: File, toUser: string) => void;
  acceptOffer: (offer: FileOffer) => void;
  rejectOffer: (offer: FileOffer) => void;
  downloadFile: (transfer: TransferProgress) => void;
}

export function useFileTransfer(): UseFileTransferReturn {
  const [username, setUsername] = useState<string | null>(null);
  const [users, setUsers] = useState<string[]>([]);
  const [offers, setOffers] = useState<FileOffer[]>([]);
  const [transfers, setTransfers] = useState<TransferProgress[]>([]);
  const [serverConfig, setServerConfig] = useState<ServerConfig | null>(null);
  
  const activeUploads = useRef<Map<string, { file: File; sentBytes: number; checksum: string }>>(new Map());
  const activeDownloads = useRef<Map<string, DownloadState>>(new Map());
  const chunkSizeRef = useRef<number>(DEFAULT_CHUNK_SIZE);

  const socketRef = useRef<WebSocket | null>(null);
  
  const { sendJsonMessage, sendMessage, readyState, lastMessage, getWebSocket } = useWebSocket(WS_URL, {
    shouldReconnect: () => true,
    reconnectInterval: 3000,
    onOpen: () => {
      console.log('WebSocket Connected');
      const ws = getWebSocket();
      if (ws) {
        (ws as WebSocket).binaryType = 'arraybuffer';
        socketRef.current = ws as WebSocket;
      }
    },
    onClose: () => console.log('WebSocket Disconnected'),
    onError: (e) => console.error('WebSocket Error:', e),
  });

  const isConnected = readyState === ReadyState.OPEN;

  useEffect(() => {
    if (!lastMessage) return;

    const data = lastMessage.data;
    
    if (data instanceof ArrayBuffer) {
      console.log('Received binary message, size:', data.byteLength);
      handleBinaryMessage(data);
      return;
    }
    
    if (data instanceof Blob) {
      console.log('Received blob message, size:', data.size);
      handleBinaryMessage(data);
      return;
    }

    try {
      const msg = JSON.parse(data as string) as ServerMessage;
      handleServerMessage(msg);
    } catch (e) {
      console.error('Failed to parse message:', e, 'data:', data);
    }
  }, [lastMessage]);

  const handleServerMessage = (msg: ServerMessage) => {
    switch (msg.type) {
      case 'SERVER_CONFIG':
        console.log(`Server config received: maxFileSize=${msg.max_file_size}, chunkSize=${msg.chunk_size}`);
        chunkSizeRef.current = msg.chunk_size;
        setServerConfig({
          maxFileSize: msg.max_file_size,
          chunkSize: msg.chunk_size
        });
        break;
      case 'USER_JOINED':
        setUsers(msg.users);
        break;
      case 'USER_LEFT':
        setUsers(msg.users);
        break;
      case 'FILE_OFFER_RECEIVED':
        setOffers(prev => [...prev, {
          file_id: msg.file_id,
          from: msg.from,
          filename: msg.filename,
          size: msg.size,
          checksum: msg.checksum
        }]);
        break;
      case 'FILE_ACCEPTED':
        startUpload(msg.file_id);
        break;
      case 'FILE_REJECTED':
        setTransfers(prev => prev.map(t => 
          t.file_id === msg.file_id ? { ...t, status: 'error', error: 'Rejected' } : t
        ));
        break;
      case 'FILE_COMPLETE':
        // Server notifies completion, but we rely on chunk counting for accuracy
        // Only finish if not already finished (download still exists)
        if (activeDownloads.current.has(msg.file_id)) {
          console.log('FILE_COMPLETE received from server, checking chunks...');
          const dl = activeDownloads.current.get(msg.file_id);
          if (dl && dl.chunks.size >= dl.expectedChunks) {
            finishDownload(msg.file_id);
          }
        }
        break;
      case 'FILE_ERROR':
        setTransfers(prev => prev.map(t => 
          t.file_id === msg.file_id ? { ...t, status: 'error', error: msg.error } : t
        ));
        break;
      case 'ERROR':
        console.error('Server error:', msg.message);
        break;
    }
  };

  const handleBinaryMessage = async (data: Blob | ArrayBuffer) => {
    const buffer = data instanceof Blob ? await data.arrayBuffer() : data;
    const view = new DataView(buffer);
    
    if (buffer.byteLength < 20) return;

    const idBytes = new Uint8Array(buffer.slice(0, 16));
    const fileId = bytesToUuid(idBytes);
    const chunkIndex = view.getUint32(16);
    const chunkData = buffer.slice(20);

    const download = activeDownloads.current.get(fileId);
    if (download) {
      download.chunks.set(chunkIndex, new Blob([chunkData]));
      download.receivedBytes += chunkData.byteLength;
      
      const progress = Math.min(100, (download.receivedBytes / download.totalSize) * 100);
      const allChunksReceived = download.chunks.size >= download.expectedChunks;
      
      setTransfers(prev => prev.map(t => 
        t.file_id === fileId ? { 
          ...t, 
          transferred: download.receivedBytes, 
          progress 
        } : t
      ));
      
      const ack: ClientMessage = {
        type: 'FILE_CHUNK_ACK',
        file_id: fileId,
        chunk_index: chunkIndex
      };
      sendJsonMessage(ack);
      
      if (allChunksReceived) {
        console.log(`All ${download.expectedChunks} chunks received, finishing download`);
        finishDownload(fileId);
      }
    }
  };

  const login = useCallback((user: string) => {
    setUsername(user);
    sendJsonMessage({ type: 'JOIN', username: user });
  }, [sendJsonMessage]);

  const sendFileOffer = useCallback(async (file: File, toUser: string) => {
    const file_id = crypto.randomUUID();
    const chunkSize = chunkSizeRef.current;
    
    setTransfers(prev => [...prev, {
      file_id,
      filename: file.name,
      direction: 'upload',
      progress: 0,
      transferred: 0,
      total: file.size,
      status: 'pending'
    }]);

    const checksum = await computeFileSHA256(file);
    console.log(`File checksum (SHA-256): ${checksum}, chunk size: ${chunkSize}`);
    
    activeUploads.current.set(file_id, { file, sentBytes: 0, checksum });

    const offer: ClientMessage = {
      type: 'FILE_OFFER',
      to: toUser,
      file_id,
      filename: file.name,
      size: file.size,
      chunk_size: chunkSize,
      checksum
    };
    sendJsonMessage(offer);
  }, [sendJsonMessage]);

  const acceptOffer = useCallback((offer: FileOffer) => {
    const chunkSize = chunkSizeRef.current;
    const expectedChunks = Math.ceil(offer.size / chunkSize);
    
    activeDownloads.current.set(offer.file_id, {
      chunks: new Map(),
      receivedBytes: 0,
      totalSize: offer.size,
      filename: offer.filename,
      expectedChecksum: offer.checksum,
      expectedChunks
    });

    setTransfers(prev => [...prev, {
      file_id: offer.file_id,
      filename: offer.filename,
      direction: 'download',
      progress: 0,
      transferred: 0,
      total: offer.size,
      status: 'transferring'
    }]);

    setOffers(prev => prev.filter(o => o.file_id !== offer.file_id));

    sendJsonMessage({
      type: 'FILE_ACCEPT',
      from: offer.from,
      file_id: offer.file_id
    });
  }, [sendJsonMessage]);

  const rejectOffer = useCallback((offer: FileOffer) => {
    setOffers(prev => prev.filter(o => o.file_id !== offer.file_id));
    sendJsonMessage({
      type: 'FILE_REJECT',
      from: offer.from,
      file_id: offer.file_id
    });
  }, [sendJsonMessage]);

  const startUpload = async (file_id: string) => {
    const upload = activeUploads.current.get(file_id);
    if (!upload) return;

    setTransfers(prev => prev.map(t => 
      t.file_id === file_id ? { ...t, status: 'transferring' } : t
    ));

    const { file } = upload;
    const chunkSize = chunkSizeRef.current;
    const totalChunks = Math.ceil(file.size / chunkSize);
    const idBytes = uuidToBytes(file_id);

    for (let i = 0; i < totalChunks; i++) {
      const start = i * chunkSize;
      const end = Math.min(start + chunkSize, file.size);
      const chunk = file.slice(start, end);
      const chunkBuffer = await chunk.arrayBuffer();

      const message = new Uint8Array(20 + chunkBuffer.byteLength);
      message.set(idBytes, 0);
      
      const view = new DataView(message.buffer);
      view.setUint32(16, i);
      
      message.set(new Uint8Array(chunkBuffer), 20);

      sendMessage(message);

      upload.sentBytes = end;
      const progress = Math.min(100, (upload.sentBytes / file.size) * 100);
      
      setTransfers(prev => prev.map(t => 
        t.file_id === file_id ? { 
          ...t, 
          transferred: upload.sentBytes, 
          progress 
        } : t
      ));

      await new Promise(r => setTimeout(r, 5));
    }
  };

  const finishDownload = async (file_id: string) => {
    const download = activeDownloads.current.get(file_id);
    if (!download) return;

    setTransfers(prev => prev.map(t => 
      t.file_id === file_id ? { ...t, status: 'verifying', progress: 100 } : t
    ));

    const sortedChunks: Blob[] = [];
    for (let i = 0; i < download.expectedChunks; i++) {
      const chunk = download.chunks.get(i);
      if (chunk) {
        sortedChunks.push(chunk);
      } else {
        console.error(`Missing chunk ${i} of ${download.expectedChunks}`);
      }
    }
    
    console.log(`Assembling file from ${sortedChunks.length}/${download.expectedChunks} chunks, expected size: ${download.totalSize}`);
    
    const blob = new Blob(sortedChunks, { type: 'application/octet-stream' });
    console.log(`Assembled blob size: ${blob.size}`);
    
    const buffer = await blob.arrayBuffer();
    const actualChecksum = await computeSHA256(buffer);
    
    const isValid = actualChecksum === download.expectedChecksum;
    console.log(`Checksum verification: expected=${download.expectedChecksum}, actual=${actualChecksum}, valid=${isValid}`);

    const url = URL.createObjectURL(blob);

    setTransfers(prev => prev.map(t => 
      t.file_id === file_id ? { 
        ...t, 
        status: isValid ? 'completed' : 'error',
        error: isValid ? undefined : `Checksum mismatch! Expected: ${download.expectedChecksum.slice(0, 16)}..., Got: ${actualChecksum.slice(0, 16)}...`,
        progress: 100, 
        blobUrl: url,
        checksumValid: isValid
      } : t
    ));

    activeDownloads.current.delete(file_id);

    if (isValid) {
      const a = document.createElement('a');
      a.href = url;
      a.download = download.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  const downloadFile = useCallback((transfer: TransferProgress) => {
    if (transfer.blobUrl) {
      const a = document.createElement('a');
      a.href = transfer.blobUrl;
      a.download = transfer.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  }, []);

  return {
    isConnected,
    username,
    users,
    offers,
    transfers,
    serverConfig,
    login,
    sendFileOffer,
    acceptOffer,
    rejectOffer,
    downloadFile
  };
}
