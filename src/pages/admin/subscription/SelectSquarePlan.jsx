import React, { useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Box,
  CircularProgress,
  Typography
} from '@mui/material';
// ✅ MODIFIED: Added useDeprecatedSquarePlans to the import list
import { useSquarePlans, useLocations, usePlans, useDeprecatedSquarePlans } from '@/contexts/admin/AdminDataContext';
import PlanSection from '@/components/plan/plan-section/plan-section';

export default function SelectSquarePlan() {
  const navigate = useNavigate();
  const location = useLocation();
  const { selectedSquare = {}, fromView } = location.state || {};

  console.log('%c[SelectSquarePlan.js] | MOUNTED', 'color: #8A2BE2; font-weight: bold;', { receivedState: location.state });

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

  const { data: allPlans = [] } = usePlans();

  // ✅ ADDED: Fetch the list of deprecated plan variations
  const { data: deprecatedPlans = [], isLoading: loadingDeprecated } = useDeprecatedSquarePlans();

  const loading = loadingPlans || loadingLocs || loadingDeprecated;
  const error = plansError || locError;

  const parentPlan = useMemo(() => 
    squarePlansRaw.find(p => p.id === selectedSquare.subscriptionPlanId),
    [squarePlansRaw, selectedSquare.subscriptionPlanId]
  );

  // ✅ ADDED: Create a Set of deprecated IDs for efficient filtering
  const deprecatedVariationIds = useMemo(() => 
    new Set(deprecatedPlans.map(p => p['Square Plan Variation ID'])),
    [deprecatedPlans]
  );

  const linkedVariationIds = useMemo(() => 
    new Set(allPlans.map(p => p['Square Plan Variation ID']).filter(Boolean)),
    [allPlans]
  );

  const orphanGroups = useMemo(() => {
    if (!parentPlan) return [];
    
    const allVariationsForParent = (parentPlan.subscription_plan_data.subscription_plan_variations || []).map(v => {
      const d = v.subscription_plan_variation_data;
      return {
        variationId: v.id,
        subscriptionPlanId: parentPlan.id,
        subscriptionPlanName: parentPlan.subscription_plan_data.name,
        'Plan Name': d.name || parentPlan.subscription_plan_data.name,
        phases: d.phases || [],
        Price: d.phases?.[0]?.pricing.price_money?.amount ?? null
      };
    });

    // ✅ MODIFIED: This filter now removes variations that are already linked OR are deprecated
    const unlinkedPlans = allVariationsForParent.filter(v => 
      !linkedVariationIds.has(v.variationId) && !deprecatedVariationIds.has(v.variationId)
    );

    if (unlinkedPlans.length === 0) return [];

    return [{
      location: parentPlan.subscription_plan_data.name,
      id: `orphan-${parentPlan.id}`,
      plans: unlinkedPlans
    }];
  }, [parentPlan, linkedVariationIds, deprecatedVariationIds]); // Added dependency

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <Typography color="error">{error.message || 'Failed to load plans'}</Typography>
      </Box>
    );
  }

  const handleSelectVariation = (variation) => {
    console.log('%c[SelectSquarePlan.js] | handleSelectVariation | TRIGGERED', 'color: #8A2BE2; font-weight: bold;', { variation });
    
    const updatedPlan = {
      ...selectedSquare,
      'Square Plan Variation ID': variation.variationId,
      variationId: variation.variationId,
      phases: variation.phases,
    };
    
    const stateToNavigateWith = { 
      updatedPlanFromSelection: updatedPlan, 
      fromView 
    };
    
    console.log('%c[SelectSquarePlan.js] | handleSelectVariation | NAVIGATING to /admin/plans with state:', 'color: #8A2BE2; font-weight: bold;', stateToNavigateWith);

    navigate('/admin/plans', { state: stateToNavigateWith });
  };

  return (
    <Box sx={{ mx: 'auto', maxWidth: 800 }}>
      {orphanGroups.length > 0 ? (
        <PlanSection
          title="SELECT AN UNLINKED VARIATION"
          groups={orphanGroups}
          subscriptionData={locationData}
          onEdit={handleSelectVariation}
          showAddButton={false}
          isSquareSection={true}
          internalPlans={new Map()}
        />
      ) : (
        <Box sx={{ textAlign: 'center', pt: 4 }}>
            <Typography variant="h6">No Unlinked Variations Found</Typography>
            <Typography color="text.secondary">
                All variations for this Square Plan are either linked or have been deprecated.
            </Typography>
        </Box>
      )}
    </Box>
  );
}