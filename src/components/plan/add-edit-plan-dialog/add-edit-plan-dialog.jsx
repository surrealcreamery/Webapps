import React, { useState, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  AppBar,
  Toolbar,
  IconButton,
  Typography,
  DialogContent,
  DialogActions,
  FormControl,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
  FormHelperText,
  ToggleButtonGroup,
  ToggleButton,
  TextField,
  Button,
  Box,
  Stack,
  Snackbar,
  Alert,
  CircularProgress
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import AddIcon from '@mui/icons-material/Add';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  useCreateBenefit,
  useUpdateBenefit,
  useDeleteBenefit
} from '@/contexts/admin/AdminDataContext';

export default function AddEditPlanDialog({
  open,
  editPlan,
  isSaving,
  isDeleting,
  locMap,
  pricingModels,
  showValidation,
  onClose,
  onChangePlan,
  onSave,
  onDelete,
  onDeprecate,
  handleAddPhase,
  handleRemovePhase,
  confirmDeleteOpen,
  setConfirmDeleteOpen,
  onChooseSquarePlan
}) {
  console.log('Rendering AddEditPlanDialog...');
  console.log('Current editPlan:', editPlan);

  const navigate = useNavigate();
  const location = useLocation();

  const createBenefitM = useCreateBenefit();
  const updateBenefitM = useUpdateBenefit();
  const deleteBenefitM = useDeleteBenefit();

  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [benefitConfirmOpen, setBenefitConfirmOpen] = useState(false);
  const [benefitPendingDelete, setBenefitPendingDelete] = useState(null);

  const handleChooseSquare = useCallback(() => {
    if (onChooseSquarePlan) {
      onChooseSquarePlan();
    }
  }, [onChooseSquarePlan]);

  const openBenefitConfirm = useCallback((b) => {
    setBenefitPendingDelete(b);
    setBenefitConfirmOpen(true);
  }, []);

  const closeBenefitConfirm = useCallback(() => {
    setBenefitConfirmOpen(false);
    setBenefitPendingDelete(null);
  }, []);

  const handleConfirmRemoveBenefit = useCallback(() => {
    if (!benefitPendingDelete) {
      closeBenefitConfirm();
      return;
    }
    if (!benefitPendingDelete.id) {
      onChangePlan({
        ...editPlan,
        benefits: (editPlan.benefits || []).filter(x => x.uid !== benefitPendingDelete.uid)
      });
      setSnackbarMessage(`"${benefitPendingDelete.name}" was removed`);
      setSnackbarOpen(true);
      closeBenefitConfirm();
      return;
    }
    deleteBenefitM.mutate(benefitPendingDelete.id, {
      onSuccess: () => {
        onChangePlan({
          ...editPlan,
          benefits: (editPlan.benefits || []).filter(x => x.uid !== benefitPendingDelete.uid)
        });
        setSnackbarMessage(`"${benefitPendingDelete.name}" was removed`);
        setSnackbarOpen(true);
        closeBenefitConfirm();
      }
    });
  }, [benefitPendingDelete, editPlan, onChangePlan, deleteBenefitM, closeBenefitConfirm]);

  const handleAddBenefit = useCallback(() => {
    const newB = { uid: `${Date.now()}`, name: '', frequency: '', type: '' };
    onChangePlan({ ...editPlan, benefits: [...(editPlan.benefits || []), newB] });
  }, [editPlan, onChangePlan]);

  // Helper function to update a single benefit within the benefits array
  // This is a hook and must be called at the top level of the component
  const updateBenefitInPlan = useCallback((benefitId, updatedProps) => {
    onChangePlan(prevPlan => {
      const newBenefits = prevPlan.benefits.map(b => {
        if ((b.id && b.id === benefitId) || (b.uid && b.uid === benefitId)) {
          return { ...b, ...updatedProps };
        }
        return b;
      });
      return { ...prevPlan, benefits: newBenefits };
    });
  }, [onChangePlan]);

  if (!editPlan) {
    return null;
  }

  const isReadOnlyVariation = Boolean(editPlan.squareVariationId || editPlan.variationId);
  const isSquareOnly = !editPlan.id && isReadOnlyVariation;
  
  const planLevelId = editPlan.subscriptionPlanId || editPlan['Square Plan ID'];

  const locationLevelId = locMap[editPlan['Location Name']]?.['Square Subscription Plan ID'];
  const locName = editPlan['Location Name'] || '—';
  const locId = editPlan['Location ID']   || '—';
  const rawLinkedId = editPlan['Linked: Pricing Model ID in Pricing Model'];
  const linkedPricingModelId = Array.isArray(rawLinkedId) ? rawLinkedId[0] : rawLinkedId;
  const linkedPM = pricingModels.find(pm => pm.id === linkedPricingModelId);
  const rawPMType = editPlan['Pricing Model Type'];
  let pricingModelTypeValue = '—';
  if (Array.isArray(rawPMType) && rawPMType.length > 0) {
    pricingModelTypeValue = rawPMType.join(', ');
  } else if (typeof rawPMType === 'string' && rawPMType) {
    pricingModelTypeValue = rawPMType;
  } else if (linkedPM) {
    const pmType = linkedPM['Pricing Model Type'];
    pricingModelTypeValue = Array.isArray(pmType) ? pmType.join(', ') : pmType || '—';
  }
  const variationId = editPlan.squareVariationId ?? editPlan.variationId ?? editPlan['Square Plan Variation ID'] ?? '';
  const showPhases = Boolean(editPlan.squareVariationId || editPlan.variationId);

  return (
    <Dialog fullScreen={true} open={open} onClose={onClose} PaperProps={{ sx: { display: 'flex', flexDirection: 'column', height: '100vh' } }}>
      <AppBar position="static" color="default" elevation={1} sx={{ flexShrink: 0 }}>
        <Toolbar>
          <IconButton edge="start" onClick={onClose}><CloseIcon/></IconButton>
          <Typography variant="h6" sx={{ ml: 2, flex: 1 }}>
            {isSquareOnly && !editPlan.id ? 'View Plan' : (editPlan.id || showPhases || editPlan.orphaned) ? 'Edit Plan' : 'Add Plan'}
          </Typography>
        </Toolbar>
      </AppBar>

      <DialogContent dividers={true} sx={{ p: 2, flexGrow: 1, overflowY: 'auto' }}>
        <Box sx={{ width: '100%', maxWidth: 600, mx: 'auto', display: 'flex', flexDirection: 'column', gap: 2, pb: 2 }}>
          <FormControl component="fieldset"><FormLabel component="legend" variant="body1">Square Plan ID</FormLabel><Typography variant="body1">{planLevelId || locationLevelId || 'None'}</Typography></FormControl>
          <FormControl component="fieldset">
            <FormLabel component="legend" variant="body1">Square Plan Variation ID</FormLabel>
            <Box sx={{ display:'flex', alignItems:'center', flexWrap:'wrap' }}>
              <Typography variant="body1">{variationId || 'None'}</Typography>
              {!isSquareOnly && (<Button variant="text" onClick={handleChooseSquare} sx={{ textTransform: 'none', typography: 'body1', ml: variationId ? 1 : 0 }}>{variationId ? 'Choose a Different Square Plan' : 'Choose a Square Plan'}</Button>)}
            </Box>
          </FormControl>

          {!isSquareOnly && (<FormControl component="fieldset"><FormLabel component="legend" variant="body1">Location Name</FormLabel><Typography variant="body1">{locName} ({locId})</Typography></FormControl>)}
          {!isSquareOnly && (<FormControl component="fieldset"><FormLabel component="legend" variant="body1">Pricing Model Type</FormLabel><Typography variant="body1">{pricingModelTypeValue}</Typography></FormControl>)}
          {!isSquareOnly && (<FormControl component="fieldset" error={showValidation && !linkedPricingModelId}><FormLabel component="legend" variant="body1">Pricing Model</FormLabel><RadioGroup name="pricingModel" value={linkedPricingModelId || ''} onChange={(_, v) => onChangePlan({ ...editPlan, 'Linked: Pricing Model ID in Pricing Model': v })}>{pricingModels.map(pm => (<FormControlLabel key={pm.id} value={pm.id} control={<Radio/>} label={pm.Name}/>))}</RadioGroup></FormControl>)}
          
          {/* ✅ START: Added Plan Type Toggle */}
          {!isSquareOnly && (
            <FormControl>
              <Typography variant="body1">Plan Type</Typography>
              <ToggleButtonGroup 
                exclusive 
                value={editPlan['Plan Type'] || 'Base'} 
                onChange={(_, v) => v && onChangePlan({ ...editPlan, 'Plan Type': v })} 
                size="small"
              >
                <ToggleButton value="Base">Base</ToggleButton>
                <ToggleButton value="Upgrade">Upgrade</ToggleButton>
              </ToggleButtonGroup>
            </FormControl>
          )}
          {/* ✅ END: Added Plan Type Toggle */}

          {!isSquareOnly && (<FormControl error={showValidation && !editPlan.Frequency}><Typography variant="body1">Frequency</Typography><ToggleButtonGroup exclusive value={editPlan.Frequency || ''} onChange={(_, v) => v && onChangePlan({ ...editPlan, Frequency: v })} size="small"><ToggleButton value="Monthly">MONTHLY</ToggleButton><ToggleButton value="Annually">ANNUAL</ToggleButton></ToggleButtonGroup>{showValidation && !editPlan.Frequency && <FormHelperText>Select frequency</FormHelperText>}</FormControl>)}
          {!isSquareOnly && (<FormControl error={showValidation && !editPlan.Status}><Typography variant="body1">Status</Typography><ToggleButtonGroup exclusive value={editPlan.Status || ''} onChange={(_, v) => v && onChangePlan({ ...editPlan, Status: v })} size="small"><ToggleButton value="Active">ACTIVE</ToggleButton><ToggleButton value="Inactive">INACTIVE</ToggleButton></ToggleButtonGroup>{showValidation && !editPlan.Status && <FormHelperText>Select status</FormHelperText>}</FormControl>)}

          <TextField label="Plan Name" value={editPlan['Plan Name'] || ''} onChange={e => onChangePlan({ ...editPlan, 'Plan Name': e.target.value })} error={showValidation && !editPlan['Plan Name']} helperText={showValidation && !editPlan['Plan Name'] ? 'Required' : ''} fullWidth disabled={isSquareOnly}/>
          {!isSquareOnly && (<>
              <TextField label="Add On" value={editPlan['Add On']||''} onChange={e=>onChangePlan({...editPlan,'Add On':e.target.value})} fullWidth/>
              <TextField label="Price" type="number" required value={editPlan.Price??''} onChange={e=>onChangePlan({...editPlan,Price:parseFloat(e.target.value)})} error={showValidation&&editPlan.Price==null} helperText={showValidation&&editPlan.Price==null?'Required':''} fullWidth/>
              <TextField label="Description" value={editPlan.Description||''} onChange={e=>onChangePlan({...editPlan,Description:e.target.value})} fullWidth/>
          </>)}

          {!isSquareOnly && editPlan.id && (<>
              <FormLabel component="legend" variant="body1">Benefits</FormLabel>
              {(editPlan.benefits||[]).map(b => {
                const errName = !b.name; const errFreq = !b.frequency; const errType = !b.type;
                
                console.log('Rendering benefit:', b.uid || b.id, 'with data:', b);

                return (<Box key={b.id??b.uid} sx={{border:'1px solid #ddd',borderRadius:1,p:2,mb:2}}>
                    <TextField label="Benefit Name" value={b.name} onChange={e=>updateBenefitInPlan(b.id || b.uid, { name: e.target.value })} error={errName} helperText={errName?'Required':''} fullWidth sx={{mb:2}}/>
                    <FormControl fullWidth error={errFreq} sx={{mb:2}}><Typography variant="body1">Frequency</Typography><ToggleButtonGroup exclusive value={b.frequency} onChange={(_,v)=>{
                      console.log('Frequency changed for benefit:', b.uid || b.id, 'New value:', v);
                      updateBenefitInPlan(b.id || b.uid, { frequency: v });
                    }} size="small"><ToggleButton value="Monthly">Monthly</ToggleButton><ToggleButton value="Daily">Daily</ToggleButton></ToggleButtonGroup>{errFreq && <FormHelperText>Required</FormHelperText>}</FormControl>
                    <FormControl fullWidth error={errType} sx={{mb:2}}><Typography variant="body1">Type</Typography><ToggleButtonGroup exclusive value={b.type} onChange={(_,v)=>{
                      console.log('Type changed for benefit:', b.uid || b.id, 'New value:', v);
                      updateBenefitInPlan(b.id || b.uid, { type: v });
                    }} size="small"><ToggleButton value="Inclusive">Inclusive</ToggleButton><ToggleButton value="Add-On">Add-On</ToggleButton></ToggleButtonGroup>{errType && <FormHelperText>Required</FormHelperText>}</FormControl>
                    <Stack direction="row" justifyContent="space-between">
                      {b.id
                        ? <Button variant="text" disabled={updateBenefitM.isLoading} sx={{textTransform:'none'}} onClick={()=>updateBenefitM.mutate({id:b.id,name:b.name,Frequency:b.frequency,Type:b.type,linkedPlanId:editPlan.id},{onSuccess:()=>{setSnackbarMessage(`"${b.name}" was updated`);setSnackbarOpen(true);}})}>{updateBenefitM.isLoading?'Updating…':'Update Benefit'}</Button>
                        : <Button variant="text" disabled={createBenefitM.isLoading} sx={{textTransform:'none'}} onClick={()=>createBenefitM.mutate({name:b.name,Frequency:b.frequency,Type:b.type,linkedPlanId:editPlan.id},{onSuccess:arr=>{const c=Array.isArray(arr)?arr[0]:arr;onChangePlan(prev=>({...prev,benefits:prev.benefits.map(x=>x.uid===b.uid?{uid:c.id,id:c.id,name:x.name,frequency:x.frequency,type:x.type}:x)}));setSnackbarMessage(`"${b.name}" was saved`);setSnackbarOpen(true);}})}>{createBenefitM.isLoading?'Saving…':'Save Benefit'}</Button>
                      }
                      <Button variant="text" color="error" startIcon={<CloseIcon/>} sx={{textTransform:'none'}} onClick={()=>openBenefitConfirm(b)}>Remove Benefit</Button>
                    </Stack>
                  </Box>);
              })}
              <Button variant="text" startIcon={<AddIcon/>} sx={{textTransform:'none',alignSelf:'flex-start',mb:2}} onClick={handleAddBenefit}>Add Benefit</Button>
          </>)}

          {showPhases && (editPlan.phases||[]).map(phase=>(<Box key={phase.uid} sx={{border:'1px solid #ddd',borderRadius:1,p:2,mb:2}}>
              <FormControl fullWidth sx={{mb:2}}><Typography variant="body1">Cadence</Typography><ToggleButtonGroup exclusive value={phase.cadence||''} disabled size="small">{['DAILY','WEEKLY','MONTHLY','ANNUAL'].map(opt=><ToggleButton key={opt} value={opt}>{opt}</ToggleButton>)}</ToggleButtonGroup></FormControl>
              <TextField label="Periods" type="number" value={phase.periods} fullWidth disabled sx={{mb:2}}/>
              <FormControl fullWidth sx={{mb:2}}><Typography variant="body1">Pricing Type</Typography><ToggleButtonGroup exclusive value={phase.pricing?.type||''} disabled size="small">{['STATIC','VARIABLE'].map(opt=><ToggleButton key={opt} value={opt}>{opt}</ToggleButton>)}</ToggleButtonGroup></FormControl>
              <TextField label="Amount (cents)" type="number" value={phase.pricing?.price_money?.amount??''} fullWidth disabled sx={{mb:2}}/>
              <TextField label="Currency" value={phase.pricing?.price_money?.currency||''} fullWidth disabled/>
          </Box>))}

          {!isSquareOnly && (
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pt: 2 }}>
              <Button variant="contained" onClick={onSave} disabled={isSaving} sx={{ textTransform: 'none' }}>
                {isSaving ? <CircularProgress size={24} /> : 'SAVE'}
              </Button>
              {editPlan.id && (
                <Button variant="outlined" color="error" onClick={()=>setConfirmDeleteOpen(true)} sx={{ textTransform: 'none' }}>
                  DELETE
                </Button>
              )}
            </Box>
          )}

          {isSquareOnly && (
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Button variant="contained" color="error" onClick={onDeprecate}>DEPRECATE PLAN VARIATION</Button>
            </Box>
          )}
        </Box>
      </DialogContent>
      
      <Dialog open={confirmDeleteOpen} onClose={()=>setConfirmDeleteOpen(false)}>
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent dividers><Typography>Deleting this plan will also delete any benefits and remove entitlements for all subscribers.</Typography></DialogContent>
        <DialogActions>
          <Button variant="text" onClick={()=>setConfirmDeleteOpen(false)} sx={{textTransform:'none'}}>Cancel</Button>
          <Button variant="contained" color="error" onClick={onDelete} disabled={isDeleting} sx={{textTransform:'none'}}>{isDeleting ? <CircularProgress size={20} /> : 'Delete'}</Button>
        </DialogActions>
      </Dialog>
      
      <Dialog open={benefitConfirmOpen} onClose={closeBenefitConfirm}>
        <DialogTitle>Confirm Remove Benefit</DialogTitle>
        <DialogContent dividers><Typography>Confirm that you'd like to remove "{benefitPendingDelete?.name}". This will remove the benefit for all subscribers and may impact plan terms.</Typography></DialogContent>
        <DialogActions>
          <Button variant="text" onClick={closeBenefitConfirm} sx={{textTransform:'none'}}>Cancel</Button>
          <Button variant="contained" color="error" onClick={handleConfirmRemoveBenefit} sx={{textTransform:'none'}}>Confirm Remove</Button>
        </DialogActions>
      </Dialog>
      
      <Snackbar open={snackbarOpen} autoHideDuration={6000} onClose={()=>setSnackbarOpen(false)} anchorOrigin={{vertical:'bottom',horizontal:'center'}}><Alert onClose={()=>setSnackbarOpen(false)} severity="success">{snackbarMessage}</Alert></Snackbar>
    </Dialog>
  );
}