# WebRTC Screen Sharing Example

A real-time screen sharing application demonstrating the rsws WebSocket library with WebRTC for peer-to-peer media streaming.

## Features

- Real-time screen sharing via WebRTC
- Multi-room support (join different rooms by ID)
- User presence tracking (join/leave notifications)
- Peer-to-peer video streaming
- Modern React UI with MUI + Tailwind CSS
- Connection status indicators
- Responsive video grid layout

## Tech Stack

### Backend (Rust)
- `rsws` - WebSocket protocol library
- `tokio` - Async runtime with broadcast channels
- `serde` + `serde_json` - JSON serialization

### Frontend (React)
- React 18 + TypeScript
- Vite - Build tool
- MUI v5 - UI components
- Tailwind CSS v3 - Styling
- `react-use-websocket` - WebSocket integration
- WebRTC APIs - Peer-to-peer streaming

## Running the Example

### 1. Start the Backend

```bash
cd examples/screen_share/server
cargo run
```

Server will start on `ws://127.0.0.1:8080`

### 2. Start the Frontend

```bash
cd examples/screen_share/frontend
npm install
npm run dev
```

Frontend will be available at `http://localhost:3000`

### 3. Test Screen Sharing

1. Open `http://localhost:3000` in your browser
2. Enter a username and room ID, then click "Join Room"
3. Open another browser tab/window and join the same room with a different username
4. Click "Share Screen" to start sharing - select a screen/window/tab
5. The shared screen appears on all connected clients in real-time!

## Architecture

### Backend

```
┌─────────────┐
│ TcpListener │ Accepts incoming connections
└──────┬──────┘
       │
       ▼
┌─────────────────┐
│ handle_connection│ Per-connection task
└────────┬────────┘
         │
         ├─► Parse handshake (HTTP → WebSocket)
         ├─► Create Connection
         ├─► Subscribe to room broadcast channel
         └─► Message loop (tokio::select!)
                │
                ├─► Client messages (JOIN, OFFER, ANSWER, ICE_CANDIDATE)
                └─► Room broadcasts (USER_JOINED, USER_LEFT, etc.)
```

### Frontend

```
┌──────────────┐
│   Login      │ Enter username + room ID
└──────┬───────┘
       │
       ▼
┌──────────────┐
│    Room      │ Main screen sharing interface
└──────┬───────┘
       │
       ├─► useSignaling hook (WebSocket connection)
       ├─► useWebRTC hook (RTCPeerConnection management)
       ├─► Video grid (local + remote streams)
       └─► Participant sidebar
```

## Signaling Protocol

### Client → Server

```json
{ "type": "JOIN", "username": "alice", "room_id": "demo" }
{ "type": "START_SHARING" }
{ "type": "STOP_SHARING" }
{ "type": "OFFER", "to": "bob", "sdp": "..." }
{ "type": "ANSWER", "to": "alice", "sdp": "..." }
{ "type": "ICE_CANDIDATE", "to": "bob", "candidate": "..." }
```

### Server → Client

```json
{ "type": "JOINED", "username": "alice", "room_id": "demo", "users": [...] }
{ "type": "USER_JOINED", "username": "bob", "users": [...] }
{ "type": "USER_LEFT", "username": "bob", "users": [...] }
{ "type": "SHARING_STARTED", "username": "alice" }
{ "type": "SHARING_STOPPED", "username": "alice" }
{ "type": "OFFER", "from": "alice", "sdp": "..." }
{ "type": "ANSWER", "from": "bob", "sdp": "..." }
{ "type": "ICE_CANDIDATE", "from": "alice", "candidate": "..." }
{ "type": "ERROR", "message": "..." }
```

## Key Implementation Details

### Backend
- Uses `tokio::sync::broadcast` for room-wide message distribution
- Supports both broadcast messages (presence) and targeted messages (WebRTC signaling)
- Multi-room support via `RoomManager` with automatic cleanup
- Each connection runs in a separate `tokio::spawn` task

### Frontend
- `useSignaling` hook manages WebSocket connection and auto-join
- `useWebRTC` hook manages RTCPeerConnection lifecycle for each peer
- Uses Google STUN servers for NAT traversal
- Handles browser "Stop Sharing" button via track.onended
- Proper cleanup on component unmount

## Building for Production

### Backend

```bash
cd examples/screen_share/server
cargo build --release
```

### Frontend

```bash
cd examples/screen_share/frontend
npm run build
```

The optimized build will be in `frontend/dist/`
