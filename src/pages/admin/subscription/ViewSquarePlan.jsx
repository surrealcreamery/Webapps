// src/pages/admin/subscription/ViewSquarePlan.jsx
import React, { useMemo, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  Box,
  Typography,
  Button,
  CircularProgress,
  Snackbar,
  Alert
} from '@mui/material';
import { useQueryClient } from '@tanstack/react-query';
import { useSquarePlans, useLocations, fetchWithToken } from '@/contexts/admin/AdminDataContext';

const SELECT_SQUARE_PLAN_URL =
  'https://hook.us2.make.com/o8i2n7jn85g9qbc9jdg1u4z9ub25ia3n';

export default function ViewSquarePlan() {
  const { planId, variationId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [snackbar, setSnackbar] = useState({ open: false, message: '' });

  // --- CONSOLE LOGS FOR DEBUGGING ---
  console.log('ViewSquarePlan location.state:', location.state);
  const originalPlan = location.state?.selectedSquare || {};
  console.log('originalPlan object:', originalPlan);
  console.log('originalPlan.planName:', originalPlan.planName);
  // ------------------------------------

  const originalPlanId = originalPlan.id;
  // use the camelCase property
  const originalPlanName = originalPlan.planName ?? 'Unknown Plan';
  console.log('derived originalPlanName:', originalPlanName);

  // fetch data
  const {
    data: squarePlansRaw = [],
    isLoading: loadingPlans,
    error: plansError
  } = useSquarePlans();
  const {
    data: locationData = [],
    isLoading: loadingLocs,
    error: locError
  } = useLocations();

  const loading = loadingPlans || loadingLocs;
  const error = plansError || locError;

  // build variationMap
  const variationMap = useMemo(() => {
    const map = {};
    squarePlansRaw.forEach(plan => {
      const sp = plan.subscription_plan_data;
      if (!sp.subscription_plan_variations?.length) {
        map[plan.id] = {
          variationId: plan.id,
          subscriptionPlanId: plan.id,
          subscriptionPlanName: sp.name,
          'Plan Name': sp.name,
          phases: [],
          Price: null
        };
      } else {
        sp.subscription_plan_variations.forEach(v => {
          const d = v.subscription_plan_variation_data;
          map[v.id] = {
            variationId: v.id,
            subscriptionPlanId: plan.id,
            subscriptionPlanName: sp.name,
            'Plan Name': d.name,
            Price: d.phases?.[0]?.pricing.price_money?.amount ?? null,
            phases: d.phases
          };
        });
      }
    });
    return map;
  }, [squarePlansRaw]);

  const selected = variationMap[variationId];
  console.log('selected variation entry:', selected);

  if (loading) {
    return (
      <Box sx={{ textAlign: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Snackbar
        open
        message={error.message || 'Failed to load plans'}
        autoHideDuration={6000}
        onClose={() => {}}
      />
    );
  }

  if (!selected) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <Typography variant="h6">No Plan Selected</Typography>
        <Button
          variant="outlined"
          sx={{ mt: 2 }}
          onClick={() => navigate('/admin/select-square-plan')}
        >
          Back to Select
        </Button>
      </Box>
    );
  }

  const handleSelectPlan = async () => {
    try {
      await fetchWithToken(SELECT_SQUARE_PLAN_URL, {
        method: 'POST',
        body: JSON.stringify({
          originalPlanId,
          subscriptionPlanId: selected.subscriptionPlanId,
          variationId: selected.variationId,
          planName: selected['Plan Name']
        })
      });

      queryClient.setQueryData(
        ['admin', 'plans'],
        (old = []) =>
          old.map(p =>
            p.id === originalPlanId
              ? {
                  ...p,
                  'Square Plan Variation ID': selected.variationId,
                  subscriptionPlanId: selected.subscriptionPlanId,
                  phases: selected.phases
                }
              : p
          )
      );

      setSnackbar({
        open: true,
        message: `${selected['Plan Name']} added to ${originalPlanName}`
      });

      setTimeout(() => {
        navigate('/admin/plans', { replace: true });
      }, 1000);
    } catch (err) {
      console.error('Select-plan API error', err);
      setSnackbar({ open: true, message: `Error: ${err.message}` });
    }
  };

  return (
    <Box sx={{ p: 4, maxWidth: 600, mx: 'auto' }}>
      <Typography variant="h5" gutterBottom>
        View Square Plan
      </Typography>
      <Typography>
        <strong>Plan Name:</strong> {selected['Plan Name']}
      </Typography>
      <Typography>
        <strong>Plan ID:</strong> {selected.subscriptionPlanId}
      </Typography>
      <Typography>
        <strong>Variation ID:</strong> {selected.variationId}
      </Typography>
      <Typography sx={{ mb: 2 }}>
        <strong>Price:</strong>{' '}
        {selected.Price != null
          ? `$${(selected.Price / 100).toFixed(2)}`
          : '—'}
      </Typography>

      <Typography variant="h6" gutterBottom>
        Phases
      </Typography>
      {selected.phases.length ? (
        selected.phases.map((phase, idx) => (
          <Box
            key={idx}
            sx={{ mb: 2, p: 2, border: '1px solid #ddd', borderRadius: 1 }}
          >
            <Typography>
              <strong>Cadence:</strong> {phase.cadence}
            </Typography>
            <Typography>
              <strong>Periods:</strong> {phase.periods}
            </Typography>
            <Typography>
              <strong>Type:</strong> {phase.pricing.type}
            </Typography>
            <Typography>
              <strong>Amount:</strong>{' '}
              {phase.pricing.price_money?.amount != null
                ? `${phase.pricing.price_money.amount} ${phase.pricing.price_money.currency}`
                : '—'}
            </Typography>
          </Box>
        ))
      ) : (
        <Typography>No phases defined.</Typography>
      )}

      <Box sx={{ display: 'flex', gap: 2, mt: 4 }}>
        <Button variant="contained" onClick={handleSelectPlan}>
          Select This Plan
        </Button>
        <Button
          variant="outlined"
          onClick={() => navigate('/admin/select-square-plan')}
        >
          Back
        </Button>
      </Box>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar(o => ({ ...o, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSnackbar(o => ({ ...o, open: false }))}
          severity={snackbar.message.startsWith('Error') ? 'error' : 'success'}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
