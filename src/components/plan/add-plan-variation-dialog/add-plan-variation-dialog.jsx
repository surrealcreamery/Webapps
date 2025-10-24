// src/components/plan/add-plan-variation-dialog/add-plan-variation-dialog.jsx
import React, { useState } from 'react';
import {
  Dialog,
  AppBar,
  Toolbar,
  IconButton,
  Typography,
  DialogContent,
  Box,
  TextField,
  Button,
  FormControl,
  FormHelperText,
  ToggleButtonGroup,
  ToggleButton
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { v4 as uuidv4 } from 'uuid';

export default function AddPlanVariationDialog({
  open,
  onClose,
  parentPlanId,
  onAdd
}) {
  const [planName, setPlanName] = useState('');
  const [phases, setPhases] = useState([
    {
      uid: Date.now().toString(),
      cadence: '',
      periods: 1,
      pricing: { type: 'STATIC', price_money: { amount: 0, currency: 'USD' } },
      ordinal: 0
    }
  ]);
  const [errors, setErrors] = useState({ planName: false, phases: {} });

  const handleAddPhase = () => {
    setPhases(ps => [
      ...ps,
      {
        uid: Date.now().toString(),
        cadence: '',
        periods: 1,
        pricing: { type: 'STATIC', price_money: { amount: 0, currency: 'USD' } },
        ordinal: ps.length
      }
    ]);
  };

  const handleRemovePhase = uid => {
    setPhases(ps => ps.filter(p => p.uid !== uid));
    setErrors(errs => {
      const { [uid]: _, ...rest } = errs.phases;
      return { ...errs, phases: rest };
    });
  };

  const handlePhaseChange = (uid, field, value) => {
    setPhases(ps =>
      ps.map(p =>
        p.uid === uid ? { ...p, [field]: value } : p
      )
    );
    setErrors(errs => {
      const newPhaseErrs = { ...errs.phases[uid] };
      delete newPhaseErrs[field];
      return { ...errs, phases: { ...errs.phases, [uid]: newPhaseErrs } };
    });
  };

  const validate = () => {
    let valid = true;
    const newErrors = { planName: false, phases: {} };

    if (!planName.trim()) {
      newErrors.planName = true;
      valid = false;
    }
    if (phases.length === 0) {
      newErrors.phases._none = 'At least one phase required';
      valid = false;
    }

    phases.forEach(p => {
      const pe = {};
      if (!p.cadence) {
        pe.cadence = 'Required';
        valid = false;
      }
      if (!Number.isInteger(p.periods) || p.periods < 0) {
        pe.periods = 'Must be an integer ≥ 0';
        valid = false;
      }
      const amt = p.pricing.price_money.amount;
      if (!Number.isInteger(amt) || amt < 0) {
        pe.amount = 'Must be an integer ≥ 0';
        valid = false;
      }
      if (Object.keys(pe).length) {
        newErrors.phases[p.uid] = pe;
      }
    });

    setErrors(newErrors);
    return valid;
  };

  const handleSave = () => {
    if (!validate()) return;

    const payload = {
      object: {
        type: 'SUBSCRIPTION_PLAN_VARIATION',
        present_at_all_locations: true,
        id: `#${Math.floor(Math.random() * 100000)}`,
        subscription_plan_variation_data: {
          subscription_plan_id: parentPlanId,
          name: planName,
          phases: phases.map((p, idx) => ({
            cadence: p.cadence,
            periods: p.periods,
            pricing: p.pricing,
            ordinal: idx
          }))
        }
      },
      idempotency_key: uuidv4()
    };
    onAdd(payload);
  };

  return (
    <Dialog
      fullScreen
      open={open}
      onClose={onClose}
      PaperProps={{ sx: { display: 'flex', flexDirection: 'column', height: '100vh' } }}
    >
      <AppBar position="sticky" color="default" elevation={1}>
        <Toolbar>
          <IconButton edge="start" onClick={onClose}>
            <CloseIcon />
          </IconButton>
          <Typography variant="h6" sx={{ ml: 2 }}>
            Add Square Plan Variation
          </Typography>
        </Toolbar>
      </AppBar>

      <DialogContent
        dividers
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
        {/* Read-only fields */}
        <Typography variant="body2">Square Plan ID: {parentPlanId}</Typography>
        <TextField
          label="Variation ID"
          value={phases[0]?.id || '#1'}
          fullWidth
          disabled
          sx={{ mb: 2 }}
        />
        <TextField
          label="Type"
          value="SUBSCRIPTION_PLAN_VARIATION"
          fullWidth
          disabled
          sx={{ mb: 2 }}
        />
        <TextField
          label="Present at All Locations"
          value="true"
          fullWidth
          disabled
          sx={{ mb: 2 }}
        />

        {/* Plan Name */}
        <TextField
          label="Plan Name"
          value={planName}
          onChange={e => setPlanName(e.target.value)}
          error={errors.planName}
          helperText={errors.planName && 'Required'}
          fullWidth
        />

        {/* Phases */}
        <Box>
          <Typography variant="subtitle2">Phases</Typography>
          {errors.phases._none && (
            <FormHelperText error>{errors.phases._none}</FormHelperText>
          )}
          {phases.map(phase => {
            const pe = errors.phases[phase.uid] || {};
            return (
              <Box
                key={phase.uid}
                sx={{
                  border: '1px solid #ddd',
                  borderRadius: 1,
                  p: 2,
                  mb: 3,             // increased margin-bottom
                  position: 'relative',
                  display: 'flex',   // flex container for vertical gaps
                  flexDirection: 'column',
                  gap: 2             // uniform spacing between fields
                }}
              >
                <Button
                  variant="text"
                  size="small"
                  onClick={() => handleRemovePhase(phase.uid)}
                  sx={{
                    position: 'absolute',
                    top: 8,
                    right: 8,
                    textTransform: 'none',
                    p: '4px',
                    zIndex: 1
                  }}
                >
                  REMOVE PHASE
                </Button>

                <FormControl fullWidth error={!!pe.cadence}>
                  <Typography variant="body2">Cadence</Typography>
                  <ToggleButtonGroup
                    exclusive
                    size="small"
                    value={phase.cadence}
                    onChange={(_, v) => handlePhaseChange(phase.uid, 'cadence', v)}
                    sx={{ minWidth: 0 }}
                  >
                    {['DAILY', 'WEEKLY', 'MONTHLY', 'ANNUAL'].map(opt => (
                      <ToggleButton key={opt} value={opt}>{opt}</ToggleButton>
                    ))}
                  </ToggleButtonGroup>
                  {pe.cadence && <FormHelperText>{pe.cadence}</FormHelperText>}
                </FormControl>

                <TextField
                  label="Periods"
                  type="number"
                  value={phase.periods}
                  onChange={e =>
                    handlePhaseChange(phase.uid, 'periods', parseInt(e.target.value, 10) || 0)
                  }
                  error={!!pe.periods}
                  helperText={pe.periods}
                  fullWidth
                />

                <FormControl fullWidth error={!!pe.amount}>
                  <Typography variant="body2">Pricing Type</Typography>
                  <ToggleButtonGroup
                    exclusive
                    size="small"
                    value={phase.pricing.type}
                    onChange={(_, v) =>
                      handlePhaseChange(phase.uid, 'pricing', { ...phase.pricing, type: v })
                    }
                    sx={{ minWidth: 0 }}
                  >
                    {['STATIC', 'VARIABLE'].map(opt => (
                      <ToggleButton key={opt} value={opt}>{opt}</ToggleButton>
                    ))}
                  </ToggleButtonGroup>
                </FormControl>

                <TextField
                  label="Amount (cents)"
                  type="number"
                  value={phase.pricing.price_money.amount}
                  onChange={e => {
                    const raw = e.target.value;
                    const amount = raw === '' ? '' : parseInt(raw, 10);
                    handlePhaseChange(phase.uid, 'pricing', {
                      ...phase.pricing,
                      price_money: {
                        ...phase.pricing.price_money,
                        amount
                      }
                    });
                  }}
                  error={!!pe.amount}
                  helperText={pe.amount}
                  fullWidth
                />

                <TextField
                  label="Currency"
                  value={phase.pricing.price_money.currency}
                  fullWidth
                  disabled
                />
              </Box>
            );
          })}

          <Button onClick={handleAddPhase} sx={{ textTransform: 'none' }}>
            + Add Phase
          </Button>
        </Box>

        {/* Actions */}
        <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
          <Button variant="contained" onClick={handleSave}>
            Save
          </Button>
          <Button variant="outlined" onClick={onClose}>
            Cancel
          </Button>
        </Box>
      </DialogContent>
    </Dialog>
  );
}
