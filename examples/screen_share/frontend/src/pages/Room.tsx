import { useEffect, useRef } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { useSignaling } from '../hooks/useSignaling';
import { useWebRTC } from '../hooks/useWebRTC';
import { 
  AppBar, 
  Toolbar, 
  Typography, 
  Button, 
  Chip, 
  Drawer, 
  List, 
  ListItem, 
  ListItemText, 
  ListItemAvatar, 
  Avatar,
  Box
} from '@mui/material';
import { ScreenShare, StopScreenShare, Person, FiberManualRecord } from '@mui/icons-material';

interface LocationState {
  username: string;
}

const Room = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as LocationState;
  
  useEffect(() => {
    if (!state?.username || !roomId) {
      navigate('/');
    }
  }, [state, roomId, navigate]);

  const username = state?.username || '';
  const room_id = roomId || '';

  const { 
    users, 
    localStream, 
    remoteStreams, 
    startSharing, 
    stopSharing, 
    handleServerMessage 
  } = useWebRTC({
    username,
    sendMessage: (msg) => sendMessage(msg)
  });

  const { sendMessage, connectionStatus } = useSignaling({
    username,
    roomId: room_id,
    onMessage: handleServerMessage
  });

  const localVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  return (
    <div className="flex h-screen bg-slate-900 overflow-hidden">
      <Drawer
        variant="permanent"
        anchor="left"
        classes={{ paper: "bg-slate-800 border-r border-slate-700 w-64 text-white" }}
      >
        <Box className="p-4 border-b border-slate-700">
          <Typography variant="h6" className="font-bold">
            Participants ({users.length})
          </Typography>
        </Box>
        <List>
          {users.map((user) => (
            <ListItem key={user.username}>
              <ListItemAvatar>
                <Avatar className="bg-blue-600">
                  <Person />
                </Avatar>
              </ListItemAvatar>
              <ListItemText 
                primary={
                  <span className="flex items-center gap-2">
                    {user.username} {user.username === username && '(You)'}
                    {user.is_sharing && (
                      <ScreenShare fontSize="small" className="text-green-400" />
                    )}
                  </span>
                }
              />
            </ListItem>
          ))}
        </List>
      </Drawer>

      <div className="flex-1 flex flex-col min-w-0 ml-64">
        <AppBar position="static" className="bg-slate-800 shadow-none border-b border-slate-700">
          <Toolbar>
            <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
              Room: {room_id}
            </Typography>
            
            <Chip 
              icon={<FiberManualRecord className={connectionStatus === 'connected' ? 'text-green-500' : 'text-red-500'} />}
              label={connectionStatus}
              variant="outlined"
              className="mr-4 text-white border-slate-600"
            />

            {!localStream ? (
              <Button 
                variant="contained" 
                color="primary" 
                startIcon={<ScreenShare />}
                onClick={startSharing}
                className="bg-blue-600 hover:bg-blue-700"
              >
                Share Screen
              </Button>
            ) : (
              <Button 
                variant="contained" 
                color="error" 
                startIcon={<StopScreenShare />}
                onClick={stopSharing}
                className="bg-red-600 hover:bg-red-700"
              >
                Stop Sharing
              </Button>
            )}
          </Toolbar>
        </AppBar>

        <div className="flex-1 p-4 overflow-y-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            
            {localStream && (
              <div className="relative aspect-video bg-black rounded-lg overflow-hidden border-2 border-green-500 shadow-lg">
                <video
                  ref={localVideoRef}
                  autoPlay
                  muted
                  playsInline
                  className="w-full h-full object-contain"
                />
                <div className="absolute bottom-2 left-2 bg-black/60 px-2 py-1 rounded text-white text-sm flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-green-500"></span>
                  You (Sharing)
                </div>
              </div>
            )}

            {Array.from(remoteStreams.entries()).map(([peerName, stream]) => (
              <RemoteVideo key={peerName} username={peerName} stream={stream} />
            ))}
            
            {!localStream && remoteStreams.size === 0 && (
              <div className="col-span-full h-full flex items-center justify-center text-slate-500 flex-col gap-4 min-h-[400px]">
                <ScreenShare style={{ fontSize: 64, opacity: 0.2 }} />
                <Typography variant="h6" className="opacity-50">
                  No one is sharing screen currently
                </Typography>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const RemoteVideo = ({ username, stream }: { username: string; stream: MediaStream }) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div className="relative aspect-video bg-black rounded-lg overflow-hidden border border-slate-700 shadow-lg">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        className="w-full h-full object-contain"
      />
      <div className="absolute bottom-2 left-2 bg-black/60 px-2 py-1 rounded text-white text-sm flex items-center gap-2">
        <ScreenShare fontSize="small" className="text-blue-400" />
        {username}
      </div>
    </div>
  );
};

export default Room;
