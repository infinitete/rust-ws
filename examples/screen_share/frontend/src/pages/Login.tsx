import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, TextField, Button, Typography, Box } from '@mui/material';

const Login = () => {
  const [username, setUsername] = useState('');
  const [roomId, setRoomId] = useState('');
  const navigate = useNavigate();

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (username && roomId) {
      navigate(`/room/${roomId}`, { state: { username } });
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-900 p-4">
      <Card className="w-full max-w-md bg-slate-800 text-white shadow-xl">
        <CardContent className="space-y-6 p-8">
          <Box className="text-center mb-8">
            <Typography variant="h4" component="h1" className="text-white font-bold mb-2">
              Screen Share
            </Typography>
            <Typography variant="body2" className="text-slate-400">
              Enter a room ID to start sharing or viewing
            </Typography>
          </Box>

          <form onSubmit={handleJoin} className="space-y-6">
            <TextField
              fullWidth
              label="Username"
              variant="outlined"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              InputLabelProps={{ className: "text-slate-400" }}
              InputProps={{ className: "text-white bg-slate-700/50" }}
              className="bg-slate-700/50 rounded"
              required
            />
            
            <TextField
              fullWidth
              label="Room ID"
              variant="outlined"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              InputLabelProps={{ className: "text-slate-400" }}
              InputProps={{ className: "text-white bg-slate-700/50" }}
              className="bg-slate-700/50 rounded"
              required
            />

            <Button
              type="submit"
              fullWidth
              variant="contained"
              size="large"
              className="bg-blue-600 hover:bg-blue-700 py-3 text-lg font-semibold mt-4"
            >
              Join Room
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default Login;
