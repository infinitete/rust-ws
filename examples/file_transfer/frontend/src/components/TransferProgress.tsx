import { Box, Paper, Typography, LinearProgress, Button, Chip } from '@mui/material';
import UploadIcon from '@mui/icons-material/Upload';
import DownloadIcon from '@mui/icons-material/Download';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import VerifiedIcon from '@mui/icons-material/Verified';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import { TransferProgress as TransferType } from '../types';

interface TransferProgressProps {
  transfers: TransferType[];
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function getStatusColor(status: string, checksumValid?: boolean): 'success' | 'error' | 'primary' | 'warning' | 'default' {
  if (status === 'completed' && checksumValid === true) return 'success';
  if (status === 'completed' && checksumValid === false) return 'error';
  if (status === 'error') return 'error';
  if (status === 'verifying') return 'warning';
  if (status === 'transferring') return 'primary';
  return 'default';
}

function getStatusLabel(status: string, checksumValid?: boolean): string {
  if (status === 'verifying') return 'Verifying checksum...';
  if (status === 'completed' && checksumValid === true) return 'Verified ✓';
  if (status === 'completed' && checksumValid === false) return 'Checksum failed!';
  return status;
}

export function TransferProgress({ transfers }: TransferProgressProps) {
  if (transfers.length === 0) return null;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Typography variant="h6" color="text.primary">Active Transfers</Typography>
      {transfers.map((transfer) => (
        <Paper
          key={transfer.file_id}
          variant="outlined"
          sx={{
            p: 2,
            bgcolor: 'background.paper',
            borderColor: transfer.status === 'error' || transfer.checksumValid === false ? 'error.main' : 
                        transfer.checksumValid === true ? 'success.main' : 'divider'
          }}
        >
          <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
            <Box display="flex" alignItems="center" gap={1}>
              {transfer.direction === 'upload' ?
                <UploadIcon color="primary" /> :
                <DownloadIcon color="secondary" />
              }
              <Typography variant="subtitle1" color="text.primary">
                {transfer.filename}
              </Typography>
              <Chip
                icon={
                  transfer.status === 'verifying' ? <HourglassEmptyIcon /> :
                  transfer.checksumValid === true ? <VerifiedIcon /> :
                  transfer.checksumValid === false ? <ErrorOutlineIcon /> : undefined
                }
                label={getStatusLabel(transfer.status, transfer.checksumValid)}
                size="small"
                color={getStatusColor(transfer.status, transfer.checksumValid)}
                variant="outlined"
              />
            </Box>
            <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
              {formatBytes(transfer.transferred)} / {formatBytes(transfer.total)}
            </Typography>
          </Box>
          
          <LinearProgress
            variant={transfer.status === 'verifying' ? 'indeterminate' : 'determinate'}
            value={transfer.progress}
            sx={{
              height: 8,
              borderRadius: 4,
              bgcolor: 'rgba(255,255,255,0.05)',
              '& .MuiLinearProgress-bar': {
                borderRadius: 4,
                bgcolor: transfer.checksumValid === false ? 'error.main' :
                        transfer.checksumValid === true ? 'success.main' :
                        transfer.direction === 'upload' ? 'primary.main' : 'secondary.main'
              }
            }}
          />
          
          {transfer.status === 'completed' && transfer.checksumValid === true && transfer.blobUrl && (
            <Box mt={2} display="flex" justifyContent="space-between" alignItems="center">
              <Typography variant="caption" color="success.main" display="flex" alignItems="center" gap={0.5}>
                <VerifiedIcon fontSize="small" /> SHA-256 checksum verified
              </Typography>
              <Button
                startIcon={<FileDownloadIcon />}
                href={transfer.blobUrl}
                download={transfer.filename}
                variant="contained"
                size="small"
                color="success"
              >
                Save File
              </Button>
            </Box>
          )}
          
          {transfer.error && (
            <Typography variant="caption" color="error" display="block" mt={1}>
              Error: {transfer.error}
            </Typography>
          )}
        </Paper>
      ))}
    </Box>
  );
}
