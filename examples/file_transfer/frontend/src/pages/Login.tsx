import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Container, Paper, Typography, TextField, Button, Box } from '@mui/material';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';

export function Login() {
  const [username, setUsername] = useState('');
  const navigate = useNavigate();

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (username.trim()) {
      navigate(`/transfer/${encodeURIComponent(username.trim())}`);
    }
  };

  return (
    <Container maxWidth="sm" sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Paper 
        elevation={3} 
        sx={{ 
          p: 4, 
          width: '100%', 
          bgcolor: 'background.paper',
          backgroundImage: 'linear-gradient(135deg, rgba(0,240,255,0.05) 0%, rgba(112,0,255,0.05) 100%)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255,255,255,0.1)'
        }}
      >
        <Box display="flex" flexDirection="column" alignItems="center" gap={3}>
          <Box 
            sx={{ 
              p: 2, 
              borderRadius: '50%', 
              bgcolor: 'primary.main', 
              boxShadow: '0 0 20px rgba(0,240,255,0.5)'
            }}
          >
            <RocketLaunchIcon sx={{ fontSize: 40, color: 'background.default' }} />
          </Box>
          
          <Typography variant="h4" component="h1" fontWeight="bold" textAlign="center">
            RSWS File Transfer
          </Typography>
          
          <Typography variant="body1" color="text.secondary" textAlign="center">
            Secure, high-speed p2p-style file sharing powered by Rust WebSockets.
          </Typography>

          <Box component="form" onSubmit={handleSubmit} width="100%" display="flex" flexDirection="column" gap={2}>
            <TextField
              label="Choose Username"
              variant="outlined"
              fullWidth
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoFocus
              sx={{
                '& .MuiOutlinedInput-root': {
                  '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
                  '&:hover fieldset': { borderColor: 'primary.main' },
                }
              }}
            />
            <Button 
              type="submit" 
              variant="contained" 
              size="large" 
              fullWidth
              disabled={!username.trim()}
              sx={{ 
                mt: 2,
                bgcolor: 'primary.main',
                color: 'background.paper',
                fontWeight: 'bold',
                '&:hover': { bgcolor: 'primary.dark' }
              }}
            >
              Enter Transfer Room
            </Button>
          </Box>
        </Box>
      </Paper>
    </Container>
  );
}
