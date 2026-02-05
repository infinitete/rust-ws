import { List, ListItem, ListItemAvatar, ListItemText, Avatar, Paper, Typography, Badge, Box } from '@mui/material';
import PersonIcon from '@mui/icons-material/Person';

interface UserListProps {
  users: string[];
  currentUser: string | null;
  onSelectUser: (user: string) => void;
}

export function UserList({ users, currentUser, onSelectUser }: UserListProps) {
  return (
    <Paper variant="outlined" sx={{ height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider', bgcolor: 'rgba(255,255,255,0.02)' }}>
        <Typography variant="h6" color="primary.main" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box component="span" sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'success.main', boxShadow: '0 0 8px #00ff9f' }} />
          Online Users ({users.length})
        </Typography>
      </Box>
      <List sx={{ flex: 1, overflowY: 'auto' }}>
        {users.map((user) => (
          <ListItem
            key={user}
            button
            onClick={() => user !== currentUser && onSelectUser(user)}
            disabled={user === currentUser}
            sx={{
              '&:hover': {
                bgcolor: 'rgba(0, 240, 255, 0.05)'
              }
            }}
          >
            <ListItemAvatar>
              <Badge
                overlap="circular"
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                variant="dot"
                color="success"
              >
                <Avatar sx={{ bgcolor: user === currentUser ? 'secondary.main' : 'primary.main' }}>
                  <PersonIcon />
                </Avatar>
              </Badge>
            </ListItemAvatar>
            <ListItemText
              primary={
                <Typography color="text.primary" fontWeight={user === currentUser ? 'bold' : 'normal'}>
                  {user} {user === currentUser && '(You)'}
                </Typography>
              }
            />
          </ListItem>
        ))}
      </List>
    </Paper>
  );
}
