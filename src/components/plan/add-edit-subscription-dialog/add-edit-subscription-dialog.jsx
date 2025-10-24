import React, { useState, useEffect } from 'react';
import {
  Dialog,
  AppBar,
  Toolbar,
  IconButton,
  Typography,
  DialogContent,
  TextField,
  Button,
  Box,
  List,
  ListItemButton,
  ListItemText,
  Divider,
  CircularProgress,
  Snackbar,
  Alert,
  ToggleButton,
  ToggleButtonGroup,
  FormControl,
  FormHelperText,
  ListItemIcon
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import RefreshIcon from '@mui/icons-material/Refresh';
import CheckIcon from '@mui/icons-material/Check';
import {
  useLocations,
  usePlans,
  useSubscribers,
  useBenefits,
  useEntitlements
} from '@/contexts/admin/AdminDataContext';

/**
 * formatPhoneNumber
 * MODIFIED: This function is now safe and will not crash if phone is null.
 */
function formatPhoneNumber(phone) {
  const str = phone != null ? String(phone) : '';
  const digits = str.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) {
    const area = digits.slice(1, 4);
    const prefix = digits.slice(4, 7);
    const line = digits.slice(7, 11);
    return `(${area}) ${prefix}-${line}`;
  }
  if (digits.length === 10) {
    const area = digits.slice(0, 3);
    const prefix = digits.slice(3, 6);
    const line = digits.slice(6, 10);
    return `(${area}) ${prefix}-${line}`;
  }
  return str;
}

/** getId **/
const getId = (item, key) => item?.id ?? item?.[key] ?? '';

/** getName **/
const getName = (item, labels) => {
  if (!item) return '';
  for (let label of labels) {
    if (item[label]) {
      return Array.isArray(item[label]) ? item[label][0] : item[label];
    }
  }
  return '';
};

/**
 * AddSubscriptionDialog
 */
export default function AddSubscriptionDialog({
  open,
  onClose,
  onSave,
  entitlements = [],
  isViewing = false,
  subscription = {},
  isLoading = false
}) {
  const safe = subscription || {};

  // — VIEW MODE —
  if (isViewing) {
    const first = safe['First Name'] ?? '',
          last  = safe['Last Name']  ?? '';
    return (
      <Dialog fullScreen open={open} onClose={onClose}>
        <AppBar position="sticky" color="default" elevation={1}>
          <Toolbar>
            <IconButton edge="start" onClick={onClose}><CloseIcon/></IconButton>
            <Typography variant="h6" sx={{ ml:2 }}>
              {(first||last)?`${first} ${last}`:'Entitlements'}
            </Typography>
          </Toolbar>
        </AppBar>
        <DialogContent dividers sx={{ overflowY:'auto', p:3, width:'100%', maxWidth:600, mx:'auto' }}>
          <Box sx={{ mb:2 }}>
            <Typography><strong>Code:</strong> {safe.Code ?? '—'}</Typography>
            <Typography><strong>Subscription End Date:</strong> {safe['Subscription End Date'] ?? '—'}</Typography>
          </Box>
          {isLoading
            ? <Box sx={{ textAlign:'center', py:4 }}><CircularProgress/></Box>
            : entitlements.length===0
              ? <Box sx={{ textAlign:'center', py:4 }}><Typography>No entitlements found.</Typography></Box>
              : (
                <List>
                  {entitlements.map((b,idx) => {
                    const id     = getId(b,'Benefit ID')||idx;
                    const name   = getName(b,['Benefit Name','Display Benefit Name']);
                    const status = getName(b,['Redeem Status']);
                    const freq   = getName(b,['Frequency']);
                    const last   = b['Last Redeemed Date'] ?? '';
                    const until  = b['Redeem End Date']      ?? '';
                    const can    = status==='Available';
                    return (
                      <React.Fragment key={id}>
                        <ListItemButton disableRipple sx={{ alignItems:'flex-start' }}>
                          <ListItemText
                            primary={name}
                            secondary={
                              <>
                                <Typography component="div" sx={{ color:can?'green':'red' }}>{status}</Typography>
                                <Typography component="div">{freq}</Typography>
                                <Typography component="div">Last Redeemed: {last}</Typography>
                                <Typography component="div">Redeem Until: {until}</Typography>
                              </>
                            }
                          />
                          <Button variant="contained" size="small" disabled={!can}>Redeem</Button>
                        </ListItemButton>
                        {idx<entitlements.length-1 && <Divider component="li"/>}
                      </React.Fragment>
                    );
                  })}
                </List>
              )
          }
        </DialogContent>
      </Dialog>
    );
  }

  // — ADD MODE —
  const [locationId, setLocationId]           = useState('');
  const [planId, setPlanId]                   = useState('');
  // RESTORED: State for the single primary subscriber (owner)
  const [subscriberId, setSubscriberId]       = useState('');
  // NEW: State for the list of active subscribers
  const [activeSubscriberIds, setActiveSubscriberIds] = useState([]);
  const [entitlementIds, setEntitlementIds]   = useState([]);
  const [notes, setNotes]                     = useState('');
  const [status, setStatus]                   = useState('');
  const [subscriptionEnd, setSubscriptionEnd] = useState('');
  const [code, setCode]                       = useState('');
  const [errors, setErrors]                   = useState({
    location:false,plan:false,subscriber:false,entitlement:false,status:false,subscriptionEnd:false
  });
  const [showSnackbar, setShowSnackbar]       = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState('success');

  const [openLocationPicker, setOpenLocationPicker]       = useState(false);
  const [openPlanPicker, setOpenPlanPicker]               = useState(false);
  const [openSubscriberPicker, setOpenSubscriberPicker]   = useState(false);
  const [openEntitlementPicker, setOpenEntitlementPicker] = useState(false);

  // NEW: State to control the picker's behavior (single or multi-select)
  const [pickerMode, setPickerMode] = useState('single');

  const [locationFilter, setLocationFilter]       = useState('');
  const [planFilter, setPlanFilter]               = useState('');
  const [subscriberFilter, setSubscriberFilter]   = useState('');

  const {
    data: locations = [], isLoading: locationsLoading, refetch: refetchLocations
  } = useLocations();
  const {
    data: plans = [], isLoading: plansLoading, refetch: refetchPlans
  } = usePlans();
  const {
    data: subscribers = [], isLoading: subscribersLoading, refetch: refetchSubscribers
  } = useSubscribers();
  const {
    data: benefits = [], isLoading: benefitsLoading, refetch: refetchBenefits
  } = useBenefits();

  // generate random code when opening
  useEffect(()=>{
    if (open) {
      setCode(Math.floor(100000+Math.random()*900000).toString());
    }
  }, [open]);

  // filter logic for Add
  const availablePlans   = locationId
    ? plans.filter(p =>
        Array.isArray(p['Linked: Location ID in Locations']) &&
        p['Linked: Location ID in Locations'].includes(locationId)
      )
    : plans;
  const filteredPlans    = availablePlans.filter(pl =>
    getName(pl,['Plan Name']).toLowerCase().includes(planFilter.toLowerCase())
  );
  const filteredBenefits = planId
    ? benefits.filter(b =>
        Array.isArray(b['Linked: Plan ID in Plans']) &&
        b['Linked: Plan ID in Plans'].includes(planId)
      )
    : [];

  // handlers
  const handleClear = () => {
    setLocationId(''); setPlanId(''); setSubscriberId('');
    // NEW: Clear active subscribers
    setActiveSubscriberIds([]);
    setEntitlementIds([]); setNotes(''); setStatus(''); setSubscriptionEnd('');
    setErrors({location:false,plan:false,subscriber:false,entitlement:false,status:false,subscriptionEnd:false});
    setCode(Math.floor(100000+Math.random()*900000).toString());
  };
  const handleSave = () => {
    const newErr = {
      location: !locationId,
      plan:     !planId,
      subscriber: !subscriberId, // Validation restored to single primary subscriber
      entitlement: entitlementIds.length===0,
      status:     !status,
      subscriptionEnd: !subscriptionEnd
    };
    setErrors(newErr);
    if (Object.values(newErr).some(e=>e)) {
      setSnackbarMessage('Please fill all required fields');
      setSnackbarSeverity('error');
      setShowSnackbar(true);
      return;
    }
    // MODIFIED: Include both subscriberId and activeSubscriberIds in the payload
    onSave({
      locationId,
      planId,
      subscriberId,
      activeSubscriberIds,
      entitlementIds,
      notes:notes||null,
      status,
      subscriptionEnd,
      code
    });
    handleClear();
  };
  const handleCloseSnackbar = () => setShowSnackbar(false);

  return (
    <>
      {/* Add Subscription Dialog */}
      <Dialog fullScreen open={open} onClose={onClose}>
        <AppBar position="sticky" color="default" elevation={1}>
          <Toolbar>
            <IconButton edge="start" onClick={onClose}><CloseIcon/></IconButton>
            <Typography variant="h6" sx={{ ml:2 }}>Add Subscription</Typography>
          </Toolbar>
        </AppBar>
        <DialogContent dividers sx={{
          overflowY:'auto',
          display:'flex',
          flexDirection:'column',
          gap:2,
          p:3,
          width:'100%',
          maxWidth:600,
          mx:'auto'
        }}>
          {/* Status */}
          <FormControl error={errors.status}>
            <ToggleButtonGroup
              value={status}
              exclusive
              size="small"
              onChange={(e,val)=>val!==null&&setStatus(val)}
            >
              <ToggleButton value="Active">Active</ToggleButton>
              <ToggleButton value="Cancelled">Cancelled</ToggleButton>
              <ToggleButton value="Training">Training</ToggleButton>
              <ToggleButton value="Unpaid">Unpaid</ToggleButton>
            </ToggleButtonGroup>
            {errors.status && <FormHelperText>Required</FormHelperText>}
          </FormControl>

          {/* Linked Location */}
          <TextField
            label="Linked Location"
            value={getName(locations.find(l=>getId(l,'Location ID')===locationId)||{},['Location Name'])}
            onClick={()=>setOpenLocationPicker(true)}
            fullWidth required InputProps={{readOnly:true}} disabled={!!planId}
            error={errors.location}
            helperText={errors.location?'Required':planId?'Locked when plan is selected':''}
          />

          {/* Linked Plan */}
          <TextField
            label="Linked Plan"
            value={getName(plans.find(p=>getId(p,'Plan ID')===planId)||{},['Plan Name'])}
            onClick={()=>setOpenPlanPicker(true)}
            fullWidth required InputProps={{readOnly:true}}
            error={errors.plan} helperText={errors.plan&&'Required'}
          />

          {/* RESTORED: Linked Subscriber (Primary Owner) - Single Select */}
          <TextField
            label="Linked Subscriber (Owner)"
            value={getName(subscribers.find(s=>getId(s,'Subscriber ID')===subscriberId)||{},['Display Name'])}
            onClick={() => {
              setPickerMode('single'); // Set mode for the picker
              setOpenSubscriberPicker(true);
            }}
            fullWidth required InputProps={{readOnly:true}}
            error={errors.subscriber} helperText={errors.subscriber&&'Required'}
          />
          
          {/* NEW: Active Subscribers - Multi-select */}
          <TextField
            label="Active Subscribers (optional)"
            value={
              subscribers
                .filter(s => activeSubscriberIds.includes(getId(s, 'Subscriber ID')))
                .map(s => getName(s, ['Display Name']))
                .join(', ')
            }
            onClick={() => {
              setPickerMode('multi'); // Set mode for the picker
              setOpenSubscriberPicker(true);
            }}
            fullWidth InputProps={{readOnly:true}}
            multiline
          />

          {/* Linked Benefits */}
          <TextField
            label="Linked Benefits"
            value={filteredBenefits
              .filter(b => entitlementIds.includes(getId(b,'Benefit ID')))
              .map(b => getName(b,['Benefit Name','Display Benefit Name']))
              .join(', ')}
            onClick={()=>setOpenEntitlementPicker(true)}
            fullWidth required disabled={!planId} InputProps={{readOnly:true}}
            error={errors.entitlement} helperText={errors.entitlement&&'Required'}
          />

          {/* Notes */}
          <TextField label="Notes" value={notes} onChange={e=>setNotes(e.target.value)} fullWidth />

          {/* Subscription End Date */}
          <TextField
            label="Subscription End Date"
            type="date"
            value={subscriptionEnd}
            onChange={e=>setSubscriptionEnd(e.target.value)}
            fullWidth required InputLabelProps={{shrink:true}}
            error={errors.subscriptionEnd} helperText={errors.subscriptionEnd&&'Required'}
          />

          {/* Code */}
          <TextField label="Code" value={code} fullWidth disabled />

          {/* Actions */}
          <Box sx={{ display:'flex', justifyContent:'space-between', mt:2 }}>
            <Box sx={{ display:'flex', gap:2 }}>
              <Button variant="contained" onClick={handleSave}>Save</Button>
              <Button variant="text" onClick={handleClear}>Clear</Button>
            </Box>
            <Button variant="outlined" onClick={onClose}>Cancel</Button>
          </Box>
        </DialogContent>
      </Dialog>

      {/* Location Picker */}
      <Dialog
        fullScreen
        open={openLocationPicker}
        onClose={()=>setOpenLocationPicker(false)}
        PaperProps={{sx:{display:'flex',flexDirection:'column',height:'100vh'}}}
      >
        <AppBar position="sticky" color="default" elevation={1}>
          <Toolbar>
            <IconButton edge="start" onClick={()=>setOpenLocationPicker(false)}><CloseIcon/></IconButton>
            <Typography variant="h6" sx={{ ml:2 }}>Select Location</Typography>
            <Box sx={{ flex:1 }}/>
            <IconButton edge="end" onClick={refetchLocations}><RefreshIcon/></IconButton>
          </Toolbar>
        </AppBar>
        {locationsLoading
          ? <Box sx={{ p:4, textAlign:'center' }}><CircularProgress/></Box>
          : (
            <DialogContent dividers sx={{
              p:0,
              flex:1,
              overflowY:'auto',
              width:'100%',
              maxWidth:600,
              mx:'auto'
            }}>
              <Box sx={{ p:2 }}>
                <TextField
                  label="Filter Locations"
                  placeholder="Type to filter locations"
                  value={locationFilter}
                  onChange={e=>setLocationFilter(e.target.value)}
                  fullWidth
                />
              </Box>
              <List>
                {locations
                  .filter(loc => getName(loc,['Location Name']).toLowerCase().includes(locationFilter.toLowerCase()))
                  .map((loc,idx,arr) => {
                    const msgs = [];
                    if (!loc['Square Location ID']) msgs.push('No Square Location ID');
                    if (!loc['Square Subscription Plan ID']) msgs.push('No Square Subscription Plan ID');
                    return (
                      <React.Fragment key={getId(loc,'Location ID')}>
                        <ListItemButton
                          selected={getId(loc,'Location ID')===locationId}
                          disabled={msgs.length>0}
                          onClick={() => {
                            if (!msgs.length) {
                              setLocationId(getId(loc,'Location ID'));
                              setPlanId('');
                              setEntitlementIds([]);
                              setOpenLocationPicker(false);
                            }
                          }}
                        >
                          <ListItemText
                            primary={getName(loc,['Location Name'])}
                            secondary={msgs.length>0 ? msgs.join(' • ') : getName(loc,['Description'])}
                          />
                        </ListItemButton>
                        {idx< arr.length-1 && <Divider component="li"/>}
                      </React.Fragment>
                    );
                  })}
              </List>
            </DialogContent>
          )
        }
      </Dialog>

      {/* Plan Picker */}
      <Dialog
        fullScreen
        open={openPlanPicker}
        onClose={()=>setOpenPlanPicker(false)}
        PaperProps={{sx:{display:'flex',flexDirection:'column',height:'100vh'}}}
      >
        <AppBar position="sticky" color="default" elevation={1}>
          <Toolbar>
            <IconButton edge="start" onClick={()=>setOpenPlanPicker(false)}><CloseIcon/></IconButton>
            <Typography variant="h6" sx={{ ml:2 }}>Select Plan</Typography>
            <Box sx={{ flex:1 }}/>
            <IconButton edge="end" onClick={refetchPlans}><RefreshIcon/></IconButton>
          </Toolbar>
        </AppBar>
        {plansLoading
          ? <Box sx={{ p:4, textAlign:'center' }}><CircularProgress/></Box>
          : (
            <DialogContent dividers sx={{
              p:0,
              flex:1,
              overflowY:'auto',
              width:'100%',
              maxWidth:600,
              mx:'auto'
            }}>
              <Box sx={{ p:2 }}>
                <TextField
                  label="Filter Plans"
                  placeholder="Type to filter plans"
                  value={planFilter}
                  onChange={e=>setPlanFilter(e.target.value)}
                  fullWidth
                />
              </Box>
              <Box sx={{ flex:1, overflowY:'auto' }}>
                {['Deprecated','Acquisition','Renewal'].map(type => {
                  const items = filteredPlans.filter(pl =>
                    Array.isArray(pl.Type) && pl.Type.includes(type)
                  );
                  if (!items.length) return null;
                  return (
                    <Box key={type} sx={{ mb:2 }}>
                      <Typography variant="subtitle1" sx={{ ml:1 }}>{type}</Typography>
                      <List>
                        {items.map((pl,idx) => (
                          <React.Fragment key={getId(pl,'Plan ID')}>
                            <ListItemButton
                              selected={getId(pl,'Plan ID')===planId}
                              onClick={() => {
                                const pid = getId(pl,'Plan ID');
                                setPlanId(pid);
                                const locs = Array.isArray(pl['Linked: Location ID in Locations'])
                                  ? pl['Linked: Location ID in Locations']
                                  : [];
                                if (locs.length) setLocationId(locs[0]);
                                setEntitlementIds([]);
                                setOpenPlanPicker(false);
                              }}
                            >
                              <ListItemText
                                primary={getName(pl,['Plan Name'])}
                                secondary={
                                  <>
                                    {getName(pl,['Add On']) && (
                                      <Typography component="div">{getName(pl,['Add On'])}</Typography>
                                    )}
                                    <Typography component="div">{getName(pl,['Description'])}</Typography>
                                  </>
                                }
                              />
                            </ListItemButton>
                            {idx<items.length-1 && <Divider component="li"/>}
                          </React.Fragment>
                        ))}
                      </List>
                    </Box>
                  );
                })}
              </Box>
            </DialogContent>
          )
        }
      </Dialog>

      {/* MODIFIED: Subscriber Picker now handles both single and multi-select modes */}
      <Dialog
        fullScreen
        open={openSubscriberPicker}
        onClose={()=>setOpenSubscriberPicker(false)}
        PaperProps={{sx:{display:'flex',flexDirection:'column',height:'100vh'}}}
      >
        <AppBar position="sticky" color="default" elevation={1}>
          <Toolbar>
            <IconButton edge="start" onClick={()=>setOpenSubscriberPicker(false)}><CloseIcon/></IconButton>
            <Typography variant="h6" sx={{ ml:2 }}>
              {pickerMode === 'single' ? 'Select Subscriber (Owner)' : 'Select Active Subscribers'}
            </Typography>
            <Box sx={{ flex:1 }}/>
            <IconButton edge="end" onClick={refetchSubscribers}><RefreshIcon/></IconButton>
          </Toolbar>
        </AppBar>
        {subscribersLoading
          ? <Box sx={{ p:4, textAlign:'center' }}><CircularProgress/></Box>
          : (
            <DialogContent dividers sx={{
              p:0,
              flex:1,
              overflowY:'auto',
              width:'100%',
              maxWidth:600,
              mx:'auto'
            }}>
              <Box sx={{ p:2, position: 'sticky', top: 0, zIndex: 1, bgcolor: 'background.paper' }}>
                <TextField
                  label="Filter Subscribers"
                  placeholder="Type to filter subscribers"
                  value={subscriberFilter}
                  onChange={e=>setSubscriberFilter(e.target.value)}
                  fullWidth
                />
              </Box>
              <List>
                {subscribers
                  .filter(sub => {
                    const name  = getName(sub,['Display Name']).toLowerCase();
                    const email = (sub.Email||'').toLowerCase();
                    const phone = formatPhoneNumber(sub.Phone).toLowerCase();
                    const f     = subscriberFilter.toLowerCase();
                    return name.includes(f) || email.includes(f) || phone.includes(f);
                  })
                  .map((sub,idx,arr) => {
                    const subId = getId(sub, 'Subscriber ID');
                    // Determine if selected based on picker mode
                    const isSelected = pickerMode === 'single'
                      ? subId === subscriberId
                      : activeSubscriberIds.includes(subId);

                    return (
                      <React.Fragment key={subId}>
                        <ListItemButton
                          selected={isSelected}
                          onClick={() => {
                            // Logic depends on picker mode
                            if (pickerMode === 'single') {
                              setSubscriberId(subId);
                              setOpenSubscriberPicker(false); // Close after single selection
                            } else {
                              // Toggle selection for multi-mode
                              setActiveSubscriberIds(prev =>
                                isSelected
                                  ? prev.filter(id => id !== subId)
                                  : [...prev, subId]
                              );
                            }
                          }}
                        >
                          {isSelected && <ListItemIcon><CheckIcon /></ListItemIcon>}
                          <ListItemText
                            primary={getName(sub,['Display Name'])}
                            secondary={`${sub.Email} ${formatPhoneNumber(sub.Phone)}`}
                            inset={!isSelected}
                          />
                        </ListItemButton>
                        {idx< arr.length-1 && <Divider component="li"/>}
                      </React.Fragment>
                    );
                  })}
              </List>
            </DialogContent>
          )
        }
      </Dialog>
      
      {/* Entitlement Picker */}
      <Dialog
        fullScreen
        open={openEntitlementPicker}
        onClose={()=>setOpenEntitlementPicker(false)}
        PaperProps={{sx:{display:'flex',flexDirection:'column',height:'100vh'}}}
      >
        <AppBar position="sticky" color="default" elevation={1}>
          <Toolbar>
            <IconButton edge="start" onClick={()=>setOpenEntitlementPicker(false)}><CloseIcon/></IconButton>
            <Typography variant="h6" sx={{ ml:2 }}>Select Benefit</Typography>
            <Box sx={{ flex:1 }}/>
            <IconButton edge="end" onClick={refetchBenefits}><RefreshIcon/></IconButton>
          </Toolbar>
        </AppBar>
        {benefitsLoading
          ? <Box sx={{ p:4, textAlign:'center' }}><CircularProgress/></Box>
          : (
            <DialogContent dividers sx={{
              p:0,
              flex:1,
              overflowY:'auto',
              width:'100%',
              maxWidth:600,
              mx:'auto'
            }}>
              <List>
                {filteredBenefits.map((b,idx) => {
                  const bid = getId(b,'Benefit ID');
                  const selected = entitlementIds.includes(bid);
                  return (
                    <React.Fragment key={bid}>
                      <ListItemButton
                        selected={selected}
                        onClick={() => {
                          setEntitlementIds(prev =>
                            prev.includes(bid)
                              ? prev.filter(x=>x!==bid)
                              : [...prev,bid]
                          );
                        }}
                      >
                        {selected && <ListItemIcon><CheckIcon /></ListItemIcon>}
                        <ListItemText
                          primary={getName(b,['Benefit Name','Display Benefit Name'])}
                          secondary={[getName(b,['Status']), getName(b,['Frequency'])].filter(Boolean).join(' • ')}
                          inset={!selected}
                        />
                      </ListItemButton>
                      {idx<filteredBenefits.length-1 && <Divider component="li"/>}
                    </React.Fragment>
                  );
                })}
              </List>
            </DialogContent>
          )
        }
      </Dialog>

      {/* Snackbar */}
      <Snackbar
        open={showSnackbar}
        autoHideDuration={3000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{vertical:'bottom',horizontal:'center'}}
      >
        <Alert onClose={handleCloseSnackbar} severity={snackbarSeverity} sx={{ width:'100%' }}>
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </>
  );
}

/**
 * EditSubscriptionDialog
 */
export function EditSubscriptionDialog({
  open,
  onClose,
  onSave,
  subscription = {},
  isLoading = false
}) {
  // 1) form state
  const [locationId, setLocationId]           = useState('');
  const [planId, setPlanId]                   = useState('');
  // RESTORED: State for the single primary subscriber (owner)
  const [subscriberId, setSubscriberId]       = useState('');
  // NEW: State for the list of active subscribers
  const [activeSubscriberIds, setActiveSubscriberIds] = useState([]);
  const [entitlementIds, setEntitlementIds]   = useState([]); // benefit IDs
  const [notes, setNotes]                     = useState('');
  const [status, setStatus]                   = useState('');
  const [subscriptionEnd, setSubscriptionEnd] = useState('');
  const [code, setCode]                       = useState('');

  // 2) pickers & filters
  const [openLocationPicker, setOpenLocationPicker]       = useState(false);
  const [openPlanPicker, setOpenPlanPicker]               = useState(false);
  const [openSubscriberPicker, setOpenSubscriberPicker]   = useState(false);
  const [openEntitlementPicker, setOpenEntitlementPicker] = useState(false);
  // NEW: State to control the picker's behavior (single or multi-select)
  const [pickerMode, setPickerMode] = useState('single');
  const [locationFilter, setLocationFilter]     = useState('');
  const [planFilter, setPlanFilter]             = useState('');
  const [subscriberFilter, setSubscriberFilter] = useState('');

  // 3) context data
  const {
    data: locations = [],
    isLoading: locationsLoading,
    refetch: refetchLocations
  } = useLocations();
  const {
    data: plans = [],
    isLoading: plansLoading,
    refetch: refetchPlans
  } = usePlans();
  const {
    data: subscribers = [],
    isLoading: subscribersLoading,
    refetch: refetchSubscribers
  } = useSubscribers();
  const {
    data: benefits = [],
    isLoading: benefitsLoading,
    refetch: refetchBenefits
  } = useBenefits();
  const {
    data: allEntitlements = [],
    isLoading: entsLoading,
    refetch: refetchEntitlements
  } = useEntitlements();

  // 4) seed when dialog opens
  useEffect(() => {
    if (!open) return;
    const sub = subscription || {};

    // location
    const locsArr = sub['Linked: Square Location ID in Locations'];
    setLocationId(Array.isArray(locsArr) ? locsArr[0] : '');

    // plan
    const planArr = sub['Plan ID'];
    setPlanId(Array.isArray(planArr) ? planArr[0] : '');

    // MODIFIED: Seed both primary and active subscribers
    const subsArr = sub['Linked: Subscriber ID in Subscribers'];
    setSubscriberId(Array.isArray(subsArr) ? subsArr[0] : ''); // Primary is the first
    
    const activeSubsArr = sub['Linked: Active Subscriber ID in Subscribers'];
    setActiveSubscriberIds(Array.isArray(activeSubsArr) ? activeSubsArr : []);

    // benefits
    let benefitArr = Array.isArray(sub['Linked: Benefit ID in Benefits'])
      ? sub['Linked: Benefit ID in Benefits']
      : [];
    if (!benefitArr.length && Array.isArray(sub['Linked: Entitlement ID in Entitlements'])) {
      benefitArr = allEntitlements
        .filter(ent => sub['Linked: Entitlement ID in Entitlements'].includes(ent.id))
        .map(ent =>
          Array.isArray(ent['Linked: Benefit ID in Benefits'])
            ? ent['Linked: Benefit ID in Benefits'][0]
            : ent['Linked: Benefit ID in Benefits']
        )
        .filter(Boolean);
    }
    setEntitlementIds(Array.isArray(benefitArr) ? benefitArr : []);

    // rest
    setNotes(sub.Notes ?? '');
    setStatus(sub.Status ?? '');
    setSubscriptionEnd(sub['Subscription End Date'] ?? '');
    setCode(sub.Code ?? '');
  }, [open, subscription, allEntitlements]);

  // 5) derive filtered lists
  const availablePlans = locationId
    ? plans.filter(p =>
        Array.isArray(p['Linked: Location ID in Locations']) &&
        p['Linked: Location ID in Locations'].includes(locationId)
      )
    : plans;
  const filteredPlans = availablePlans.filter(pl =>
    getName(pl,['Plan Name']).toLowerCase().includes(planFilter.toLowerCase())
  );
  const filteredBenefits = planId
    ? benefits.filter(b =>
        Array.isArray(b['Linked: Plan ID in Plans']) &&
        b['Linked: Plan ID in Plans'].includes(planId)
      )
    : [];

  // 6) save handler
  const handleSave = () => {
    onSave({
      ...subscription,
      locationId,
      planId,
      subscriberId,
      activeSubscriberIds,
      entitlementIds,
      notes,
      status,
      subscriptionEnd,
      code
    });
    onClose();
  };

  return (
    <>
      <Dialog fullScreen open={open} onClose={onClose}>
        <AppBar position="sticky" color="default" elevation={1}>
          <Toolbar>
            <IconButton edge="start" onClick={onClose}><CloseIcon/></IconButton>
            <Typography variant="h6" sx={{ ml:2 }}>Edit Subscription</Typography>
          </Toolbar>
        </AppBar>
        <DialogContent dividers sx={{
          overflowY:'auto',
          display:'flex',
          flexDirection:'column',
          gap:2,
          p:3,
          width:'100%',
          maxWidth:600,
          mx:'auto'
        }}>
          {/* Status */}
          <FormControl error={!status}>
            <ToggleButtonGroup
              value={status}
              exclusive
              size="small"
              onChange={(e,val)=>val!==null&&setStatus(val)}
            >
              <ToggleButton value="Active">Active</ToggleButton>
              <ToggleButton value="Cancelled">Cancelled</ToggleButton>
              <ToggleButton value="Training">Training</ToggleButton>
              <ToggleButton value="Unpaid">Unpaid</ToggleButton>
            </ToggleButtonGroup>
            {!status && <FormHelperText>Required</FormHelperText>}
          </FormControl>

          {/* Linked Location */}
          <TextField
            label="Linked Location"
            value={getName(locations.find(l=>getId(l,'Location ID')===locationId)||{},['Location Name'])}
            onClick={()=>setOpenLocationPicker(true)}
            fullWidth required InputProps={{readOnly:true}} disabled={!!planId}
          />

          {/* Linked Plan */}
          <TextField
            label="Linked Plan"
            value={getName(plans.find(p=>getId(p,'Plan ID')===planId)||{},['Plan Name'])}
            onClick={()=>setOpenPlanPicker(true)}
            fullWidth required InputProps={{readOnly:true}}
          />

          {/* RESTORED: Linked Subscriber (Primary Owner) - Single Select */}
          <TextField
            label="Linked Subscriber (Owner)"
            value={getName(subscribers.find(s=>getId(s,'Subscriber ID')===subscriberId)||{},['Display Name'])}
            onClick={() => {
              setPickerMode('single'); // Set mode for the picker
              setOpenSubscriberPicker(true);
            }}
            fullWidth required InputProps={{readOnly:true}}
          />
          
          {/* NEW: Active Subscribers - Multi-select */}
          <TextField
            label="Active Subscribers"
            value={
              subscribers
                .filter(s => activeSubscriberIds.includes(getId(s, 'Subscriber ID')))
                .map(s => getName(s, ['Display Name']))
                .join(', ')
            }
            onClick={() => {
              setPickerMode('multi'); // Set mode for the picker
              setOpenSubscriberPicker(true);
            }}
            fullWidth InputProps={{readOnly:true}}
            multiline
          />

          {/* Linked Benefits */}
          <TextField
            label="Linked Benefits"
            value={filteredBenefits
              .filter(b => entitlementIds.includes(getId(b,'Benefit ID')))
              .map(b => getName(b,['Benefit Name','Display Benefit Name']))
              .join(', ')}
            onClick={()=>setOpenEntitlementPicker(true)}
            fullWidth required disabled={!planId} InputProps={{readOnly:true}}
          />

          {/* Notes */}
          <TextField label="Notes" value={notes} onChange={e=>setNotes(e.target.value)} fullWidth />

          {/* Subscription End Date */}
          <TextField
            label="Subscription End Date"
            type="date"
            value={subscriptionEnd}
            onChange={e=>setSubscriptionEnd(e.target.value)}
            fullWidth required InputLabelProps={{shrink:true}}
          />

          {/* Code */}
          <TextField label="Code" value={code} fullWidth disabled />

          {/* Save */}
          <Box sx={{ display:'flex', justifyContent:'flex-end', mt:2 }}>
            <Button variant="contained" onClick={handleSave}>Save</Button>
          </Box>
        </DialogContent>
      </Dialog>

      {/* — Pickers for Edit — */}

      {/* Location Picker */}
      <Dialog
        fullScreen
        open={openLocationPicker}
        onClose={()=>setOpenLocationPicker(false)}
        PaperProps={{sx:{display:'flex',flexDirection:'column',height:'100vh'}}}
      >
        <AppBar position="sticky" color="default" elevation={1}>
          <Toolbar>
            <IconButton edge="start" onClick={()=>setOpenLocationPicker(false)}><CloseIcon/></IconButton>
            <Typography variant="h6" sx={{ ml:2 }}>Select Location</Typography>
            <Box sx={{ flex:1 }}/>
            <IconButton edge="end" onClick={refetchLocations}><RefreshIcon/></IconButton>
          </Toolbar>
        </AppBar>
        {locationsLoading
          ? <Box sx={{ p:4, textAlign:'center' }}><CircularProgress/></Box>
          : (
            <DialogContent dividers sx={{
              p:0,
              flex:1,
              overflowY:'auto',
              width:'100%',
              maxWidth:600,
              mx:'auto'
            }}>
              <Box sx={{ p:2 }}>
                <TextField
                  label="Filter Locations"
                  placeholder="Type to filter locations"
                  value={locationFilter}
                  onChange={e=>setLocationFilter(e.target.value)}
                  fullWidth
                />
              </Box>
              <List>
                {locations
                  .filter(loc => getName(loc,['Location Name']).toLowerCase().includes(locationFilter.toLowerCase()))
                  .map((loc,idx,arr) => {
                    const msgs = [];
                    if (!loc['Square Location ID']) msgs.push('No Square Location ID');
                    if (!loc['Square Subscription Plan ID']) msgs.push('No Square Subscription Plan ID');
                    return (
                      <React.Fragment key={getId(loc,'Location ID')}>
                        <ListItemButton
                          selected={getId(loc,'Location ID')===locationId}
                          disabled={msgs.length>0}
                          onClick={() => {
                            if (!msgs.length) {
                              setLocationId(getId(loc,'Location ID'));
                              setPlanId('');
                              setEntitlementIds([]);
                              setOpenLocationPicker(false);
                            }
                          }}
                        >
                          <ListItemText
                            primary={getName(loc,['Location Name'])}
                            secondary={msgs.length>0 ? msgs.join(' • ') : getName(loc,['Description'])}
                          />
                        </ListItemButton>
                        {idx< arr.length-1 && <Divider component="li"/>}
                      </React.Fragment>
                    );
                  })}
              </List>
            </DialogContent>
          )
        }
      </Dialog>

      {/* Plan Picker */}
      <Dialog
        fullScreen
        open={openPlanPicker}
        onClose={()=>setOpenPlanPicker(false)}
        PaperProps={{sx:{display:'flex',flexDirection:'column',height:'100vh'}}}
      >
        <AppBar position="sticky" color="default" elevation={1}>
          <Toolbar>
            <IconButton edge="start" onClick={()=>setOpenPlanPicker(false)}><CloseIcon/></IconButton>
            <Typography variant="h6" sx={{ ml:2 }}>Select Plan</Typography>
            <Box sx={{ flex:1 }}/>
            <IconButton edge="end" onClick={refetchPlans}><RefreshIcon/></IconButton>
          </Toolbar>
        </AppBar>
        {plansLoading
          ? <Box sx={{ p:4, textAlign:'center' }}><CircularProgress/></Box>
          : (
            <DialogContent dividers sx={{
              p:0,
              flex:1,
              overflowY:'auto',
              width:'100%',
              maxWidth:600,
              mx:'auto'
            }}>
              <Box sx={{ p:2 }}>
                <TextField
                  label="Filter Plans"
                  placeholder="Type to filter plans"
                  value={planFilter}
                  onChange={e=>setPlanFilter(e.target.value)}
                  fullWidth
                />
              </Box>
              <Box sx={{ flex:1, overflowY:'auto' }}>
                {['Deprecated','Acquisition','Renewal'].map(type => {
                  const items = filteredPlans.filter(pl =>
                    Array.isArray(pl.Type) && pl.Type.includes(type)
                  );
                  if (!items.length) return null;
                  return (
                    <Box key={type} sx={{ mb:2 }}>
                      <Typography variant="subtitle1" sx={{ ml:1 }}>{type}</Typography>
                      <List>
                        {items.map((pl,idx) => (
                          <React.Fragment key={getId(pl,'Plan ID')}>
                            <ListItemButton
                              selected={getId(pl,'Plan ID')===planId}
                              onClick={() => {
                                const pid = getId(pl,'Plan ID');
                                setPlanId(pid);
                                const locs = Array.isArray(pl['Linked: Location ID in Locations'])
                                  ? pl['Linked: Location ID in Locations']
                                  : [];
                                if (locs.length) setLocationId(locs[0]);
                                setEntitlementIds([]);
                                setOpenPlanPicker(false);
                              }}
                            >
                              <ListItemText
                                primary={getName(pl,['Plan Name'])}
                                secondary={(
                                  <>
                                    {getName(pl,['Add On']) && (
                                      <Typography component="div">{getName(pl,['Add On'])}</Typography>
                                    )}
                                    <Typography component="div">{getName(pl,['Description'])}</Typography>
                                  </>
                                )}
                              />
                            </ListItemButton>
                            {idx<items.length-1 && <Divider component="li"/>}
                          </React.Fragment>
                        ))}
                      </List>
                    </Box>
                  );
                })}
              </Box>
            </DialogContent>
          )
        }
      </Dialog>

      {/* MODIFIED: Subscriber Picker now handles both single and multi-select modes */}
      <Dialog
        fullScreen
        open={openSubscriberPicker}
        onClose={()=>setOpenSubscriberPicker(false)}
        PaperProps={{sx:{display:'flex',flexDirection:'column',height:'100vh'}}}
      >
        <AppBar position="sticky" color="default" elevation={1}>
          <Toolbar>
            <IconButton edge="start" onClick={()=>setOpenSubscriberPicker(false)}><CloseIcon/></IconButton>
            <Typography variant="h6" sx={{ ml:2 }}>
              {pickerMode === 'single' ? 'Select Subscriber (Owner)' : 'Select Active Subscribers'}
            </Typography>
            <Box sx={{ flex:1 }}/>
            <IconButton edge="end" onClick={refetchSubscribers}><RefreshIcon/></IconButton>
          </Toolbar>
        </AppBar>
        {subscribersLoading
          ? <Box sx={{ p:4, textAlign:'center' }}><CircularProgress/></Box>
          : (
            <DialogContent dividers sx={{
              p:0,
              flex:1,
              overflowY:'auto',
              width:'100%',
              maxWidth:600,
              mx:'auto'
            }}>
              <Box sx={{ p:2, position: 'sticky', top: 0, zIndex: 1, bgcolor: 'background.paper' }}>
                <TextField
                  label="Filter Subscribers"
                  placeholder="Type to filter subscribers"
                  value={subscriberFilter}
                  onChange={e=>setSubscriberFilter(e.target.value)}
                  fullWidth
                />
              </Box>
              <List>
                {subscribers
                  .filter(sub => {
                    const name  = getName(sub,['Display Name']).toLowerCase();
                    const email = (sub.Email||'').toLowerCase();
                    const phone = formatPhoneNumber(sub.Phone).toLowerCase();
                    const f     = subscriberFilter.toLowerCase();
                    return name.includes(f) || email.includes(f) || phone.includes(f);
                  })
                  .map((sub,idx,arr) => {
                    const subId = getId(sub, 'Subscriber ID');
                    // Determine if selected based on picker mode
                    const isSelected = pickerMode === 'single'
                      ? subId === subscriberId
                      : activeSubscriberIds.includes(subId);

                    return (
                      <React.Fragment key={subId}>
                        <ListItemButton
                          selected={isSelected}
                          onClick={() => {
                            // Logic depends on picker mode
                            if (pickerMode === 'single') {
                              setSubscriberId(subId);
                              setOpenSubscriberPicker(false); // Close after single selection
                            } else {
                              // Toggle selection for multi-mode
                              setActiveSubscriberIds(prev =>
                                isSelected
                                  ? prev.filter(id => id !== subId)
                                  : [...prev, subId]
                              );
                            }
                          }}
                        >
                          {isSelected && <ListItemIcon><CheckIcon /></ListItemIcon>}
                          <ListItemText
                            primary={getName(sub,['Display Name'])}
                            secondary={`${sub.Email} ${formatPhoneNumber(sub.Phone)}`}
                            inset={!isSelected}
                          />
                        </ListItemButton>
                        {idx< arr.length-1 && <Divider component="li"/>}
                      </React.Fragment>
                    );
                  })}
              </List>
            </DialogContent>
          )
        }
      </Dialog>

      {/* Entitlement Picker for Edit */}
      <Dialog
        fullScreen
        open={openEntitlementPicker}
        onClose={()=>setOpenEntitlementPicker(false)}
        PaperProps={{sx:{display:'flex',flexDirection:'column',height:'100vh'}}}
      >
        <AppBar position="sticky" color="default" elevation={1}>
          <Toolbar>
            <IconButton edge="start" onClick={()=>setOpenEntitlementPicker(false)}><CloseIcon/></IconButton>
            <Typography variant="h6" sx={{ ml:2 }}>Select Benefit</Typography>
            <Box sx={{ flex:1 }}/>
            <IconButton edge="end" onClick={refetchBenefits}><RefreshIcon/></IconButton>
          </Toolbar>
        </AppBar>
        {benefitsLoading
          ? <Box sx={{ p:4, textAlign:'center' }}><CircularProgress/></Box>
          : (
            <DialogContent dividers sx={{
              p:0,
              flex:1,
              overflowY:'auto',
              width:'100%',
              maxWidth:600,
              mx:'auto'
            }}>
              <List>
                {filteredBenefits.map((b,idx) => {
                  const bid = getId(b,'Benefit ID');
                  const selected = entitlementIds.includes(bid);
                  return (
                    <React.Fragment key={bid}>
                      <ListItemButton
                        selected={selected}
                        onClick={() => {
                          setEntitlementIds(prev =>
                            prev.includes(bid)
                              ? prev.filter(x=>x!==bid)
                              : [...prev,bid]
                          );
                        }}
                      >
                        {selected && <ListItemIcon><CheckIcon /></ListItemIcon>}
                        <ListItemText
                          primary={getName(b,['Benefit Name','Display Benefit Name'])}
                          secondary={[getName(b,['Status']), getName(b,['Frequency'])].filter(Boolean).join(' • ')}
                          inset={!selected}
                        />
                      </ListItemButton>
                      {idx<filteredBenefits.length-1 && <Divider component="li"/>}
                    </React.Fragment>
                  );
                })}
              </List>
            </DialogContent>
          )
        }
      </Dialog>
    </>
  );
}