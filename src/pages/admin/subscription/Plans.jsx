import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  CircularProgress,
  Drawer,
  IconButton,
  Divider,
  Snackbar,
  ListItemButton,
  ListItemText,
  Button,
  Alert,
  Dialog as ConfirmationDialog,
  DialogTitle as ConfirmationDialogTitle,
  DialogContent as ConfirmationDialogContent,
  DialogActions as ConfirmationDialogActions
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { Icon } from '@iconify/react';

// Iconify wrapper for consistent sizing
const Iconify = ({ icon, width = 20, sx, ...other }) => (
  <Box component={Icon} icon={icon} sx={{ width, height: width, flexShrink: 0, ...sx }} {...other} />
);
import {
  usePlans,
  useSquarePlans,
  useLocations,
  usePricingModels,
  useAddPlan,
  useUpdatePlan,
  useDeletePlan,
  useBenefits,
  useCreateSquarePlan,
  useCreateSquarePlanVariation,
  useDeprecateSquarePlanVariation,
  useDeprecatedSquarePlans
} from '@/contexts/admin/AdminDataContext';
import PlanSection from '@/components/plan/plan-section/plan-section';
import AddEditPlanDialog from '@/components/plan/add-edit-plan-dialog/add-edit-plan-dialog';
import AddPlanIdDialog from '@/components/plan/add-plan-id-dialog/add-plan-id-dialog';
import AddPlanVariationWizard from '@/components/plan/add-plan-variation-wizard/add-plan-variation-wizard';
import { useNavigate, useLocation } from 'react-router-dom';

const TYPE_ORDER = ['All', 'Acquisition', 'Renewal', 'Complimentary', 'Deprecated', 'Orphan'];

// Utility function for deep cloning objects
const deepClone = (obj) => {
  return JSON.parse(JSON.stringify(obj));
};

export default function Plans({ fetchedPermissions }) {
  const navigate = useNavigate();
  const location = useLocation();
  
  const addPlanMutation = useAddPlan();
  const updatePlanMutation = useUpdatePlan();
  const deletePlanMutation = useDeletePlan();
  const createSquarePlanMutation = useCreateSquarePlan();
  const createSquarePlanVariationMutation = useCreateSquarePlanVariation();
  
  const { refetch: refetchSquarePlans } = useSquarePlans();
  const { refetch: refetchDeprecatedSquarePlans } = useDeprecatedSquarePlans();
  
  const deprecatePlanVariationMutation = useDeprecateSquarePlanVariation({
    onSuccess: () => {
      setSnackbarMessage('Plan variation has been deprecated.');
      setSnackbarSeverity('success');
      setSnackbarOpen(true);
      setEditPlan(null);
      refetchSquarePlans();
      refetchDeprecatedSquarePlans();
    },
    onError: (error) => {
      console.error("Deprecation failed:", error);
      setSnackbarMessage(`Error: ${error.message || 'Failed to deprecate variation.'}`);
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
      setEditPlan(null);
    }
  });

  const isSaving = addPlanMutation.isPending || updatePlanMutation.isPending || createSquarePlanMutation.isPending || createSquarePlanVariationMutation.isPending || deprecatePlanVariationMutation.isPending;
  const isDeleting = deletePlanMutation.isPending;

  const { data: allPlans = [], isLoading: loadingPlans, error: plansError, refetch: refetchPlans } = usePlans();
  const { data: squarePlansRaw = [], isLoading: loadingSquare, error: squareError } = useSquarePlans();
  const { data: deprecatedPlans = [], isLoading: loadingDeprecated } = useDeprecatedSquarePlans();
  const { data: locationData = [], isLoading: loadingLocs, error: locError, refetch: refetchLocations } = useLocations();
  const { data: pricingModels = [], isLoading: loadingPMs, error: pmError, refetch: refetchPricingModels } = usePricingModels();
  const { data: benefits = [], isLoading: loadingBenefits, error: benefitsError, refetch: refetchBenefits } = useBenefits();
  
  const loading = loadingPlans || loadingSquare || loadingLocs || loadingPMs || loadingBenefits || loadingDeprecated;
  const error = plansError || squareError || locError || pmError || benefitsError;

  const [planFilter, setPlanFilter] = useState('All');
  const [squareFilter, setSquareFilter] = useState('All');
  const [lastFilter, setLastFilter] = useState(() => location.state?.fromView || 'plan');
  const [editPlan, setEditPlan] = useState(null);
  const [showValidation, setShowValidation] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [addPlanIdOpen, setAddPlanIdOpen] = useState(false);
  const [variationDialogOpen, setVariationDialogOpen] = useState(false);
  const [variationParentPlanId, setVariationParentPlanId] = useState(null);
  const [triggeredApis, setTriggeredApis] = useState([]);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState('success');
  const [deprecateConfirmOpen, setDeprecateConfirmOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [deprecatePlanInfo, setDeprecatePlanInfo] = useState(null);

  useEffect(() => {
    const incomingState = location.state || {};
    const { updatedPlanFromSelection, message, fromView } = incomingState;

    if (updatedPlanFromSelection) {
      setEditPlan(updatedPlanFromSelection);
      const newState = { ...incomingState };
      delete newState.updatedPlanFromSelection;
      navigate(location.pathname, { replace: true, state: newState });
    }

    if (message) {
      setSnackbarMessage(message);
      setSnackbarSeverity('success');
      setSnackbarOpen(true);
      const newState = { ...incomingState };
      delete newState.message;
      navigate(location.pathname, { replace: true, state: newState });
    }

    if (fromView) {
      setLastFilter(fromView);
    }
  }, [location.state, navigate, location.pathname]);

  useEffect(() => { 
    if (!loading && triggeredApis.length) { 
      const names = triggeredApis.map(api => { 
        switch(api) { 
          case 'plans': return 'Plans'; 
          case 'squarePlans': return 'Square Plans'; 
          case 'locations': return 'Locations'; 
          case 'pricingModels': return 'Pricing Models'; 
          case 'benefits': return 'Benefits'; 
          default: return api; 
        } 
      }).join(', '); 
      setSnackbarMessage(`Refreshed: ${names}`); 
      setSnackbarSeverity('success'); 
      setSnackbarOpen(true); 
      setTriggeredApis([]); 
    } 
  }, [loading, triggeredApis]);
  
  const { deprecatedVariationIds, deprecatedPlanIds } = useMemo(() => {
    if (!Array.isArray(deprecatedPlans)) {
      return { deprecatedVariationIds: new Set(), deprecatedPlanIds: new Set() };
    }
    const variationIds = new Set();
    const planIds = new Set();
    for (const record of deprecatedPlans) {
      if (record['Square Plan Variation ID'] === null) {
        planIds.add(record['Square Plan ID']);
      } else {
        variationIds.add(record['Square Plan Variation ID']);
      }
    }
    return { deprecatedVariationIds: variationIds, deprecatedPlanIds: planIds };
  }, [deprecatedPlans]);

  const internalPlanMap = useMemo(() => { const map = new Map(); allPlans.forEach(plan => { if(plan['Square Plan Variation ID']) { map.set(plan['Square Plan Variation ID'], plan); } }); return map; },[allPlans]);
  const locMap = useMemo(() => { const m = {}; locationData.forEach(l => { m[l['Location Name']] = l; }); return m; },[locationData]);
  
  const squareVariationMap = useMemo(() => {
    const map = {};
    squarePlansRaw.forEach(plan => {
      const spd = plan.subscription_plan_data;
      const vars = spd.subscription_plan_variations || [];
      vars.forEach(v => {
        if (!deprecatedVariationIds.has(v.id)) {
            const d = v.subscription_plan_variation_data;
            map[v.id] = { 
                variationId: v.id, 
                subscriptionPlanId: plan.id, 
                subscriptionPlanName: spd.name, 
                'Plan Name': d.name || spd.name, 
                phases: d.phases || [], 
                Price: d.phases?.[0]?.pricing.price_money?.amount ?? null 
            };
        }
      });
    });
    return map;
  }, [squarePlansRaw, deprecatedVariationIds]);

  const squarePlanGroups = useMemo(() => {
    const allGroups = squarePlansRaw.map(plan => ({
      location: plan.subscription_plan_data.name,
      id: plan.id,
      plans: Object.values(squareVariationMap).filter(variation => variation.subscriptionPlanId === plan.id)
    }));
    return allGroups.filter(group => !deprecatedPlanIds.has(group.id));
  }, [squarePlansRaw, squareVariationMap, deprecatedPlanIds]);

  const orphanSquarePlanGroups = useMemo(() => {
    return Object.values(squareVariationMap)
      .filter(v => !allPlans.some(p => p['Square Plan Variation ID'] === v.variationId))
      .reduce((acc, v) => {
        const name = v.subscriptionPlanName;
        let group = acc.find(g => g.location === name);
        if (!group) {
          group = { location: name, id: `orphan-${v.subscriptionPlanId}`, plans: [] };
          acc.push(group);
        }
        group.plans.push(v);
        return acc;
      }, []);
  }, [squareVariationMap, allPlans]);

  const benefitsMap = useMemo(() => { 
    const m = {}; 
    benefits.forEach(b => { 
      const linkedPlans = b['Linked: Plan ID in Plans'];
      if (!linkedPlans) return;
      
      linkedPlans.forEach(pid => { 
        if (!m[pid]) m[pid] = []; 
        const transformedBenefit = {
          id: b.id,
          name: b['Benefit Name'], 
          frequency: b.Frequency,  
          type: b.Type,            
        };
        m[pid].push(deepClone(transformedBenefit)); 
      }); 
    }); 
    return m; 
  }, [benefits]);
  
  const internalPlanGroups = useMemo(() => { 
    const enriched = allPlans.map(p => { 
      const varId = p['Square Plan Variation ID'];
      const squareData = varId ? squareVariationMap[varId] : null;
      return { 
        ...p,
        dbPlanId: p.id,
        variationId: varId || null,
        subscriptionPlanId: squareData?.subscriptionPlanId || p['Square Plan ID']?.[0] || null,
        phases: squareData?.phases || [],
        benefits: benefitsMap[p.id] || [] 
      }; 
    });
    const groups = {}; 
    TYPE_ORDER.slice(1).forEach(type => { 
      groups[type] = locationData.map(loc => ({ 
        location: loc['Location Name'], 
        id: `${loc['Location ID']}-${type}`, 
        plans: enriched.filter(p => { 
          const modelTypes = p['Pricing Model Type']; 
          const isType = Array.isArray(modelTypes) ? modelTypes.includes(type) : modelTypes === type; 
          const inLoc = Array.isArray(p['Location Name']) ? p['Location Name'][0] === loc['Location Name'] : p['Location Name'] === loc['Location Name']; 
          return isType && inLoc; 
        }) 
      })); 
    }); 
    return groups; 
  }, [allPlans, locationData, benefitsMap, squareVariationMap]);
  
  const planTypesToShow = useMemo(() => planFilter === 'All' ? TYPE_ORDER.slice(1) : [planFilter], [planFilter]);
  
  const handleDeprecateSquarePlan = useCallback((planId, planName) => {
    setDeprecatePlanInfo({ id: planId, name: planName });
  }, []);

  const confirmDeprecatePlan = useCallback(async () => {
    if (!deprecatePlanInfo) return;
    try {
      await deprecatePlanVariationMutation.mutateAsync({
        planId: deprecatePlanInfo.id,
        status: 'INACTIVE',
      });
    } catch (error) {
      console.error("Deprecation request failed:", error);
    } finally {
      setDeprecatePlanInfo(null);
    }
  }, [deprecatePlanInfo, deprecatePlanVariationMutation]);

  const onEditHandler = useCallback((planData, locName) => {
    setEditPlan({ 
      ...deepClone(planData), // Deep clone the plan data
      'Location ID': locMap[locName]?.['Location ID'] || ''
    });
  }, [locMap]);
  
  const handleAddNewPlan = useCallback((planLevelId, locationName, type) => {
    const locationInfo = locMap[locationName];
    const finalPlanLevelId = planLevelId || locationInfo?.['Square Subscription Plan ID'];
    setEditPlan({ 
      'Plan Name': '', 
      'Add On': '', 
      Price: null, 
      Description: '', 
      type: type, 
      'Pricing Model Type': [type], 
      Frequency: '', 
      Status: '', 
      'Linked: Pricing Model ID in Pricing Model': '', 
      phases: [], 
      subscriptionPlanId: finalPlanLevelId, 
      'Location Name': locationName, 
      'Location ID': locationInfo?.['Location ID'] || '',
      'Plan Type': 'Base'
    });
  }, [locMap]);
  
  const handleRefresh = useCallback(async () => { 
    setTriggeredApis(['plans','squarePlans','locations','pricingModels','benefits','deprecatedSquarePlans']); 
    await Promise.all([refetchPlans(), refetchSquarePlans(), refetchLocations(), refetchPricingModels(), refetchBenefits(), refetchDeprecatedSquarePlans()]); 
  }, [refetchPlans, refetchSquarePlans, refetchLocations, refetchPricingModels, refetchBenefits, refetchDeprecatedSquarePlans]);
  
  const handleAddPhase = useCallback(() => { setEditPlan(p => ({...p, phases: [...(p.phases || []), { uid: `${Date.now()}`, cadence: '', periods: 1, pricing: { type: 'STATIC', price_money: { amount: 0, currency: 'USD' } } }]})); }, []);
  
  const handleRemovePhase = useCallback(uid => { setEditPlan(p => ({...p, phases: (p.phases || []).filter(x => x.uid !== uid)})); }, []);
  
  const handleCreatePlanId = useCallback(async payload => { 
    try {
      await createSquarePlanMutation.mutateAsync(payload);
      setSnackbarMessage('Square Plan ID added');
      setSnackbarSeverity('success');
      setSnackbarOpen(true);
      setAddPlanIdOpen(false);
    } catch (error) {
      console.error("Mutation failed:", error);
      setSnackbarMessage(`Error adding Square Plan ID: ${error.message || 'Unknown error'}`);
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
    }
  }, [createSquarePlanMutation]);

  const handleChooseSquare = useCallback(() => {
    let finalSubscriptionPlanId = editPlan.subscriptionPlanId;
    if (!finalSubscriptionPlanId) {
      const planLocationName = Array.isArray(editPlan['Location Name']) ? editPlan['Location Name'][0] : editPlan['Location Name'];
      const locationInfo = locationData.find(l => l['Location Name'] === planLocationName);
      if (locationInfo) {
        finalSubscriptionPlanId = locationInfo['Square Subscription Plan ID'];
      }
    }
    navigate('/admin/select-square-plan', { state: { fromView: lastFilter, selectedSquare: { ...editPlan, subscriptionPlanId: finalSubscriptionPlanId } } });
  }, [navigate, lastFilter, editPlan, locationData]);

  const handleSavePlan = useCallback(async () => {
    setShowValidation(true);
    if (!editPlan.Frequency || !editPlan.Status || !editPlan['Plan Name'] || editPlan.Price == null) {
      return;
    }
    const planName = editPlan['Plan Name'];
    try {
      if (editPlan.id) {
        await updatePlanMutation.mutateAsync(editPlan);
        setSnackbarMessage(`"${planName}" updated`);
      } else {
        await addPlanMutation.mutateAsync(editPlan);
        setSnackbarMessage(`"${planName}" created`);
      }
      setEditPlan(null);
      setSnackbarSeverity('success');
      setSnackbarOpen(true);
    } catch (error) {
      console.error("Mutation failed:", error);
      setSnackbarMessage(`Error: ${error.message || 'Could not save plan.'}`);
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
    }
  }, [editPlan, addPlanMutation, updatePlanMutation]);

  const handleDeletePlan = useCallback(async () => {
    if (!editPlan?.id) return;
    const planName = editPlan['Plan Name'];
    try {
      await deletePlanMutation.mutateAsync(editPlan.id);
      setConfirmDeleteOpen(false);
      setEditPlan(null);
      setSnackbarMessage(`"${planName}" deleted`);
      setSnackbarSeverity('success');
      setSnackbarOpen(true);
    } catch (error) {
      console.error("Delete mutation failed:", error);
      setSnackbarMessage(`Error: ${error.message || 'Could not delete plan.'}`);
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
    }
  }, [editPlan, deletePlanMutation]);

  const handleDeprecatePlan = useCallback(async () => {
    if (!editPlan) return;
    setDeprecateConfirmOpen(false);
    const payload = {
      variationId: editPlan.squareVariationId || editPlan.variationId,
      planId: editPlan.subscriptionPlanId,
      status: 'INACTIVE',
    };
    await deprecatePlanVariationMutation.mutateAsync(payload);
  }, [editPlan, deprecatePlanVariationMutation]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%' }}>
      {error && (<Snackbar open autoHideDuration={6000} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }} onClose={() => setSnackbarOpen(false)}><Alert severity="error">{error.message || String(error)}</Alert></Snackbar>)}
      <Box sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        pb: 2,
        mb: 2,
        borderBottom: 1,
        borderColor: 'divider',
        flexShrink: 0,
        bgcolor: 'background.paper',
        mx: -3,
        mt: -3,
        px: 3,
        pt: 2,
      }}>
        <Box onClick={() => !loading && handleRefresh()} sx={{ display: 'flex', alignItems: 'center', cursor: loading ? 'default' : 'pointer', color: 'primary.main', '&:hover': { opacity: loading ? 1 : 0.8 } }}>
          {loading ? <CircularProgress size={20} sx={{ color: 'primary.main' }}/> : <Iconify icon="solar:refresh-bold" />}
          <Typography variant="body2" sx={{ ml: 0.5 }}>Refresh</Typography>
        </Box>
        <Box onClick={() => setFilterOpen(true)} sx={{ display: 'flex', alignItems: 'center', cursor: 'pointer', color: 'primary.main', '&:hover': { opacity: 0.8 } }}>
          <Iconify icon="solar:filter-bold" />
          <Typography variant="body2" sx={{ ml: 0.5 }}>Filters</Typography>
        </Box>
      </Box>
      <Drawer anchor="right" open={filterOpen} onClose={() => setFilterOpen(false)} PaperProps={{ sx: { top: 48, height: 'calc(100% - 48px)', width: 300, zIndex: 1200 } }}>
        <Box sx={{ p: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}><Typography variant="h6" sx={{ flexGrow: 1 }}>Filters</Typography><IconButton onClick={() => setFilterOpen(false)}> <CloseIcon/> </IconButton></Box>
          <Divider sx={{ mb: 2 }}/>
          <Typography variant="subtitle2" sx={{ px: 2, pt: 1 }}>Plans</Typography>
          {['All','Acquisition','Renewal', 'Complimentary', 'Deprecated'].map(t => (<ListItemButton key={t} selected={lastFilter==='plan' && planFilter===t} onClick={() => { setPlanFilter(t); setLastFilter('plan'); setFilterOpen(false); }}>
              <ListItemText primary={t}/>
            </ListItemButton>
          ))}
          <Divider sx={{ my: 2 }}/>
          <Typography variant="subtitle2" sx={{ px: 2, pt: 1 }}>Square Plans</Typography>
          {['All','Orphans'].map(t => (<ListItemButton key={t} selected={lastFilter==='square' && squareFilter===t} onClick={() => { setSquareFilter(t); setLastFilter('square'); setFilterOpen(false); }}>
              <ListItemText primary={t}/>
            </ListItemButton>
          ))}
        </Box>
      </Drawer>
      <Box sx={{ flexGrow: 1, overflow: 'auto', pb: 6 }}>
        {loading ? (<Box sx={{ textAlign: 'center', py: 4 }}><CircularProgress/></Box>) : (
          <>
            {lastFilter==='plan' && planTypesToShow.map(type => (<PlanSection 
                key={type} 
                title={type.toUpperCase()} 
                groups={internalPlanGroups[type] || []} 
                subscriptionData={locationData} 
                onEdit={onEditHandler} 
                onAdd={(pid, locName) => handleAddNewPlan(pid, locName, type)}
                isSquareSection={false}
                internalPlans={internalPlanMap}
                showAddButton 
              />
            ))}
            
            {lastFilter==='square' && squareFilter==='All' && (
              <>
                <Box sx={{ maxWidth: 600, mx: 'auto', mb: 2 }}><Button variant="outlined" startIcon={<AddIcon/>} onClick={() => setAddPlanIdOpen(true)} sx={{ p: 1, textTransform:'none', minWidth: 0 }}>Add Square Plan ID</Button></Box>
                <PlanSection 
                  title="ALL SQUARE PLANS" 
                  groups={squarePlanGroups}
                  subscriptionData={locationData} 
                  onEdit={onEditHandler} 
                  onAdd={(pid) => { setVariationParentPlanId(pid); setVariationDialogOpen(true); }}
                  isSquareSection={true}
                  internalPlans={internalPlanMap}
                  onDeprecatePlan={handleDeprecateSquarePlan}
                />
              </>
            )}

            {lastFilter==='square' && squareFilter==='Orphans' && (
                <PlanSection 
                    title="ORPHAN SQUARE PLANS" 
                    groups={orphanSquarePlanGroups}
                    subscriptionData={locationData} 
                    onEdit={onEditHandler} 
                    showAddButton={false}
                    isSquareSection={true}
                    internalPlans={internalPlanMap}
                />
            )}
          </>
        )}
      </Box>
      <AddEditPlanDialog 
        open={!!editPlan} 
        editPlan={editPlan} 
        isSaving={isSaving} 
        isDeleting={isDeleting} 
        locMap={locMap} 
        pricingModels={pricingModels} 
        showValidation={showValidation} 
        onClose={() => setEditPlan(null)} 
        onChangePlan={setEditPlan} 
        onSave={handleSavePlan} 
        onDelete={handleDeletePlan}
        onDeprecate={() => setDeprecateConfirmOpen(true)}
        handleAddPhase={handleAddPhase} 
        handleRemovePhase={handleRemovePhase} 
        confirmDeleteOpen={confirmDeleteOpen} 
        setConfirmDeleteOpen={setConfirmDeleteOpen}
        onChooseSquarePlan={handleChooseSquare}
      />
      <AddPlanIdDialog open={addPlanIdOpen} onClose={() => setAddPlanIdOpen(false)} onAdd={handleCreatePlanId}/>
      <AddPlanVariationWizard 
        key={variationParentPlanId || 'new-variation-wizard'}
        open={variationDialogOpen} 
        parentPlanId={variationParentPlanId} 
        onClose={() => { setVariationDialogOpen(false); setVariationParentPlanId(null); }} 
        onAdd={(payload) => {
          return createSquarePlanVariationMutation.mutateAsync(payload);
        }}
      />
      <ConfirmationDialog open={deprecateConfirmOpen} onClose={() => setDeprecateConfirmOpen(false)}>
        <ConfirmationDialogTitle>Confirm Deprecation</ConfirmationDialogTitle>
        <ConfirmationDialogContent dividers>
          <Typography>
            Are you sure you want to deprecate the plan variation "{editPlan?.['Plan Name'] || ''}"? 
            This action cannot be undone.
          </Typography>
        </ConfirmationDialogContent>
        <ConfirmationDialogActions>
          <Button onClick={() => setDeprecateConfirmOpen(false)} sx={{textTransform:'none'}}>Cancel</Button>
          <Button onClick={handleDeprecatePlan} color="warning" variant="contained" sx={{textTransform:'none'}}>
            Confirm Deprecate
          </Button>
        </ConfirmationDialogActions>
      </ConfirmationDialog>
      <ConfirmationDialog open={!!deprecatePlanInfo} onClose={() => setDeprecatePlanInfo(null)}>
        <ConfirmationDialogTitle>Confirm Plan Deprecation</ConfirmationDialogTitle>
        <ConfirmationDialogContent dividers>
          <Typography>
            Are you sure you want to deprecate the entire Square Plan "{deprecatePlanInfo?.name || ''}"? 
            This will deprecate all of its active variations and cannot be undone.
          </Typography>
        </ConfirmationDialogContent>
        <ConfirmationDialogActions>
          <Button onClick={() => setDeprecatePlanInfo(null)} sx={{textTransform:'none'}}>Cancel</Button>
          <Button onClick={confirmDeprecatePlan} color="warning" variant="contained" sx={{textTransform:'none'}} disabled={isSaving}>
            {isSaving ? <CircularProgress size={24} /> : 'Confirm Deprecate Plan'}
          </Button>
        </ConfirmationDialogActions>
      </ConfirmationDialog>
      <Snackbar open={snackbarOpen} autoHideDuration={6000} onClose={() => setSnackbarOpen(false)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}><Alert onClose={() => setSnackbarOpen(false)} severity={snackbarSeverity}>{snackbarMessage}</Alert></Snackbar>
    </Box>
  );
}