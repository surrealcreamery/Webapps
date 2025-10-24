import React from 'react';
import { useMachine } from '@xstate/react';
import {
  Dialog, AppBar, Toolbar, IconButton, Typography, DialogContent, Box,
  TextField, Button, CircularProgress, Alert, ToggleButtonGroup, ToggleButton, Divider, FormControl,
  Checkbox, FormControlLabel, DialogActions
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { planMachine } from '@/state/admin/plans/planMachine'; // Adjust path if needed

function PhaseForm({ phase, send, canRemove }) {
  const handleUpdate = (field, value) => send({ type: 'UPDATE_PHASE', uid: phase.uid, data: { [field]: value } });
  const handlePricingUpdate = (key, value) => handleUpdate('pricing', { ...phase.pricing, [key]: value });
  const handleMoneyUpdate = (key, value) => handlePricingUpdate('price_money', { ...phase.pricing.price_money, [key]: value });

  return (
    <Box sx={{ border: '1px solid #ddd', borderRadius: 1, p: 2, display: 'flex', flexDirection: 'column', gap: 2, position: 'relative' }}>
        {canRemove && (
            <Button
              size="small"
              sx={{ position: 'absolute', top: 8, right: 8, p: '4px' }}
              onClick={() => send({ type: 'REMOVE_PHASE', uid: phase.uid })}
            >
                Remove
            </Button>
        )}
        <FormControl fullWidth>
            <Typography variant="body2" gutterBottom>Cadence</Typography>
            <ToggleButtonGroup exclusive size="small" value={phase.cadence} onChange={(_, v) => v && handleUpdate('cadence', v)}>
                {['WEEKLY', 'MONTHLY', 'ANNUAL'].map(opt => <ToggleButton key={opt} value={opt}>{opt}</ToggleButton>)}
            </ToggleButtonGroup>
        </FormControl>
        <FormControlLabel
            control={<Checkbox checked={phase.includePeriods} onChange={(e) => handleUpdate('includePeriods', e.target.checked)}/>}
            label="Include introductory/trial periods"
        />
        <TextField
            label="Number of Periods"
            type="number"
            value={phase.periods}
            onChange={(e) => handleUpdate('periods', parseInt(e.target.value, 10) || 1)}
            disabled={!phase.includePeriods}
            helperText={!phase.includePeriods ? "Check the box above to enable this field." : ""}
        />
        <FormControl fullWidth>
            <Typography variant="body2" gutterBottom>Pricing Type</Typography>
            <ToggleButtonGroup 
              exclusive 
              size="small" 
              value={phase.pricing.type} 
              onChange={(_, v) => v && handlePricingUpdate('type', v)}
            >
                <ToggleButton value="STATIC">STATIC</ToggleButton>
                <ToggleButton value="VARIABLE">VARIABLE</ToggleButton>
            </ToggleButtonGroup>
        </FormControl>
        <TextField 
            label="Amount (cents)" 
            type="number" 
            fullWidth
            value={phase.pricing.price_money.amount ?? ''} 
            onChange={(e) => {
                const value = parseInt(e.target.value, 10);
                handleMoneyUpdate('amount', isNaN(value) ? null : value);
            }} 
        />
        <TextField label="Currency" value={phase.pricing.price_money.currency} disabled fullWidth />
    </Box>
  );
}

export default function AddPlanVariationWizard({ open, onClose, onAdd, parentPlanId }) {
  const [state, send] = useMachine(planMachine, {
    input: { parentPlanId, onAdd },
  });

  const { planName, phases, error } = state.context;

  React.useEffect(() => {
    if (state.matches('success') || state.matches('cancelled')) {
      onClose();
    }
  }, [state, onClose]);

  const handleClose = () => send({ type: 'CANCEL' });

  if (!open) {
    return null;
  }

  const isSubmitting = state.matches('submitting');
  const canSubmit = state.can({ type: 'SUBMIT' });

  return (
    <Dialog 
      fullScreen 
      open={!state.done} 
      onClose={handleClose}
      PaperProps={{
        // Pattern from Reports.jsx: Make Dialog a full-height flex container
        sx: { display: 'flex', flexDirection: 'column', height: '100vh' }
      }}
    >
      <AppBar 
        position="static" 
        color="default" 
        elevation={1}
        // Pattern from Reports.jsx: Prevent header from shrinking
        sx={{ flexShrink: 0 }}
      >
        <Toolbar>
            <IconButton edge="start" onClick={handleClose}>
                <CloseIcon />
            </IconButton>
            <Typography variant="h6" sx={{ ml: 2, flex: 1 }}>Add Square Plan Variation</Typography>
        </Toolbar>
      </AppBar>
      
      <DialogContent 
        dividers 
        // Pattern from Reports.jsx: Make content grow and scroll, but do not constrain its width
        sx={{ 
          flexGrow: 1,
          overflowY: 'auto',
          p: 2
        }}
      >
        {/* Pattern from Reports.jsx: Use an inner Box to constrain and center the content */}
        <Box sx={{ 
          width: '100%', 
          maxWidth: 600, 
          mx: 'auto', 
          display: 'flex', 
          flexDirection: 'column', 
          gap: 3 
        }}>
          {isSubmitting ? (
            <Box sx={{ textAlign: 'center' }}><CircularProgress /></Box>
          ) : (
            <>
              {error && <Alert severity="error">{error.message || String(error) || 'An unknown error occurred.'}</Alert>}
              <TextField
                label="Plan Name"
                value={planName}
                onChange={e => send({ type: 'UPDATE_NAME', value: e.target.value })}
                fullWidth
                autoFocus
                required
                helperText="A descriptive name for this plan variation."
              />
              <Divider />
              <Typography variant="h6">Billing Phases</Typography>
              {phases.map(phase => <PhaseForm key={phase.uid} phase={phase} send={send} canRemove={phases.length > 1} />)}
              <Button onClick={() => send({ type: 'ADD_PHASE' })}>Add Another Phase</Button>
              
              <Button 
                color="primary" 
                variant="contained" 
                onClick={() => send({ type: 'SUBMIT' })} 
                disabled={isSubmitting || !canSubmit}
                sx={{ mt: 2, alignSelf: 'flex-start' }}
              >
                {isSubmitting ? <CircularProgress size={24} color="inherit" /> : 'Add'}
              </Button>
            </>
          )}
        </Box>
      </DialogContent>
    </Dialog>
  );
}