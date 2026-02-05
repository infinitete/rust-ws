import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Box, Container, Grid, Paper, Typography, Button, 
  Dialog, DialogTitle, DialogContent, DialogActions,
  FormControl, InputLabel, Select, MenuItem, Chip,
  Alert
} from '@mui/material';
import WifiIcon from '@mui/icons-material/Wifi';
import WifiOffIcon from '@mui/icons-material/WifiOff';
import FolderIcon from '@mui/icons-material/Folder';

import { useFileTransfer } from '../hooks/useFileTransfer';
import { UserList } from '../components/UserList';
import { FileDropzone } from '../components/FileDropzone';
import { TransferProgress } from '../components/TransferProgress';

export function TransferRoom() {
  const { username } = useParams<{ username: string }>();
  const navigate = useNavigate();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [recipient, setRecipient] = useState<string>('');
  const [sendDialogOpen, setSendDialogOpen] = useState(false);

  const {
    isConnected,
    users,
    offers,
    transfers,
    login,
    sendFileOffer,
    acceptOffer,
    rejectOffer
  } = useFileTransfer();

  // Handle login on mount
  useEffect(() => {
    if (!username) {
      navigate('/');
      return;
    }
    login(username);
  }, [username, navigate, login]);

  const handleFileSelect = (file: File) => {
    setSelectedFile(file);
    setSendDialogOpen(true);
  };

  const handleSend = () => {
    if (selectedFile && recipient) {
      sendFileOffer(selectedFile, recipient);
      setSendDialogOpen(false);
      setSelectedFile(null);
      setRecipient('');
    }
  };

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column', bgcolor: 'background.default' }}>
      {/* Header */}
      <Paper 
        square 
        elevation={0} 
        sx={{ 
          p: 2, 
          borderBottom: 1, 
          borderColor: 'divider',
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          bgcolor: 'rgba(18, 20, 32, 0.8)',
          backdropFilter: 'blur(8px)'
        }}
      >
        <Box display="flex" alignItems="center" gap={2}>
          <Typography variant="h5" fontWeight="bold" sx={{ background: 'linear-gradient(45deg, #00f0ff, #7000ff)', backgroundClip: 'text', color: 'transparent' }}>
            RSWS Transfer
          </Typography>
          <Chip 
            icon={isConnected ? <WifiIcon /> : <WifiOffIcon />} 
            label={isConnected ? "Connected" : "Disconnected"} 
            color={isConnected ? "success" : "error"} 
            variant="outlined" 
            size="small" 
          />
        </Box>
        <Typography color="text.secondary">
          Logged in as <strong>{username}</strong>
        </Typography>
      </Paper>

      {/* Main Content */}
      <Container maxWidth="xl" sx={{ flex: 1, p: 3, overflow: 'hidden' }}>
        <Grid container spacing={3} sx={{ height: '100%' }}>
          
          {/* Left Sidebar - Users */}
          <Grid item xs={12} md={3} sx={{ height: '100%' }}>
            <UserList 
              users={users} 
              currentUser={username || null} 
              onSelectUser={(user) => setRecipient(user)}
            />
          </Grid>

          {/* Center - Actions & Status */}
          <Grid item xs={12} md={6} sx={{ height: '100%', overflowY: 'auto' }}>
            <Box display="flex" flexDirection="column" gap={4}>
              
              {/* Incoming Offers */}
              {offers.length > 0 && (
                <Paper variant="outlined" sx={{ p: 2, borderColor: 'primary.main', bgcolor: 'rgba(0,240,255,0.05)' }}>
                  <Typography variant="h6" color="primary" gutterBottom>Incoming File Requests</Typography>
                  <Box display="flex" flexDirection="column" gap={2}>
                    {offers.map((offer) => (
                      <Paper key={offer.file_id} sx={{ p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Box>
                          <Typography variant="subtitle1" fontWeight="bold">{offer.filename}</Typography>
                          <Typography variant="body2" color="text.secondary">
                            From: {offer.from} • Size: {(offer.size / 1024 / 1024).toFixed(2)} MB
                          </Typography>
                        </Box>
                        <Box display="flex" gap={1}>
                          <Button variant="contained" color="success" onClick={() => acceptOffer(offer)}>Accept</Button>
                          <Button variant="outlined" color="error" onClick={() => rejectOffer(offer)}>Reject</Button>
                        </Box>
                      </Paper>
                    ))}
                  </Box>
                </Paper>
              )}

              {/* Upload Area */}
              <Box>
                <Typography variant="h6" gutterBottom>Send File</Typography>
                <FileDropzone onFileSelect={handleFileSelect} disabled={!isConnected} />
              </Box>

              {/* Active Transfers */}
              <TransferProgress transfers={transfers} />
              
            </Box>
          </Grid>

          {/* Right Sidebar - Info/Logs (Optional placeholder for now) */}
          <Grid item xs={12} md={3} sx={{ height: '100%' }}>
            <Paper variant="outlined" sx={{ p: 3, height: '100%', bgcolor: 'rgba(255,255,255,0.02)' }}>
              <Box display="flex" alignItems="center" gap={1} mb={2}>
                <FolderIcon color="secondary" />
                <Typography variant="h6">Transfer History</Typography>
              </Box>
              <Typography variant="body2" color="text.secondary">
                Completed transfers will appear here.
              </Typography>
              
              {transfers.filter(t => t.status === 'completed').length > 0 ? (
                 <Box mt={2} display="flex" flexDirection="column" gap={1}>
                   {transfers.filter(t => t.status === 'completed').map(t => (
                     <Box key={t.file_id} p={1} border={1} borderColor="divider" borderRadius={1}>
                        <Typography variant="caption" display="block" fontWeight="bold">{t.filename}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {t.direction === 'upload' ? 'Sent to' : 'Received from'} peer
                        </Typography>
                     </Box>
                   ))}
                 </Box>
              ) : (
                <Box mt={4} display="flex" justifyContent="center">
                  <Typography variant="caption" color="text.disabled" fontStyle="italic">No history yet</Typography>
                </Box>
              )}
            </Paper>
          </Grid>

        </Grid>
      </Container>

      {/* Send File Dialog */}
      <Dialog open={sendDialogOpen} onClose={() => setSendDialogOpen(false)}>
        <DialogTitle>Send "{selectedFile?.name}"</DialogTitle>
        <DialogContent sx={{ minWidth: 300, mt: 1 }}>
          <FormControl fullWidth margin="dense">
            <InputLabel>Select Recipient</InputLabel>
            <Select
              value={recipient}
              label="Select Recipient"
              onChange={(e) => setRecipient(e.target.value)}
            >
              {users.filter(u => u !== username).map((user) => (
                <MenuItem key={user} value={user}>{user}</MenuItem>
              ))}
            </Select>
          </FormControl>
          {users.filter(u => u !== username).length === 0 && (
             <Alert severity="warning" sx={{ mt: 2 }}>No other users in the room!</Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSendDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleSend} variant="contained" disabled={!recipient}>
            Send Offer
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
