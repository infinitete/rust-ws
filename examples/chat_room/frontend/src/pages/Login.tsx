import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Paper,
  TextField,
  Button,
  Typography,
  Box,
  Alert,
} from '@mui/material';
import ChatIcon from '@mui/icons-material/Chat';

export const Login = () => {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');

  const handleJoin = () => {
    const trimmed = username.trim();
    if (!trimmed) {
      setError('Please enter a username');
      return;
    }
    if (trimmed.length < 2) {
      setError('Username must be at least 2 characters');
      return;
    }
    if (trimmed.length > 20) {
      setError('Username must be at most 20 characters');
      return;
    }
    navigate(`/chat/${encodeURIComponent(trimmed)}`);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleJoin();
    }
  };

  return (
    <Container maxWidth="sm" className="flex items-center justify-center min-h-screen">
      <Paper elevation={3} className="p-8 w-full">
        <Box className="flex flex-col items-center gap-2 mb-6">
          <ChatIcon color="primary" sx={{ fontSize: 48 }} />
          <Typography variant="h4" component="h1">
            RSWS Chat
          </Typography>
          <Typography variant="body2" color="text.secondary">
            A WebSocket chat room powered by rsws
          </Typography>
        </Box>

        {error && (
          <Alert severity="error" className="mb-4" onClose={() => setError('')}>
            {error}
          </Alert>
        )}

        <TextField
          fullWidth
          label="Username"
          value={username}
          onChange={(e) => {
            setUsername(e.target.value);
            setError('');
          }}
          onKeyDown={handleKeyDown}
          autoFocus
          className="mb-4"
        />

        <Button
          fullWidth
          variant="contained"
          size="large"
          onClick={handleJoin}
          className="mt-4"
        >
          Join Chat
        </Button>
      </Paper>
    </Container>
  );
};
