# Large File Transfer Example

A production-ready WebSocket file transfer application demonstrating the rsws library with binary chunk handling and a React frontend.

## Features

- Real-time file transfer between connected users
- Binary WebSocket messages for efficient data transfer
- Chunked transfer with 64KB chunks (supports files up to 100MB)
- Progress tracking for uploads and downloads
- Flow control with chunk acknowledgments
- Modern React UI with MUI + Tailwind CSS
- Connection status indicators
- Drag-and-drop file upload

## Tech Stack

### Backend (Rust)
- `rsws` - WebSocket protocol library
- `tokio` - Async runtime with channels
- `serde` + `serde_json` - JSON serialization for signaling
- `uuid` - File transfer identification

### Frontend (React)
- React 18 + TypeScript
- Vite - Build tool
- MUI v5 - UI components
- Tailwind CSS v3 - Styling
- `react-use-websocket` - WebSocket integration

## Running the Example

### 1. Start the Backend

```bash
cd examples/file_transfer/server
cargo run
```

Server will start on `ws://127.0.0.1:8081`

### 2. Start the Frontend

```bash
cd examples/file_transfer/frontend
npm install
npm run dev
```

Frontend will be available at `http://localhost:3001`

### 3. Test File Transfer

1. Open `http://localhost:3001` in your browser
2. Enter a username (e.g., "alice") and click "Join Room"
3. Open another browser tab and join with a different username (e.g., "bob")
4. In alice's tab, drag a file onto the dropzone or click to select
5. Select "bob" as the recipient and click "Send"
6. In bob's tab, accept the incoming file offer
7. Watch the progress bars update in real-time
8. File downloads automatically when transfer completes

## Architecture

### Binary Protocol

File chunks are sent as binary WebSocket messages with a fixed header:

```
[16 bytes: file_id as hex] [4 bytes: chunk_index BE] [data...]
```

- **file_id**: UUID identifying the transfer (16 bytes as hex string)
- **chunk_index**: Big-endian u32 chunk sequence number
- **data**: File chunk payload (up to 64KB)

### Signaling Protocol (JSON)

#### Client → Server

```json
{ "type": "JOIN", "username": "alice" }
{ "type": "FILE_OFFER", "to": "bob", "file_id": "...", "filename": "photo.jpg", "size": 1024000, "chunk_size": 65536 }
{ "type": "FILE_ACCEPT", "from": "alice", "file_id": "..." }
{ "type": "FILE_REJECT", "from": "alice", "file_id": "..." }
{ "type": "FILE_CHUNK_ACK", "file_id": "...", "chunk_index": 5 }
```

#### Server → Client

```json
{ "type": "USER_JOINED", "username": "alice", "users": ["alice", "bob"] }
{ "type": "USER_LEFT", "username": "bob", "users": ["alice"] }
{ "type": "FILE_OFFER_RECEIVED", "from": "alice", "file_id": "...", "filename": "photo.jpg", "size": 1024000 }
{ "type": "FILE_ACCEPTED", "file_id": "...", "to": "bob" }
{ "type": "FILE_REJECTED", "file_id": "..." }
{ "type": "FILE_CHUNK_ACK", "file_id": "...", "chunk_index": 5 }
{ "type": "FILE_COMPLETE", "file_id": "..." }
{ "type": "FILE_ERROR", "file_id": "...", "error": "..." }
```

### Data Flow

```
┌────────────┐                    ┌────────────┐                    ┌────────────┐
│   Alice    │                    │   Server   │                    │    Bob     │
│  (Sender)  │                    │            │                    │ (Receiver) │
└─────┬──────┘                    └─────┬──────┘                    └─────┬──────┘
      │                                 │                                 │
      │ FILE_OFFER (JSON)               │                                 │
      │────────────────────────────────>│                                 │
      │                                 │ FILE_OFFER_RECEIVED (JSON)      │
      │                                 │────────────────────────────────>│
      │                                 │                                 │
      │                                 │ FILE_ACCEPT (JSON)              │
      │                                 │<────────────────────────────────│
      │ FILE_ACCEPTED (JSON)            │                                 │
      │<────────────────────────────────│                                 │
      │                                 │                                 │
      │ Binary chunk [0]                │                                 │
      │────────────────────────────────>│ Binary chunk [0]                │
      │                                 │────────────────────────────────>│
      │                                 │ FILE_CHUNK_ACK [0] (JSON)       │
      │ FILE_CHUNK_ACK [0]              │<────────────────────────────────│
      │<────────────────────────────────│                                 │
      │                                 │                                 │
      │ Binary chunk [1]                │                                 │
      │────────────────────────────────>│ Binary chunk [1]                │
      │                                 │────────────────────────────────>│
      │         ...                     │         ...                     │
      │                                 │                                 │
      │ FILE_COMPLETE (JSON)            │ FILE_COMPLETE (JSON)            │
      │<────────────────────────────────│────────────────────────────────>│
      │                                 │                                 │
```

## Configuration

### Server Limits

- **MAX_FILE_SIZE**: 100 MB (configurable in `handler.rs`)
- **CHUNK_SIZE**: 64 KB (defined in protocol)
- **Broadcast channel capacity**: 256 messages

### Frontend Settings

- **WebSocket URL**: `ws://localhost:8081`
- **Chunk size**: 64 KB
- **Reconnection**: Enabled with 10 attempts, 3s interval

## Building for Production

### Backend

```bash
cd examples/file_transfer/server
cargo build --release
```

### Frontend

```bash
cd examples/file_transfer/frontend
npm run build
```

The optimized build will be in `frontend/dist/`
