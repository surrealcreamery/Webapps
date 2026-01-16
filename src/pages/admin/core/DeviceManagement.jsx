import React, { useState, useEffect } from 'react';
import {
  Box,
  CircularProgress,
  Typography,
  Button,
  Dialog,
  DialogContent,
  DialogActions,
  TextField,
  // ✨ ADDED: Imports for the full-screen dialog style
  AppBar,
  Toolbar,
  IconButton,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close'; // ✨ ADDED: Close icon for the AppBar
import AdminDataTable from '@/components/admin-datatable/admin-datatable';
import { useDevices, useUserPermissions } from '@/contexts/admin/AdminDataContext';
import { useQueryClient } from '@tanstack/react-query';
import { getAuth } from 'firebase/auth';

// ✨ NEW: A dedicated component for the "Add Device" dialog, matching the subscription page style.
const AddDeviceDialog = ({ open, onClose, onSave }) => {
  const [newDevice, setNewDevice] = useState({ fingerprint: '', 'Device Location': '' });

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setNewDevice((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = () => {
    onSave(newDevice);
    // Clear form for next time
    setNewDevice({ fingerprint: '', 'Device Location': '' });
  };

  return (
    <Dialog fullScreen open={open} onClose={onClose}>
      <AppBar position="sticky" sx={{ bgcolor: 'grey.200', color: 'black' }} elevation={0}>
        <Toolbar sx={{ minHeight: 48, display: 'flex', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <IconButton edge="start" onClick={onClose}><CloseIcon /></IconButton>
            <Typography variant="h6" sx={{ ml: 2 }}>
              Add New Device
            </Typography>
          </Box>
          <Button variant="contained" onClick={handleSave}>
            Save Device
          </Button>
        </Toolbar>
      </AppBar>
      <DialogContent sx={{ p: 3 }}>
        <TextField
          autoFocus
          margin="dense"
          name="fingerprint"
          label="Fingerprint"
          type="text"
          fullWidth
          variant="outlined"
          value={newDevice.fingerprint}
          onChange={handleInputChange}
          sx={{ mb: 2 }}
        />
        <TextField
          margin="dense"
          name="Device Location"
          label="Device Location"
          type="text"
          fullWidth
          variant="outlined"
          value={newDevice['Device Location']}
          onChange={handleInputChange}
        />
      </DialogContent>
    </Dialog>
  );
};


const DeviceManagementPage = () => {
  const queryClient = useQueryClient();
  const auth = getAuth();
  const { data: permissionsData } = useUserPermissions(auth.currentUser?.email);
  const fetchedPermissions = permissionsData?.['Device Management'] || {};
  const canView = !!fetchedPermissions?.view;
  const canEdit = !!fetchedPermissions?.edit;

  const { data: devices, isLoading, isError } = useDevices();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // ✨ REMOVED: State for the new device is now managed inside AddDeviceDialog.

  const columns = [
    { key: 'Device Location', label: 'Location', width: 200, sortable: true },
    { key: 'Status', label: 'Status', width: 150, sortable: true },
    { key: 'fingerprint', label: 'Fingerprint', width: 350, sortable: true },
    { key: 'createdTime', label: 'Created', width: 180, sortable: true, render: (row) => new Date(row.createdTime).toLocaleString() },
  ];

  const handleAddModalOpen = () => {
    setIsAddModalOpen(true);
  };

  const handleAddModalClose = () => {
    setIsAddModalOpen(false);
  };
  
  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['admin', 'devices'] });
  };

  const handleAddDevice = (deviceData) => {
    // This function should be replaced with a call to a useMutation hook.
    console.log('Attempting to add new device:', deviceData);
    handleAddModalClose();
  };

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (isError) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <Typography variant="h6" color="error">Error fetching device data.</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      {canView ? (
        <AdminDataTable
          title="Device Management"
          data={devices || []}
          columns={columns}
          defaultView={['Device Location', 'Status', 'fingerprint', 'createdTime']}
          searchKeys={['fingerprint', 'Device Location', 'Status']}
          onRefresh={handleRefresh}
          onAddClick={canEdit ? handleAddModalOpen : undefined}
          getRowId={(row) => row.id}
        />
      ) : (
        <Typography>You do not have permission to view this page.</Typography>
      )}

      {/* ✨ REPLACED: The old simple Dialog is replaced with the new styled component. */}
      <AddDeviceDialog 
        open={isAddModalOpen} 
        onClose={handleAddModalClose} 
        onSave={handleAddDevice} 
      />
    </Box>
  );
};

export default DeviceManagementPage;