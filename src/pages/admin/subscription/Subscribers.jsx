// src/pages/admin/subscription/Subscribers.jsx

import React, { useState, useMemo, useCallback } from 'react';
import AdminDataTable from '@/components/admin-datatable/admin-datatable';
import {
  Box,
  Paper,
  Typography,
  Dialog,
  TextField,
  Button,
  CircularProgress,
  AppBar,
  Toolbar,
  IconButton,
  DialogContent
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { getAuth } from 'firebase/auth';
// ✨ FIX: Import the data hook from your context
import { useSubscribers } from '@/contexts/admin/AdminDataContext';

/**
 * Subscribers page
 * Renders a data table of subscribers, gated by both page‐level access
 * and component‐level AdminDataTable permission.
 */
export default function Subscribers({ fetchedPermissions }) {
  // ✨ FIX: Fetch data using the custom hook from your AdminDataContext
  const { data: subscribersData, isLoading, error } = useSubscribers();
  
  const [isDialogOpen, setDialogOpen] = useState(false);
  const [editingSubscriber, setEditingSubscriber] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [filters, setFilters] = useState({});

  // ───────────────────────────────────────────────────────────────────────────────
  // Page‐level access check
  // ✨ FIX: Made the access check more robust
  // ───────────────────────────────────────────────────────────────────────────────
  const hasAccess = fetchedPermissions?.Subscribers?.view || fetchedPermissions?.view;

  if (!hasAccess) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', bgcolor: 'background.default', p: 3 }}>
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="h6">No access to Subscribers</Typography>
        </Paper>
      </Box>
    );
  }

  // ───────────────────────────────────────────────────────────────────────────────
  // Handlers
  // ───────────────────────────────────────────────────────────────────────────────
  const handleRowClick = (subscriber) => {
    setEditingSubscriber({ ...subscriber });
    setDialogOpen(true);
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    setEditingSubscriber(null);
  };

  const handleInputChange = (event) => {
    const { name, value } = event.target;
    setEditingSubscriber(prev => ({ ...prev, [name]: value }));
  };

  const handleSaveChanges = async () => {
    if (!editingSubscriber) return;
    setIsSaving(true);
    // TODO: Replace with your actual update endpoint and use a React Query mutation
    // for better state management (e.g., useUpdateSubscriber).
    const updateUrl = "https://hook.us2.make.com/your-update-endpoint";
    try {
      const user = getAuth().currentUser;
      if (!user) throw new Error("Authentication error: No user is signed in.");
      const token = await user.getIdToken();
      const response = await fetch(updateUrl, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(editingSubscriber),
      });
      if (!response.ok) throw new Error(`Failed to save. Server responded with ${response.status}`);
      // After a successful save, you should invalidate the 'subscribers' query
      // to refetch the data automatically, instead of manually updating state.
      handleDialogClose();
    } catch (saveError) {
      console.error("Error saving subscriber:", saveError);
    } finally {
      setIsSaving(false);
    }
  };

  const handleFilterChange = useCallback((key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  }, []);

  // ───────────────────────────────────────────────────────────────────────────────
  // Table Configuration
  // ───────────────────────────────────────────────────────────────────────────────
  const columns = useMemo(() => [
    { key: 'Display Name', label: 'Name', sortable: true, filter: { type: 'text' } },
    { key: 'Email', label: 'Email', sortable: true, filter: { type: 'text' } },
    { key: 'Phone', label: 'Phone', sortable: true, filter: { type: 'text' } },
  ], []);

  const views = useMemo(() => [{ name: 'Basic Info', columns: ['Display Name', 'Email', 'Phone'] }], []);
  
  const defaultView = useMemo(() => views[0].columns, [views]);

  // ───────────────────────────────────────────────────────────────────────────────
  // Render Logic
  // ───────────────────────────────────────────────────────────────────────────────
  if (isLoading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>;
  }

  if (error) {
    return <Box sx={{ p: 3, textAlign: 'center' }}><Typography color="error">Failed to load data: {error.message}</Typography></Box>;
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      {hasAccess && (
        <AdminDataTable
          title="Subscribers"
          data={subscribersData || []}
          searchKeys={['Display Name', 'Email', 'Phone']}
          views={views}
          columns={columns}
          defaultView={defaultView}
          filters={filters}
          onFilterChange={handleFilterChange}
          onRowClick={handleRowClick}
        />
      )}

      <Dialog fullScreen open={isDialogOpen} onClose={handleDialogClose}>
        <AppBar position="sticky" sx={{ bgcolor: 'background.paper', color: 'text.primary' }} elevation={1}>
          <Toolbar>
            <IconButton edge="start" onClick={handleDialogClose} aria-label="close">
              <CloseIcon />
            </IconButton>
            <Typography sx={{ ml: 2, flex: 1 }} variant="h6" component="div">
              {`Edit: ${editingSubscriber?.['Display Name'] || 'Subscriber'}`}
            </Typography>
          </Toolbar>
        </AppBar>

        <DialogContent>
          <Box
            component="form"
            sx={{
              maxWidth: 'sm',
              mx: 'auto',
              p: 3,
            }}
          >
            {editingSubscriber && (
              <>
                <Typography variant="h5" gutterBottom>Subscriber Information</Typography>
                <TextField
                  name="First Name"
                  label="First Name"
                  value={editingSubscriber['First Name'] || ''}
                  onChange={handleInputChange}
                  fullWidth
                  margin="normal"
                />
                <TextField
                  name="Last Name"
                  label="Last Name"
                  value={editingSubscriber['Last Name'] || ''}
                  onChange={handleInputChange}
                  fullWidth
                  margin="normal"
                />
                <TextField
                  name="Email"
                  label="Email"
                  type="email"
                  value={editingSubscriber.Email || ''}
                  onChange={handleInputChange}
                  fullWidth
                  margin="normal"
                />
                <TextField
                  name="Phone"
                  label="Phone"
                  type="tel"
                  value={editingSubscriber.Phone || ''}
                  onChange={handleInputChange}
                  fullWidth
                  margin="normal"
                />
                <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
                  <Button
                    variant="contained"
                    onClick={handleSaveChanges}
                    disabled={isSaving}
                    sx={{ minWidth: 150, height: 40 }}
                  >
                    {isSaving ? <CircularProgress size={24} color="inherit" /> : 'Save Changes'}
                  </Button>
                </Box>
              </>
            )}
          </Box>
        </DialogContent>
      </Dialog>
    </Box>
  );
}
