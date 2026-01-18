import React, { useState } from 'react';
import {
  Box,
  CircularProgress,
  Typography,
  Button,
  Dialog,
  DialogContent,
  DialogActions,
  DialogTitle,
  TextField,
  IconButton,
  Chip,
  Paper,
  Tooltip,
  Alert,
  Snackbar,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import SendIcon from '@mui/icons-material/Send';
import WifiIcon from '@mui/icons-material/Wifi';
import AdminDataTable from '@/components/admin-datatable/admin-datatable';
import {
  useUserPermissions,
  createDevice,
  deleteDevice,
  getActiveConnections,
  sendDeviceCommand,
  createDeviceFromConnection,
} from '@/contexts/admin/AdminDataContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getAuth } from 'firebase/auth';

import ContentCopyIcon from '@mui/icons-material/ContentCopy';

// Add New Device Dialog - creates device with registration code
const AddDeviceDialog = ({ open, onClose, onSave, isLoading }) => {
  const [name, setName] = useState('');

  const handleSave = () => {
    if (name.trim()) {
      onSave(name.trim());
      setName('');
    }
  };

  const handleClose = () => {
    setName('');
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Add New Device</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          margin="dense"
          label="Device Name"
          placeholder="e.g., Kitchen Display - Main St"
          type="text"
          fullWidth
          variant="outlined"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSave()}
          sx={{ mt: 1 }}
        />
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
          After creating the device, you'll receive a 6-digit registration code to enter on the tablet.
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={isLoading}>Cancel</Button>
        <Button
          onClick={handleSave}
          variant="contained"
          disabled={!name.trim() || isLoading}
        >
          {isLoading ? <CircularProgress size={20} /> : 'Create Device'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// Registration Code Dialog - shows the code after creating a device
const RegistrationCodeDialog = ({ open, onClose, device }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (device?.platformData?.registrationCode) {
      navigator.clipboard.writeText(device.platformData.registrationCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const expiresIn = device?.platformData?.codeExpiresAt
    ? Math.max(0, Math.round((new Date(device.platformData.codeExpiresAt) - new Date()) / 1000 / 60))
    : 0;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Registration Code for "{device?.name}"</DialogTitle>
      <DialogContent>
        <Box sx={{ textAlign: 'center', py: 3 }}>
          <Typography variant="h2" sx={{ fontFamily: 'monospace', letterSpacing: 8, mb: 2 }}>
            {device?.platformData?.registrationCode || '------'}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Expires in {expiresIn} minutes
          </Typography>
          <Button
            variant="outlined"
            startIcon={<ContentCopyIcon />}
            onClick={handleCopy}
          >
            {copied ? 'Copied!' : 'Copy Code'}
          </Button>
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center' }}>
          Enter this code on the tablet's registration screen.
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};

// Register Device Dialog - for naming an unregistered connection
const RegisterDeviceDialog = ({ open, onClose, onSave, connection, isLoading }) => {
  const [name, setName] = useState('');

  const handleSave = () => {
    if (name.trim()) {
      onSave(name.trim(), connection);
      setName('');
    }
  };

  const handleClose = () => {
    setName('');
    onClose();
  };

  // Parse user agent to get device info
  const getDeviceInfo = (userAgent) => {
    if (!userAgent) return 'Unknown Device';
    if (userAgent.includes('iPad')) return 'iPad';
    if (userAgent.includes('iPhone')) return 'iPhone';
    if (userAgent.includes('Android')) {
      if (userAgent.includes('Mobile')) return 'Android Phone';
      return 'Android Tablet';
    }
    if (userAgent.includes('Windows')) return 'Windows PC';
    if (userAgent.includes('Macintosh')) return 'Mac';
    return 'Unknown Device';
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Register Device</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Give this device a name to identify it in the system.
        </Typography>
        <Box sx={{ mb: 2, p: 2, bgcolor: 'grey.100', borderRadius: 1 }}>
          <Typography variant="caption" color="text.secondary">Device Type</Typography>
          <Typography variant="body2">{getDeviceInfo(connection?.userAgent)}</Typography>
        </Box>
        <TextField
          autoFocus
          margin="dense"
          label="Device Name"
          placeholder="e.g., Kitchen Display - Main St"
          type="text"
          fullWidth
          variant="outlined"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSave()}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={isLoading}>Cancel</Button>
        <Button
          onClick={handleSave}
          variant="contained"
          disabled={!name.trim() || isLoading}
        >
          {isLoading ? <CircularProgress size={20} /> : 'Register Device'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// Confirm Delete Dialog
const ConfirmDeleteDialog = ({ open, onClose, onConfirm, deviceName, isLoading }) => (
  <Dialog open={open} onClose={onClose}>
    <DialogTitle>Delete Device</DialogTitle>
    <DialogContent>
      <Typography>
        Are you sure you want to delete "{deviceName}"? This action cannot be undone.
      </Typography>
    </DialogContent>
    <DialogActions>
      <Button onClick={onClose} disabled={isLoading}>Cancel</Button>
      <Button onClick={onConfirm} color="error" variant="contained" disabled={isLoading}>
        {isLoading ? <CircularProgress size={20} /> : 'Delete'}
      </Button>
    </DialogActions>
  </Dialog>
);

const DeviceManagementPage = () => {
  const queryClient = useQueryClient();
  const auth = getAuth();
  const { data: permissionsData } = useUserPermissions(auth.currentUser?.email);
  const fetchedPermissions = permissionsData?.['Device Management'] || {};
  const canView = !!fetchedPermissions?.view;
  const canEdit = !!fetchedPermissions?.edit;

  // Get current device info to identify "This Device"
  const currentClientUUID = localStorage.getItem('surreal_client_uuid');
  const storedDeviceId = localStorage.getItem('surreal_device_id');
  const isMasterBypass = storedDeviceId === 'MASTER_BYPASS';

  // Fetch active connections (which now includes device info)
  const { data: connections, isLoading, isError } = useQuery({
    queryKey: ['admin', 'activeConnections'],
    queryFn: getActiveConnections,
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  const [selectedConnection, setSelectedConnection] = useState(null);
  const [isRegisterDialogOpen, setIsRegisterDialogOpen] = useState(false);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isCodeDialogOpen, setIsCodeDialogOpen] = useState(false);
  const [newDevice, setNewDevice] = useState(null);
  const [deleteDevice_, setDeleteDevice] = useState(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  // Create new device mutation (generates registration code)
  const createMutation = useMutation({
    mutationFn: createDevice,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'activeConnections'] });
      setIsAddDialogOpen(false);
      if (data?.device) {
        setNewDevice(data.device);
        setIsCodeDialogOpen(true);
      }
      setSnackbar({ open: true, message: 'Device created successfully', severity: 'success' });
    },
    onError: (error) => {
      setSnackbar({ open: true, message: error.message || 'Failed to create device', severity: 'error' });
    },
  });

  // Register device from connection mutation
  const registerMutation = useMutation({
    mutationFn: ({ name, clientUUID, userAgent, connectionId }) => createDeviceFromConnection(name, clientUUID, userAgent, connectionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'activeConnections'] });
      setIsRegisterDialogOpen(false);
      setSelectedConnection(null);
      setSnackbar({ open: true, message: 'Device registered successfully', severity: 'success' });
    },
    onError: (error) => {
      setSnackbar({ open: true, message: error.message || 'Failed to register device', severity: 'error' });
    },
  });

  // Delete device mutation
  const deleteMutation = useMutation({
    mutationFn: deleteDevice,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'activeConnections'] });
      setDeleteDevice(null);
      setSnackbar({ open: true, message: 'Device deleted', severity: 'success' });
    },
    onError: (error) => {
      setSnackbar({ open: true, message: error.message || 'Failed to delete device', severity: 'error' });
    },
  });

  // Send command mutation
  const sendCommandMutation = useMutation({
    mutationFn: ({ command, deviceIds }) => sendDeviceCommand(command, deviceIds),
    onSuccess: (data) => {
      setSnackbar({
        open: true,
        message: `Command sent to ${data.sent} device(s)`,
        severity: 'success',
      });
    },
    onError: (error) => {
      setSnackbar({ open: true, message: error.message || 'Failed to send command', severity: 'error' });
    },
  });

  // Parse user agent to get device type
  const getDeviceType = (userAgent) => {
    if (!userAgent) return 'Unknown';
    if (userAgent.includes('iPad')) return 'iPad';
    if (userAgent.includes('iPhone')) return 'iPhone';
    if (userAgent.includes('Android')) {
      if (userAgent.includes('Mobile')) return 'Android';
      return 'Android Tablet';
    }
    if (userAgent.includes('Windows')) return 'Windows';
    if (userAgent.includes('Macintosh')) return 'Mac';
    return 'Browser';
  };

  // Debug logging
  React.useEffect(() => {
    console.log('[DeviceManagement] Current clientUUID from localStorage:', currentClientUUID);
    console.log('[DeviceManagement] Connections from API:', connections);
    if (connections) {
      connections.forEach(c => {
        console.log('[DeviceManagement] Connection clientUUID:', c.clientUUID, 'matches:', c.clientUUID === currentClientUUID);
      });
    }
  }, [connections, currentClientUUID]);

  // Group connections by clientUUID to deduplicate
  const groupedByClientUUID = React.useMemo(() => {
    if (!connections) return [];

    const grouped = {};
    for (const conn of connections) {
      const key = conn.clientUUID || conn.connectionId; // Use connectionId as fallback if no clientUUID
      if (!grouped[key]) {
        grouped[key] = {
          ...conn,
          connectionCount: 1,
          isConnected: true,
          connections: [conn],
        };
      } else {
        grouped[key].connectionCount++;
        grouped[key].connections.push(conn);
        // Use the most recent lastPing
        if (conn.lastPing && (!grouped[key].lastPing || new Date(conn.lastPing) > new Date(grouped[key].lastPing))) {
          grouped[key].lastPing = conn.lastPing;
          grouped[key].connectionId = conn.connectionId;
        }
      }
    }

    return Object.values(grouped);
  }, [connections]);

  // Helper to get display name for a device
  const getDeviceDisplayName = (row) => {
    // If it has a device name, use it
    if (row.deviceName) return row.deviceName;

    // Check if this is the current device (matching clientUUID)
    const isCurrentDevice = row.clientUUID && row.clientUUID === currentClientUUID;

    // If it's the current device and using master bypass, show "This Device"
    if (isCurrentDevice && isMasterBypass) {
      return 'This Device';
    }

    // Otherwise show as unregistered
    return null;
  };

  const columns = [
    {
      key: 'deviceName',
      label: 'Device Name',
      width: 200,
      sortable: true,
      render: (row) => {
        const displayName = getDeviceDisplayName(row);
        const isCurrentDevice = row.clientUUID && row.clientUUID === currentClientUUID;

        return (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="body2">
              {displayName || <em style={{ color: '#999' }}>Unregistered</em>}
            </Typography>
            {isCurrentDevice && (
              <Chip size="small" label="You" color="primary" sx={{ height: 20, fontSize: '0.7rem' }} />
            )}
          </Box>
        );
      },
    },
    {
      key: 'isConnected',
      label: 'Connected',
      width: 100,
      sortable: true,
      render: (row) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <WifiIcon color={row.isConnected ? 'success' : 'disabled'} fontSize="small" />
          <Typography variant="body2" color={row.isConnected ? 'success.main' : 'text.disabled'}>
            {row.isConnected ? 'Yes' : 'No'}
          </Typography>
          {row.connectionCount > 1 && (
            <Chip size="small" label={`×${row.connectionCount}`} sx={{ ml: 0.5, height: 20 }} />
          )}
        </Box>
      ),
    },
    {
      key: 'deviceStatus',
      label: 'Status',
      width: 120,
      sortable: true,
      render: (row) => (
        <Chip
          size="small"
          label={row.deviceStatus}
          color={row.deviceStatus === 'active' ? 'success' : row.deviceStatus === 'unregistered' ? 'warning' : 'default'}
        />
      ),
    },
    {
      key: 'deviceType',
      label: 'Device Type',
      width: 120,
      render: (row) => (
        <Typography variant="body2" color="text.secondary">
          {getDeviceType(row.userAgent)}
        </Typography>
      ),
    },
    {
      key: 'clientUUID',
      label: 'Client UUID',
      width: 150,
      render: (row) => (
        <Typography variant="body2" color="text.secondary" sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
          {row.clientUUID ? `${row.clientUUID.slice(0, 8)}...` : '—'}
        </Typography>
      ),
    },
    {
      key: 'lastPing',
      label: 'Last Ping',
      width: 180,
      sortable: true,
      render: (row) => {
        if (!row.lastPing) return <Typography variant="body2" color="text.secondary">—</Typography>;
        return new Date(row.lastPing).toLocaleString();
      },
    },
    {
      key: 'actions',
      label: 'Actions',
      width: 150,
      render: (row) => (
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          {row.deviceStatus === 'unregistered' ? (
            <Button
              size="small"
              variant="contained"
              onClick={() => {
                setSelectedConnection(row);
                setIsRegisterDialogOpen(true);
              }}
              disabled={!canEdit}
            >
              Register
            </Button>
          ) : (
            <Tooltip title="Delete Device">
              <IconButton
                size="small"
                color="error"
                onClick={() => setDeleteDevice(row)}
                disabled={!canEdit}
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      ),
    },
  ];

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['admin', 'activeConnections'] });
  };

  const handleRefreshAllDevices = () => {
    sendCommandMutation.mutate({ command: 'refresh', deviceIds: null });
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

  const registeredCount = groupedByClientUUID.filter(c => c.deviceStatus === 'active').length;
  const unregisteredCount = groupedByClientUUID.filter(c => c.deviceStatus === 'unregistered').length;
  const totalConnections = (connections || []).length;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      {canView ? (
        <>
          {/* Quick Actions Bar */}
          <Paper sx={{ p: 2, mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box>
              <Typography variant="subtitle2" color="text.secondary">
                {groupedByClientUUID.length} unique device(s) ({totalConnections} connection{totalConnections !== 1 ? 's' : ''}) — {registeredCount} registered, {unregisteredCount} unregistered
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                variant="outlined"
                startIcon={<SendIcon />}
                onClick={handleRefreshAllDevices}
                disabled={sendCommandMutation.isPending || !canEdit}
              >
                Refresh All Tablets
              </Button>
            </Box>
          </Paper>

          <AdminDataTable
            title="Connected Devices"
            data={groupedByClientUUID}
            columns={columns}
            defaultView={['deviceName', 'isConnected', 'deviceStatus', 'deviceType', 'clientUUID', 'lastPing', 'actions']}
            searchKeys={['deviceName', 'deviceStatus', 'clientUUID']}
            onRefresh={handleRefresh}
            onAddClick={canEdit ? () => setIsAddDialogOpen(true) : undefined}
            getRowId={(row) => row.clientUUID || row.connectionId}
          />
        </>
      ) : (
        <Typography>You do not have permission to view this page.</Typography>
      )}

      {/* Add Device Dialog (creates with code) */}
      <AddDeviceDialog
        open={isAddDialogOpen}
        onClose={() => setIsAddDialogOpen(false)}
        onSave={(name) => createMutation.mutate(name)}
        isLoading={createMutation.isPending}
      />

      {/* Registration Code Dialog */}
      <RegistrationCodeDialog
        open={isCodeDialogOpen}
        onClose={() => {
          setIsCodeDialogOpen(false);
          setNewDevice(null);
        }}
        device={newDevice}
      />

      {/* Register Device Dialog (for connected devices) */}
      <RegisterDeviceDialog
        open={isRegisterDialogOpen}
        onClose={() => {
          setIsRegisterDialogOpen(false);
          setSelectedConnection(null);
        }}
        onSave={(name, connection) => {
          registerMutation.mutate({
            name,
            clientUUID: connection.clientUUID,
            userAgent: connection.userAgent,
            connectionId: connection.connectionId,
          });
        }}
        connection={selectedConnection}
        isLoading={registerMutation.isPending}
      />

      {/* Confirm Delete Dialog */}
      <ConfirmDeleteDialog
        open={!!deleteDevice_}
        onClose={() => setDeleteDevice(null)}
        onConfirm={() => deleteMutation.mutate(deleteDevice_?.deviceId)}
        deviceName={deleteDevice_?.deviceName}
        isLoading={deleteMutation.isPending}
      />

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert severity={snackbar.severity} onClose={() => setSnackbar({ ...snackbar, open: false })}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default DeviceManagementPage;
