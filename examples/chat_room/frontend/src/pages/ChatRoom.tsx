import { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Paper,
  TextField,
  IconButton,
  Typography,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Chip,
  AppBar,
  Toolbar,
  LinearProgress,
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import ExitToAppIcon from '@mui/icons-material/ExitToApp';
import PersonIcon from '@mui/icons-material/Person';
import { useChat } from '../hooks/useChat';
import { formatDistanceToNow } from 'date-fns';

export const ChatRoom = () => {
  const { username } = useParams<{ username: string }>();
  const navigate = useNavigate();
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const decodedUsername = decodeURIComponent(username || '');

  const {
    messages,
    users,
    isConnected,
    sendChat,
    messagesEndRef,
  } = useChat(decodedUsername);

  useEffect(() => {
    if (!username) {
      navigate('/');
    }
  }, [username, navigate]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSend = () => {
    if (inputValue.trim() && isConnected) {
      sendChat(inputValue);
      setInputValue('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <Box className="flex flex-col h-screen">
      <AppBar position="static" elevation={1}>
        <Toolbar>
          <Typography variant="h6" className="flex-grow">
            RSWS Chat
          </Typography>
          <Chip
            label={isConnected ? 'Connected' : 'Connecting...'}
            color={isConnected ? 'success' : 'default'}
            size="small"
            className="mr-2"
          />
          <Typography variant="body2" className="mr-4">
            {decodedUsername}
          </Typography>
          <IconButton color="inherit" onClick={() => navigate('/')} title="Leave chat">
            <ExitToAppIcon />
          </IconButton>
        </Toolbar>
        {!isConnected && <LinearProgress />}
      </AppBar>

      <Box className="flex flex-grow overflow-hidden p-4 gap-4 bg-gray-100">
        <Paper className="flex flex-col flex-grow overflow-hidden">
          <Box className="flex-grow overflow-auto p-4">
            {messages.length === 0 && (
              <Typography color="text.secondary" className="text-center mt-8">
                No messages yet. Start the conversation!
              </Typography>
            )}
            {messages.map((msg) => (
              <Box
                key={msg.id}
                className={`mb-3 p-2 rounded ${msg.isSystem ? 'bg-gray-100 text-center' : ''}`}
              >
                {msg.isSystem ? (
                  <Typography variant="body2" color="text.secondary">
                    {msg.content}
                  </Typography>
                ) : (
                  <>
                    <Box className="flex items-center gap-2">
                      <Typography
                        variant="subtitle2"
                        color={msg.username === decodedUsername ? 'primary' : 'text.primary'}
                      >
                        {msg.username}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {formatDistanceToNow(msg.timestamp, { addSuffix: true })}
                      </Typography>
                    </Box>
                    <Typography variant="body1" className="mt-1">
                      {msg.content}
                    </Typography>
                  </>
                )}
              </Box>
            ))}
            <div ref={messagesEndRef} />
          </Box>

          <Divider />

          <Box className="p-3 flex gap-2">
            <TextField
              inputRef={inputRef}
              fullWidth
              placeholder="Type a message..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={!isConnected}
              size="small"
            />
            <IconButton
              color="primary"
              onClick={handleSend}
              disabled={!isConnected || !inputValue.trim()}
            >
              <SendIcon />
            </IconButton>
          </Box>
        </Paper>

        <Paper className="w-60 overflow-auto hidden md:block">
          <Box className="p-3">
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Online ({users.length})
            </Typography>
            <List dense>
              {users.map((user) => (
                <ListItem key={user}>
                  <ListItemIcon sx={{ minWidth: 32 }}>
                    <PersonIcon fontSize="small" color={user === decodedUsername ? 'primary' : 'action'} />
                  </ListItemIcon>
                  <ListItemText
                    primary={user}
                    primaryTypographyProps={{
                      color: user === decodedUsername ? 'primary' : 'text.primary',
                      fontWeight: user === decodedUsername ? 600 : 400,
                    }}
                  />
                </ListItem>
              ))}
            </List>
          </Box>
        </Paper>
      </Box>
    </Box>
  );
};
