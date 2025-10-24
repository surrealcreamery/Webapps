// src/components/plan/add-plan-id-dialog/add-plan-id-dialog.jsx
import React, { useState, useEffect } from 'react';
import {
  Dialog,
  AppBar,
  Toolbar,
  IconButton,
  Typography,
  DialogContent,
  Box,
  TextField,
  Button
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { v4 as uuidv4 } from 'uuid';

export default function AddPlanIdDialog({ open, onClose, onAdd }) {
  const [form, setForm] = useState({
    idempotency_key: '',
    id: '',
    type: 'SUBSCRIPTION_PLAN',
    present_at_all_locations: true,
    all_items: false,
    name: ''
  });

  // seed hidden fields when dialog opens
  useEffect(() => {
    if (open) {
      setForm({
        idempotency_key: uuidv4(),
        id: Math.floor(Math.random() * 1_000_000).toString(),
        type: 'SUBSCRIPTION_PLAN',
        present_at_all_locations: true,
        all_items: false,
        name: ''
      });
    }
  }, [open]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(f => ({ ...f, [name]: value }));
  };

  const handleAdd = () => {
    if (!form.name) return; // require name
    onAdd(form);
  };

  return (
    <Dialog
      fullScreen
      open={open}
      onClose={onClose}
      PaperProps={{ sx: { display: 'flex', flexDirection: 'column', height: '100vh' } }}
    >
      {/* grey top bar */}
      <AppBar position="sticky" color="default" elevation={1}>
        <Toolbar>
          <IconButton edge="start" onClick={onClose}>
            <CloseIcon />
          </IconButton>
          <Typography variant="h6" sx={{ ml: 2 }}>
            Add Plan ID
          </Typography>
        </Toolbar>
      </AppBar>

      {/* form content + inline buttons */}
      <DialogContent
        dividers
        component="form"
        sx={{
          p: 2,
          flex: 1,
          overflowY: 'auto',
          width: '100%',
          maxWidth: 600,
          mx: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 2
        }}
      >
        {/* hidden */}
        <input type="hidden" name="idempotency_key" value={form.idempotency_key} />
        <input type="hidden" name="id" value={form.id} />

        {/* readonly */}
        <TextField
          label="Type"
          name="type"
          value={form.type}
          disabled
          fullWidth
        />
        <TextField
          label="Present at all locations"
          name="present_at_all_locations"
          value={String(form.present_at_all_locations)}
          disabled
          fullWidth
        />
        <TextField
          label="All items"
          name="all_items"
          value={String(form.all_items)}
          disabled
          fullWidth
        />

        {/* required name */}
        <TextField
          label="Name"
          name="name"
          value={form.name}
          onChange={handleChange}
          error={!form.name}
          helperText={!form.name ? 'Required' : ''}
          required
          fullWidth
        />

        {/* ← inline footer buttons right after fields */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            mt: 1,
            gap: 1
          }}
        >
          <Button variant="contained" onClick={handleAdd}>
            Add
          </Button>
          <Button variant="outlined" onClick={onClose}>
            Cancel
          </Button>
        </Box>
      </DialogContent>
    </Dialog>
  );
}
