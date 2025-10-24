import React, { useState } from 'react';
import {
  Box,
  Typography,
  List,
  ListItem,
  ListItemIcon,
  Paper,
  IconButton,
  Checkbox,
  CircularProgress,
  Dialog,
  AppBar,
  Toolbar,
  TextField,
  Button,
  Snackbar,
  Alert,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import { useNavigate } from 'react-router-dom';
import { getAuth } from 'firebase/auth';
import { useUsers, useCreateUser } from '@/contexts/admin/AdminDataContext';

const Access = () => {
  const { data: users = [], isLoading: loadingUsers } = useUsers();
  const createUserMutation = useCreateUser();

  const [selectedUsers, setSelectedUsers] = useState([]);
  const [addOpen, setAddOpen] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [addUserError, setAddUserError] = useState('');
  const navigate = useNavigate();

  const toggleSelect = email => {
    setSelectedUsers(prev =>
      prev.includes(email) ? prev.filter(e => e !== email) : [...prev, email]
    );
  };

  const handleAddOpen = () => setAddOpen(true);
  const handleAddClose = () => {
    setAddOpen(false);
    setNewEmail('');
    setAddUserError('');
  };

  const handleAddSave = async () => {
    if (!newEmail.trim()) {
      setSnackbar({ open: true, message: 'Email cannot be empty.', severity: 'warning' });
      return;
    }
    setAddUserError('');
    try {
      await createUserMutation.mutateAsync({ email: newEmail.trim() });
      setSnackbar({ open: true, message: 'User added successfully!', severity: 'success' });
      handleAddClose();
    } catch (error) {
      let errorInfo = null;
      if (error.info) {
        try {
          errorInfo = typeof error.info === 'string' ? JSON.parse(error.info) : error.info;
        } catch (e) {
          errorInfo = { message: error.info };
        }
      }
      if (error.status === 400 && errorInfo && errorInfo.message === 'Duplicate User Found') {
        setAddUserError(errorInfo.message);
      } else {
        const errorMsg = (errorInfo && errorInfo.message) || error.message || 'An unknown error occurred.';
        setSnackbar({ open: true, message: `Failed to add user: ${errorMsg}`, severity: 'error' });
      }
    }
  };

  const handleDeleteUsers = () => {
    console.warn("Delete functionality is not fully implemented with a backend endpoint.");
    setSelectedUsers([]);
  };

  const handleUserClick = (email) => {
    navigate(`/admin/access/${encodeURIComponent(email)}`);
  };

  return (
    <Box sx={{ width: '100%' }}>
      <Snackbar open={snackbar.open} autoHideDuration={6000} onClose={() => setSnackbar({ ...snackbar, open: false })} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert onClose={() => setSnackbar({ ...snackbar, open: false })} severity={snackbar.severity} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
      <Box
        sx={{
          position: 'fixed',
          top: 48,
          left: 0,
          right: 0,
          zIndex: 1100,
          bgcolor: 'white',
          borderBottom: '1px solid #ddd',
          display: 'flex',
          gap: 2,
          px: 2,
          py: 1,
        }}
      >
        <Box onClick={handleAddOpen} sx={{ display: 'flex', alignItems: 'center', cursor: 'pointer', color: 'primary.main', '&:hover': { opacity: 0.8 } }}>
          <AddIcon fontSize="small" />
          <Typography variant="body2" sx={{ ml: 0.5 }}>Add User</Typography>
        </Box>
        <Box onClick={handleDeleteUsers} sx={{ display: 'flex', alignItems: 'center', cursor: selectedUsers.length ? 'pointer' : 'not-allowed', color: selectedUsers.length ? 'primary.main' : 'text.disabled', '&:hover': selectedUsers.length ? { opacity: 0.8 } : undefined }}>
          <DeleteIcon fontSize="small" />
          <Typography variant="body2" sx={{ ml: 0.5 }}>Delete User{selectedUsers.length > 1 ? 's' : ''}</Typography>
        </Box>
      </Box>

      <Box sx={{ width: '100%', maxWidth: '600px', mx: 'auto', p: 3, pt: '60px' }}>
        <Paper sx={{ boxShadow: 1 }}>
          {loadingUsers ? (
            <Box sx={{ textAlign: 'center', py: 4 }}><CircularProgress /></Box>
          ) : (
            <List disablePadding>
              {users.length > 0 ? (
                users.map(({ email }) => (
                  <ListItem key={email} disablePadding sx={{ display: 'flex', alignItems: 'center', py: 1, px: 2 }}>
                    <ListItemIcon sx={{ minWidth: 0, mr: 1, display: 'flex', alignItems: 'center' }}>
                      <Checkbox edge="start" checked={selectedUsers.includes(email)} tabIndex={-1} disableRipple onChange={() => toggleSelect(email)} />
                    </ListItemIcon>
                    <Typography component="span" sx={{ cursor: 'pointer', color: 'text.primary', '&:hover': {textDecoration: 'underline'} }} onClick={() => handleUserClick(email)}>
                      {email}
                    </Typography>
                  </ListItem>
                ))
              ) : (
                <Typography color="text.secondary" sx={{p: 2}}>No users found.</Typography>
              )}
            </List>
          )}
        </Paper>
      </Box>

      <Dialog fullScreen open={addOpen} onClose={handleAddClose}>
        <AppBar position="sticky" color="default" elevation={1}>
          <Toolbar>
            <IconButton edge="start" onClick={handleAddClose}><CloseIcon /></IconButton>
            <Typography variant="h6" sx={{ ml: 2 }}>Add User</Typography>
          </Toolbar>
        </AppBar>
        <Box sx={{ width: '100%', maxWidth: '600px', mx: 'auto', p: 3, pt: 3 }}>
          {addUserError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {addUserError}
            </Alert>
          )}
          <TextField
            label="Email Address"
            value={newEmail}
            onChange={e => {
              setNewEmail(e.target.value);
              if (addUserError) setAddUserError('');
            }}
            fullWidth
            error={!!addUserError}
          />
          <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
            <Button variant="contained" onClick={handleAddSave} disabled={createUserMutation.isPending}>
              {createUserMutation.isPending ? <CircularProgress size={24} color="inherit" /> : 'Save'}
            </Button>
            <Button variant="outlined" onClick={handleAddClose}>Cancel</Button>
          </Box>
        </Box>
      </Dialog>
    </Box>
  );
};

export default Access;