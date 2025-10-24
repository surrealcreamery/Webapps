// src/pages/admin/subscription/PricingModels.jsx

import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  AppBar,
  Toolbar,
  TextField,
  Button,
  Card,
  CardContent,
  IconButton,
  ToggleButtonGroup,
  ToggleButton,
  Snackbar,
  Alert,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import AddIcon from '@mui/icons-material/Add';
import RefreshIcon from '@mui/icons-material/Refresh';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { getAuth } from 'firebase/auth';
import { useUserPermissions } from '@/contexts/admin/AdminDataContext';
import { useQuery } from '@tanstack/react-query';

//const TYPE_ORDER = ['Renewal', 'Acquisition', 'Deprecated'];

const TYPE_ORDER = ['Renewal', 'Acquisition', 'Deprecated'];
const STATUS_COLORS = { Active: 'success.main', Inactive: 'error.main' };

function PricingCard({ model, provided }) {
  const textColor = model.Status === 'Inactive' ? 'text.disabled' : 'inherit';
  return (
    <Card
      ref={provided.innerRef}
      {...provided.draggableProps}
      {...provided.dragHandleProps}
      onClick={() => model.onClick(model)}
      sx={{ position: 'relative', width: '100%', cursor: 'pointer' }}
    >
      <Box
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          bgcolor: STATUS_COLORS[model.Status],
          color: 'common.white',
          px: 1,
          py: 0.5,
          borderBottomRightRadius: 1,
          fontSize: '0.75rem',
          fontWeight: 'bold',
          textTransform: 'uppercase',
        }}
      >
        {model.Status}
      </Box>
      <CardContent sx={{ pt: 3, color: textColor }}>
        <Typography variant="h6" gutterBottom>
          {model.Name}
        </Typography>
        <Typography variant="body2" gutterBottom>
          <strong>Friendly Name:</strong> {model['Friendly Name'] || '—'}
        </Typography>
        <Typography variant="body2">
          <strong>Description:</strong> {model.Description || '—'}
        </Typography>
      </CardContent>
    </Card>
  );
}

export default function PricingModels() {
  // grab current user email from Firebase
  const email = getAuth().currentUser?.email;

  // fetch current permissions for this user
  const {
    data: perms = {},
    isLoading: permsLoading,
    isError: permsError
  } = useUserPermissions(email);

  // while permissions are loading, show full‐screen spinner
  if (permsLoading) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh'
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  // if unable to fetch permissions, show error
  if (permsError) {
    return (
      <Box sx={{ p: 4 }}>
        <Typography color="error">
          Error loading permissions. Please try again.
        </Typography>
      </Box>
    );
  }

  // if user lacks access to Pricing Models, show no‐access screen
  if (!perms['Pricing Models']?.access) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
          bgcolor: 'background.default',
          p: 3
        }}
      >
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="h6">No access to Pricing Models</Typography>
        </Paper>
      </Box>
    );
  }

  // UI state
  const [grouped, setGrouped] = useState({
    Renewal: [],
    Acquisition: [],
    Deprecated: []
  });
  const [addOpen, setAddOpen] = useState(false);
  const [editModel, setEditModel] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [newStatus, setNewStatus] = useState('Active');
  const [newType, setNewType] = useState('Acquisition');
  const [newName, setNewName] = useState('');
  const [newFriendly, setNewFriendly] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [deleteSnackbarOpen, setDeleteSnackbarOpen] = useState(false);

  // Fetch & cache
  const {
    data: rawData = [],
    isLoading,
    isFetching,
    refetch
  } = useQuery({
    queryKey: ['pricingModels'],
    queryFn: async () => {
      const token = await getAuth().currentUser.getIdToken();
      const res = await fetch(
        'https://hook.us2.make.com/t6lj7fteskrel9x9ztcig43xxwf62xqc',
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );
      if (!res.ok) {
        throw new Error(`Fetch failed: ${res.status}`);
      }
      return res.json();
    },
    staleTime:           Infinity,
    refetchOnWindowFocus:false,
    refetchOnMount:      true,
    retry:               false,
    onError:             (err) => console.error('Fetch error:', err)
  });

  // Group & sort whenever data changes
  useEffect(() => {
    if (!Array.isArray(rawData)) {
      return;
    }
    const buckets = { Renewal: [], Acquisition: [], Deprecated: [] };
    rawData.forEach((item) => {
      if (TYPE_ORDER.includes(item.Type)) {
        buckets[item.Type].push({
          id: item.id,
          Name: item.Name,
          Status: item.Status,
          'Friendly Name': item['Friendly Name'] || '',
          Description: item.Description || '',
          Type: item.Type,
          Ordinal: item.Ordinal,
          onClick: (m) => setEditModel(m),
        });
      }
    });
    TYPE_ORDER.forEach((type) => {
      buckets[type].sort(
        (a, b) => (a.Ordinal ?? Infinity) - (b.Ordinal ?? Infinity)
      );
    });
    setGrouped(buckets);
    setSnackbarOpen(true);
  }, [rawData]);

  // Refresh handler
  const handleRefresh = async () => {
    await refetch();
    setSnackbarOpen(true);
  };

  const handleSnackbarClose = () => {
    setSnackbarOpen(false);
  };

  const handleDeleteSnackbarClose = () => {
    setDeleteSnackbarOpen(false);
  };

  // Drag & drop
  const onDragEnd = ({ source, destination }) => {
    if (!destination || source.droppableId !== destination.droppableId) {
      return;
    }
    const list = Array.from(grouped[source.droppableId]);
    const [m] = list.splice(source.index, 1);
    list.splice(destination.index, 0, m);
    setGrouped((g) => ({ ...g, [source.droppableId]: list }));
  };

  // Add Model
  const handleAddOpen = () => {
    setAddOpen(true);
  };
  const handleAddClose = () => {
    setAddOpen(false);
    setNewStatus('Active');
    setNewType('Acquisition');
    setNewName('');
    setNewFriendly('');
    setNewDescription('');
  };
  const handleAddSave = async () => {
    if (!newName.trim()) {
      return;
    }
    const payload = {
      Name: newName.trim(),
      'Friendly Name': newFriendly.trim(),
      Description: newDescription.trim(),
      Status: newStatus,
      Type: newType,
    };
    try {
      const token = await getAuth().currentUser.getIdToken();
      const res = await fetch(
        'https://hook.us2.make.com/d26n74q2eg84gtvvdjyxqt1gpgr5rbxg',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify(payload)
        }
      );
      if (res.ok) {
        const [created] = await res.json();
        const nm = {
          id: created.id,
          Name: created.Name,
          Status: created.Status,
          'Friendly Name': created['Friendly Name'] || '',
          Description: created.Description || '',
          Type: created.Type,
          Ordinal: created.Ordinal,
          onClick: (m) => setEditModel(m),
        };
        setGrouped((g) => {
          const u = { ...g };
          u[nm.Type] = [nm, ...u[nm.Type]];
          u[nm.Type].sort(
            (a, b) => (a.Ordinal ?? Infinity) - (b.Ordinal ?? Infinity)
          );
          return u;
        });
      } else {
        console.error(`Add failed: ${res.status}`);
      }
    } catch (err) {
      console.error('Add failed', err);
    }
    handleAddClose();
  };

  // Delete Model (confirmation)
  const handleDeleteClick = () => {
    setConfirmOpen(true);
  };
  const handleConfirmDelete = async () => {
    setConfirmOpen(false);
    try {
      const token = await getAuth().currentUser.getIdToken();
      const res = await fetch(
        'https://hook.us2.make.com/lsslqdlgdwgoja0f6g1ljonp81oulfuc',
        {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ id: editModel.id })
        }
      );
      if (!res.ok) {
        throw new Error(`Delete failed: ${res.status}`);
      }
      setGrouped((g) => ({
        ...g,
        [editModel.Type]: g[editModel.Type].filter(
          (m) => m.id !== editModel.id
        )
      }));
      setEditModel(null);
      setDeleteSnackbarOpen(true);
    } catch (err) {
      console.error(err);
    }
  };

  // Edit Save
  const handleEditSave = async () => {
    try {
      const token = await getAuth().currentUser.getIdToken();
      const res = await fetch(
        'https://hook.us2.make.com/49l2u1uhlnkgre3c9bnqix43qo3jedrr',
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            id: editModel.id,
            Name: editModel.Name,
            'Friendly Name': editModel['Friendly Name'],
            Description: editModel.Description,
            Status: editModel.Status,
            Type: editModel.Type,
            Ordinal: editModel.Ordinal,
          })
        }
      );
      if (!res.ok) {
        throw new Error(`Update failed: ${res.status}`);
      }
    } catch (err) {
      console.error('Update failed', err);
      return;
    }
    setGrouped((g) => {
      const u = { ...g };
      u[editModel.Type] = u[editModel.Type]
        .map((m) => (m.id === editModel.id ? editModel : m))
        .sort((a, b) => (a.Ordinal ?? Infinity) - (b.Ordinal ?? Infinity));
      return u;
    });
    setEditModel(null);
  };

  return (
    <Box sx={{ width: '100%' }}>
      {/* Toolbar */}
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
        <Box
          onClick={handleRefresh}
          sx={{
            display: 'flex',
            alignItems: 'center',
            cursor: 'pointer',
            color: 'primary.main',
            '&:hover': { opacity: 0.8 },
          }}
        >
          {isFetching ? <CircularProgress size={20} /> : <RefreshIcon fontSize="small" />}
          <Typography variant="body2" sx={{ ml: 0.5 }}>
            Refresh
          </Typography>
        </Box>
        <Box
          onClick={handleAddOpen}
          sx={{
            display: 'flex',
            alignItems: 'center',
            cursor: 'pointer',
            color: 'primary.main',
            '&:hover': { opacity: 0.8 },
          }}
        >
          <AddIcon fontSize="small" />
          <Typography variant="body2" sx={{ ml: 0.5 }}>
            Add Model
          </Typography>
        </Box>
      </Box>

      {/* Refresh Snackbar */}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={3000}
        onClose={handleSnackbarClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={handleSnackbarClose} severity="success" sx={{ width: '100%' }}>
          Data refreshed
        </Alert>
      </Snackbar>

      {/* Delete Snackbar */}
      <Snackbar
        open={deleteSnackbarOpen}
        autoHideDuration={3000}
        onClose={handleDeleteSnackbarClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={handleDeleteSnackbarClose} severity="success" sx={{ width: '100%' }}>
          Model deleted
        </Alert>
      </Snackbar>

      {/* Cards */}
      <Box sx={{ mt: 2, px: 0, pb: 6 }}>
        {isLoading ? (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        ) : (
          <DragDropContext onDragEnd={onDragEnd}>
            {TYPE_ORDER.map((type) => (
              <Box
                key={type}
                sx={{
                  mb: 4,
                  width: '100%',
                  maxWidth: 600,
                  mx: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 2,
                }}
              >
                <Typography
                  variant="subtitle2"
                  sx={{ fontWeight: 'bold', fontSize: '0.875rem' }}
                >
                  {type.toUpperCase()}
                </Typography>
                <Droppable droppableId={type}>
                  {(prov) => (
                    <Box
                      ref={prov.innerRef}
                      {...prov.droppableProps}
                      sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}
                    >
                      {grouped[type].map((model, idx) => (
                        <Draggable key={model.id} draggableId={model.id} index={idx}>
                          {(provided) => <PricingCard model={model} provided={provided} />}
                        </Draggable>
                      ))}
                      {prov.placeholder}
                    </Box>
                  )}
                </Droppable>
              </Box>
            ))}
          </DragDropContext>
        )}
      </Box>

      {/* Add Modal */}
      <Dialog fullScreen open={addOpen} onClose={handleAddClose}>
        <AppBar position="sticky" color="default" elevation={1}>
          <Toolbar>
            <IconButton edge="start" onClick={handleAddClose}>
              <CloseIcon />
            </IconButton>
            <Typography variant="h6" sx={{ ml: 2 }}>
              Add Pricing Model
            </Typography>
          </Toolbar>
        </AppBar>
        <Box
          component="form"
          sx={{
            p: 2,
            height: '100%',
            overflowY: 'auto',
            width: '100%',
            maxWidth: 600,
            mx: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
          }}
        >
          <ToggleButtonGroup
            exclusive
            value={newStatus}
            onChange={(_, v) => v && setNewStatus(v)}
            size="small"
            sx={{ mb: 2 }}
          >
            <ToggleButton value="Active">ACTIVE</ToggleButton>
            <ToggleButton value="Inactive">INACTIVE</ToggleButton>
          </ToggleButtonGroup>
          <ToggleButtonGroup
            exclusive
            value={newType}
            onChange={(_, v) => v && setNewType(v)}
            size="small"
            sx={{ mb: 2 }}
          >
            <ToggleButton value="Renewal">RENEWAL</ToggleButton>
            <ToggleButton value="Acquisition">ACQUISITION</ToggleButton>
            <ToggleButton value="Deprecated">DEPRECATED</ToggleButton>
          </ToggleButtonGroup>
          <TextField
            label="Model Name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            fullWidth
          />
          <TextField
            label="Friendly Name"
            value={newFriendly}
            onChange={(e) => setNewFriendly(e.target.value)}
            fullWidth
          />
          <TextField
            label="Description"
            value={newDescription}
            onChange={(e) => setNewDescription(e.target.value)}
            fullWidth
            multiline
            rows={3}
          />
          <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
            <Button variant="contained" onClick={handleAddSave}>
              Save
            </Button>
            <Button variant="outlined" onClick={handleAddClose}>
              Cancel
            </Button>
          </Box>
        </Box>
      </Dialog>

      {/* Edit Modal */}
      {editModel && (
        <Dialog fullScreen open onClose={() => setEditModel(null)}>
          <AppBar position="sticky" color="default" elevation={1}>
            <Toolbar>
              <IconButton edge="start" onClick={() => setEditModel(null)}>
                <CloseIcon />
              </IconButton>
              <Typography variant="h6" sx={{ ml: 2 }}>
                Edit Pricing Model
              </Typography>
            </Toolbar>
          </AppBar>
          <Box
            component="form"
            sx={{
              p: 2,
              height: '100%',
              overflowY: 'auto',
              width: '100%',
              maxWidth: 600,
              mx: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
            }}
          >
            <ToggleButtonGroup
              exclusive
              value={editModel.Status}
              onChange={(_, v) => v && setEditModel((m) => ({ ...m, Status: v }))}
              size="small"
              sx={{ mb: 2 }}
            >
              <ToggleButton value="Active">ACTIVE</ToggleButton>
              <ToggleButton value="Inactive">INACTIVE</ToggleButton>
            </ToggleButtonGroup>
            <ToggleButtonGroup
              exclusive
              value={editModel.Type}
              onChange={(_, v) => v && setEditModel((m) => ({ ...m, Type: v }))}
              size="small"
              sx={{ mb: 2 }}
            >
              <ToggleButton value="Renewal">RENEWAL</ToggleButton>
              <ToggleButton value="Acquisition">ACQUISITION</ToggleButton>
              <ToggleButton value="Deprecated">DEPRECATED</ToggleButton>
            </ToggleButtonGroup>
            <TextField
              label="Model Name"
              value={editModel.Name}
              onChange={(e) => setEditModel((m) => ({ ...m, Name: e.target.value }))}
              fullWidth
            />
            <TextField
              label="Friendly Name"
              value={editModel['Friendly Name']}
              onChange={(e) =>
                setEditModel((m) => ({ ...m, 'Friendly Name': e.target.value }))
              }
              fullWidth
            />
            <TextField
              label="Description"
              value={editModel.Description}
              onChange={(e) => setEditModel((m) => ({ ...m, Description: e.target.value }))}
              fullWidth
              multiline
              rows={3}
            />
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 2 }}>
              <Button variant="contained" onClick={handleEditSave}>
                Save
              </Button>
              <Button variant="outlined" onClick={() => setEditModel(null)}>
                Cancel
              </Button>
              <Button
                variant="outlined"
                color="error"
                sx={{ ml: 'auto' }}
                onClick={handleDeleteClick}
              >
                DELETE MODEL
              </Button>
            </Box>
          </Box>
        </Dialog>
      )}

      {/* Confirm Delete Dialog */}
      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)}>
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <Typography>Are you sure you want to delete “{editModel?.Name}”?</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmOpen(false)}>Cancel</Button>
          <Button color="error" onClick={handleConfirmDelete}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
