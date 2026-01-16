import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
  Box,
  CircularProgress,
  Typography,
  Dialog,
  DialogContent,
  Snackbar,
  Alert,
  IconButton,
  AppBar,
  Toolbar,
  Divider,
  Card,
  CardContent,
  CardActions,
  Button,
  Stack,
  ToggleButton,
  ToggleButtonGroup
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import AdminDataTable from '@/components/admin-datatable/admin-datatable';
import { useQueryClient } from '@tanstack/react-query';
import AddSubscriptionDialog, { EditSubscriptionDialog } from '@/components/plan/add-edit-subscription-dialog/add-edit-subscription-dialog';
import {
  useSubscribers,
  useSubscriptions,
  useEntitlements,
  useCreateSubscription,
  useUpdateSubscription,
  useRedeemEntitlement,
  useLocations,
} from '@/contexts/admin/AdminDataContext';

// --- REACT ERROR BOUNDARY ---
class RenderErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error("🔴 ERROR BOUNDARY CAUGHT A CRASH. The data below is the cause:");
    console.log("Problematic Data Object:", this.props.data);
    console.log("React Error:", error);
    console.log("Component Stack:", errorInfo.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <Card sx={{ width: '100%', maxWidth: 600, border: '2px solid', borderColor: 'error.main', mb: 2 }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <ErrorOutlineIcon color="error" />
              <Box>
                <Typography variant="h6" color="error.main">Could not render this item.</Typography>
                <Typography variant="body2">The data for this record is corrupted. Problematic data has been logged to the console.</Typography>
              </Box>
            </Box>
          </CardContent>
        </Card>
      );
    }
    return typeof this.props.children === 'function' ? this.props.children() : this.props.children;
  }
}

const StatusDot = ({ color = 'success.main' }) => (
  <Box sx={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: color, margin: '0 auto' }} />
);

const renderStatusDot = (row) => row.isActive ? <StatusDot color="success.main" /> : <StatusDot color="action.disabled" />;

const VIEW_OPTIONS = [ 
    { id: 'bySubscriber', label: 'By Subscriber' }, 
    { id: 'all', label: 'All Subscriptions' } 
];

const Ribbon = ({ text, color = 'grey.700' }) => (
  <Box sx={{
    position: 'absolute',
    top: '12px',
    right: '-34px',
    transform: 'rotate(45deg)',
    backgroundColor: color,
    color: 'white',
    padding: '3px 0',
    width: '120px',
    textAlign: 'center',
    fontSize: '0.8rem',
    fontWeight: 'bold',
    textTransform: 'uppercase',
    boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
    zIndex: 1
  }}>
    {text}
  </Box>
);

const roleConfig = {
    Single: { text: 'Single', color: 'info.main' },
    Managed: { text: 'Managed', color: 'success.main' },
    Gifted_By_Owner: { text: 'Gifted', color: 'secondary.main' },
    Shared: { text: 'Shared', color: 'warning.main' },
    Gifted_Recipient: { text: 'Gifted', color: 'secondary.main' },
};

function formatSubscriptionDate(dateString) { if (!dateString) return '—'; const date = new Date(dateString.split('T')[0] + 'T00:00:00'); return date.toLocaleDateString(); }
function formatRedeemedTimestamp(iso) { if (!iso) return 'Not yet redeemed'; const d = new Date(iso); return d.toLocaleString('en-US', { month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }); }

export default function Subscriptions({ fetchedPermissions }) {
  const queryClient = useQueryClient();
  const [viewMode, setViewMode] = useState('bySubscriber');
  
  const { data: locations = [], isLoading: isLoadingLocations } = useLocations();
  const { data: subscribers = [], isLoading: subscribersLoading, isError: subscribersError } = useSubscribers();
  const { data: subscriptions = [], isLoading: subscriptionsLoading, isError: subscriptionsError } = useSubscriptions();
  const { data: entitlements = [], isLoading: entitlementsLoading, isError: entitlementsError, isFetching: entitlementsFetching } = useEntitlements();
  
  const createSubscriptionMutation = useCreateSubscription();
  const updateSubscriptionMutation = useUpdateSubscription();
  const redeemMutation = useRedeemEntitlement();

  const subPerms = useMemo(() => fetchedPermissions?.Subscriptions || fetchedPermissions, [fetchedPermissions]);
  const hasViewAccess = useMemo(() => !!subPerms?.view, [subPerms]);

  const [selectedSubscriber, setSelectedSubscriber] = useState(null);
  const [selectedSubscription, setSelectedSubscription] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMsg, setSnackbarMsg] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState('success');
  const [subGroup, setSubGroup] = useState('current');
  const [ownerDetailOpen, setOwnerDetailOpen] = useState(false);
  const [selectedOwner, setSelectedOwner] = useState(null);
  const [redeemingEntitlementId, setRedeemingEntitlementId] = useState(null);
  
  const dialogRef = useRef(null);
  const appBarRef = useRef(null);
  const contentRef = useRef(null);
  
  const now = new Date();

  // --- PERMISSIONS & LOCATION FILTERING LOGIC ---

  const permittedLocations = useMemo(() => {
    if (!subPerms?.view || isLoadingLocations || !locations) return [];
    if (subPerms.allLocations === true) return locations;
    const hasSpecificLocations = Array.isArray(subPerms.allowedLocations) && subPerms.allowedLocations.length > 0;
    if (hasSpecificLocations) {
      const allowedIds = new Set(subPerms.allowedLocations);
      return locations.filter(loc => allowedIds.has(loc['Location ID']));
    }
    return [];
  }, [subPerms, locations, isLoadingLocations]);
  
  const permittedLocationIds = useMemo(() => new Set(permittedLocations.map(loc => loc['Location ID'])), [permittedLocations]);
  
  // THE FIX #1: Make the initial filter state dynamic based on the current view.
  const initialFilterState = useMemo(() => {
      const key = viewMode === 'bySubscriber' ? 'Location Names' : 'Location Name';
      if (!permittedLocations) return { [key]: [] };
      if (permittedLocations.length <= 1) {
          return { [key]: permittedLocations.map(l => l['Location Name']) };
      }
      return { [key]: ['All Locations'] };
  }, [permittedLocations, viewMode]);

  const [filters, setFilters] = useState(initialFilterState);

  useEffect(() => {
      setFilters(initialFilterState);
  }, [initialFilterState]);
  
  const squareIdToAirtableIdMap = useMemo(() => {
      if (!locations) return new Map();
      const map = new Map();
      locations.forEach(loc => {
          if (loc['Square Location ID']) {
            map.set(loc['Square Location ID'], loc['Location ID']);
          }
          if (loc['Surreal Creamery Square Location ID']) {
            map.set(loc['Surreal Creamery Square Location ID'], loc['Location ID']);
          }
      });
      return map;
  }, [locations]);

  const getCleanId = useCallback((value) => {
    let key;
    if (Array.isArray(value)) { key = value[0]; } else { key = value; }
    if (typeof key === 'string') { return key.trim(); }
    return null;
  }, []);

  const permissionFilteredSubscriptions = useMemo(() => {
    if (!subscriptions || !subPerms?.view) return [];
    if (subPerms.allLocations === true) return subscriptions;
    
    return subscriptions.filter(sub => {
        const cleanKey = getCleanId(sub['Square Location ID']);
        if (!cleanKey) return false;

        const internalLocationId = squareIdToAirtableIdMap.get(cleanKey);
        return internalLocationId ? permittedLocationIds.has(internalLocationId) : false;
    });
  }, [subscriptions, subPerms, permittedLocationIds, squareIdToAirtableIdMap, getCleanId]);

  const permittedSubscriberIds = useMemo(() => {
      const idSet = new Set();
      permissionFilteredSubscriptions.forEach(sub => {
          (sub['Linked: Subscriber ID in Subscribers'] || []).forEach(id => idSet.add(id));
          (sub['Linked: Active Subscriber ID in Subscribers'] || []).forEach(id => idSet.add(id));
      });
      return idSet;
  }, [permissionFilteredSubscriptions]);

  const permissionFilteredSubscribers = useMemo(() => {
    if (!subscribers || !subPerms?.view) return [];
    if (subPerms.allLocations === true) return subscribers;
    return subscribers.filter(subscriber => permittedSubscriberIds.has(subscriber['Subscriber ID']));
  }, [subscribers, subPerms, permittedSubscriberIds]);

  // --- END FILTERING LOGIC ---

  const locationNameMap = useMemo(() => new Map(locations.map(l => [l['Location ID'], l['Location Name']])), [locations]);
  
  const tableData = useMemo(() => {
    const subscriptionsWithDetails = permissionFilteredSubscriptions.map(sub => {
      const cleanKey = getCleanId(sub['Square Location ID']);
      const airtableId = squareIdToAirtableIdMap.get(cleanKey);
      const locationName = locationNameMap.get(airtableId);
      return {
        ...sub,
        'Location Name': locationName || 'Unknown',
        isActive: !sub['Subscription End Date'] || new Date(sub['Subscription End Date']) >= now
      };
    });

    const allSubscriptionsBySubscriberId = permissionFilteredSubscribers.reduce((acc, sub) => {
        acc[sub['Subscriber ID']] = subscriptionsWithDetails.filter(s => 
            (s['Linked: Active Subscriber ID in Subscribers'] || []).includes(sub['Subscriber ID']) ||
            (s['Linked: Subscriber ID in Subscribers'] || []).includes(sub['Subscriber ID'])
        );
        return acc;
    }, {});
    
    const enrichedSubscribers = permissionFilteredSubscribers
      .filter(sub => allSubscriptionsBySubscriberId[sub['Subscriber ID']]?.length > 0)
      .map(sub => {
        const associatedSubs = allSubscriptionsBySubscriberId[sub['Subscriber ID']] || [];
        const codes = [...new Set(associatedSubs.map(s => s.Code).filter(Boolean))];
        const hasActiveSubscription = associatedSubs.some(s => s.isActive);
        return { 
          ...sub, 
          'Subscription Codes': codes.join(', '), 
          'isActive': hasActiveSubscription,
          'Location Names': [...new Set(associatedSubs.map(s => s['Location Name']))]
        };
      });

    const filterKey = viewMode === 'bySubscriber' ? 'Location Names' : 'Location Name';
    const selectedLocationNames = filters[filterKey] || [];
    const isAllSelected = selectedLocationNames.includes('All Locations');

    const filteredSubscriptionsList = isAllSelected 
      ? subscriptionsWithDetails
      : subscriptionsWithDetails.filter(s => selectedLocationNames.includes(s['Location Name']));

    const filteredSubscribersList = isAllSelected
      ? enrichedSubscribers
      : enrichedSubscribers.filter(sub => {
          return sub['Location Names'].some(locName => selectedLocationNames.includes(locName));
        });

    return { allSubscriptions: filteredSubscriptionsList, bySubscriber: filteredSubscribersList };
  }, [permissionFilteredSubscriptions, permissionFilteredSubscribers, now, squareIdToAirtableIdMap, locationNameMap, filters, getCleanId, viewMode]);
  
  const subscriberMap = useMemo(() => 
    permissionFilteredSubscribers.reduce((acc, sub) => { acc[sub['Subscriber ID']] = sub; return acc; }, {}), [permissionFilteredSubscribers]
  );
  
  const SUBSCRIBER_COLUMNS = useMemo(() => {
    const locationFilterOptions = permittedLocations.length > 1
      ? ['All Locations', ...permittedLocations.map(l => l['Location Name'])]
      : permittedLocations.map(l => l['Location Name']);
    
    return [
      { key: 'isActive', label: 'Active', sortable: true, width: 80, render: renderStatusDot },
      { key: 'Display Name', label: 'Name', sortable: true },
      { key: 'Email', label: 'Email', sortable: true },
      { key: 'Phone', label: 'Phone', sortable: true },
      { key: 'Subscription Codes', label: 'Codes', sortable: true },
      { key: 'Location Names', label: 'Location', hidden: true, filter: { type: 'checkbox', options: locationFilterOptions } }
    ];
  }, [permittedLocations]);

  const SUBSCRIPTION_COLUMNS = useMemo(() => {
    const locationFilterOptions = permittedLocations.length > 1
      ? ['All Locations', ...permittedLocations.map(l => l['Location Name'])]
      : permittedLocations.map(l => l['Location Name']);

    return [
      { key: 'isActive', label: 'Active', sortable: true, width: 80, render: renderStatusDot },
      { key: 'Code', label: 'Code', sortable: true },
      { key: 'Location Name', label: 'Location', sortable: true, filter: { type: 'checkbox', options: locationFilterOptions } },
      { key: 'Subscription End Date', label: 'Subscription End Date', sortable: true, formatter: formatSubscriptionDate },
      { key: 'Status', label: 'Status', sortable: true },
      { key: 'First Name', label: 'First Name', sortable: true },
      { key: 'Last Name', label: 'Last Name', sortable: true }
    ];
  }, [permittedLocations]);

  const SUBSCRIBER_DEFAULT_VIEW = useMemo(() => SUBSCRIBER_COLUMNS.filter(c => !c.hidden).map(c => c.key), [SUBSCRIBER_COLUMNS]);
  const SUBSCRIPTION_DEFAULT_VIEW = useMemo(() => SUBSCRIPTION_COLUMNS.filter(c => !c.hidden).map(c => c.key), [SUBSCRIPTION_COLUMNS]);
  
  const {
    currentPrimarySubs,
    currentGiftedSubs,
    currentSharedSubs,
    pastPrimarySubs,
    pastGiftedSubs,
    pastSharedSubs
  } = useMemo(() => {
    if (!selectedSubscriber) {
      return { currentPrimarySubs: [], currentGiftedSubs: [], currentSharedSubs: [], pastPrimarySubs: [], pastGiftedSubs: [], pastSharedSubs: [] };
    }

    const subscriberId = selectedSubscriber['Subscriber ID'];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const relevantSubs = {};

    permissionFilteredSubscriptions.forEach(sub => {
      if ((sub['Linked: Subscriber ID in Subscribers'] || []).includes(subscriberId) || (sub['Linked: Active Subscriber ID in Subscribers'] || []).includes(subscriberId)) {
        relevantSubs[sub['Subscription ID']] = { ...sub };
      }
    });

    const finalSubs = Object.values(relevantSubs).map(sub => {
      const isPrimaryOwner = (sub['Linked: Subscriber ID in Subscribers'] || []).includes(subscriberId);
      const ownerIdOnRecord = (sub['Linked: Subscriber ID in Subscribers'] || [])[0];
      
      let activeIds = sub['Linked: Active Subscriber ID in Subscribers'] || [];
      const isCurrent = !sub['Subscription End Date'] || new Date(sub['Subscription End Date']) >= today;
      
      if (isPrimaryOwner && activeIds.length === 0) {
          activeIds = [subscriberId];
      }

      const isSelfActive = activeIds.includes(subscriberId);
      const isOwnerActive = ownerIdOnRecord ? activeIds.includes(ownerIdOnRecord) : false;

      let role = 'Unknown';
      if (isPrimaryOwner) {
          if (isSelfActive) { role = activeIds.length === 1 ? 'Single' : 'Managed'; } else { role = 'Gifted_By_Owner'; }
      } else {
          if (isSelfActive) { if (isOwnerActive) { role = 'Shared'; } else { role = 'Gifted_Recipient'; } }
      }
      
      const userEntitlements = entitlements.filter(ent =>
        (ent['Linked: Subscription ID in Subscriptions'] || []).includes(sub['Subscription ID']) &&
        (ent['Linked: Subscriber ID in Subscribers'] || []).includes(subscriberId)
      );

      const cleanKey = getCleanId(sub['Square Location ID']);
      const airtableId = squareIdToAirtableIdMap.get(cleanKey);
      const locationName = locationNameMap.get(airtableId);

      return {
        ...sub,
        role,
        status: isCurrent ? 'Current' : 'Past',
        entitlements: userEntitlements,
        locationName: locationName || 'Unknown Location',
      };
    }).filter(s => s.role !== 'Unknown');

    return {
      currentPrimarySubs: finalSubs.filter(s => s.status === 'Current' && (s.role === 'Single' || s.role === 'Managed')),
      currentGiftedSubs: finalSubs.filter(s => s.status === 'Current' && s.role === 'Gifted_By_Owner'),
      currentSharedSubs: finalSubs.filter(s => s.status === 'Current' && (s.role === 'Shared' || s.role === 'Gifted_Recipient')),
      pastPrimarySubs: finalSubs.filter(s => s.status === 'Past' && (s.role === 'Single' || s.role === 'Managed')),
      pastGiftedSubs: finalSubs.filter(s => s.status === 'Past' && s.role === 'Gifted_By_Owner'),
      pastSharedSubs: finalSubs.filter(s => s.status === 'Past' && (s.role === 'Shared' || s.role === 'Gifted_Recipient')),
    };
  }, [selectedSubscriber, permissionFilteredSubscriptions, entitlements, getCleanId, squareIdToAirtableIdMap, locationNameMap]);


  const loading = subscribersLoading || subscriptionsLoading || entitlementsLoading || isLoadingLocations;
  const error = subscribersError || subscriptionsError || entitlementsError;
  
  const handleDetailClose = useCallback(() => { setDetailOpen(false); setSelectedSubscriber(null); setSelectedSubscription(null); setSelectedOwner(null); }, []);

  const handleRefresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['admin','subscribers'] });
    queryClient.invalidateQueries({ queryKey: ['admin','subscriptions'] });
    queryClient.invalidateQueries({ queryKey: ['admin','entitlements'] });
    setSnackbarMsg("Data refreshed.");
    setSnackbarSeverity('info');
    setSnackbarOpen(true);
  }, [queryClient]);

  const handleAddSave = useCallback((newSub) => {
    createSubscriptionMutation.mutate(newSub, {
      onSuccess: () => {
        setAddOpen(false);
        setSnackbarMsg('Subscription created successfully!');
        setSnackbarSeverity('success');
        setSnackbarOpen(true);
        queryClient.invalidateQueries({ queryKey: ['admin','subscriptions'] });
      },
      onError: (err) => {
        console.error("Failed to create subscription:", err);
        setSnackbarMsg('Error creating subscription.');
        setSnackbarSeverity('error');
        setSnackbarOpen(true);
      }
    });
  }, [createSubscriptionMutation, queryClient]);
  
  const handleEditSave = useCallback((subData) => {
    updateSubscriptionMutation.mutate(subData, {
      onSuccess: () => {
        setEditOpen(false);
        setSnackbarMsg('Subscription updated successfully!');
        setSnackbarSeverity('success');
        setSnackbarOpen(true);
        queryClient.invalidateQueries({ queryKey: ['admin','subscriptions'] });
        queryClient.invalidateQueries({ queryKey: ['admin','entitlements'] });
      },
      onError: (err) => {
        console.error("Failed to update subscription:", err);
        setSnackbarMsg('Error updating subscription.');
        setSnackbarSeverity('error');
        setSnackbarOpen(true);
      }
    });
  }, [updateSubscriptionMutation, queryClient]);

  const handleRedeem = useCallback(async (entitlementToRedeem) => {
    setRedeemingEntitlementId(entitlementToRedeem['Entitlement ID']);
    try {
      await redeemMutation.mutateAsync(entitlementToRedeem['Entitlement ID']);
      setSnackbarMsg('Entitlement successfully redeemed!');
      setSnackbarSeverity('success');
      setSnackbarOpen(true);
      await queryClient.invalidateQueries({ queryKey: ['admin','entitlements'] });
    } catch (err) {
      console.error("Failed to redeem entitlement:", err);
      setSnackbarMsg('Error redeeming entitlement.');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
    } finally {
      setRedeemingEntitlementId(null);
    }
  }, [redeemMutation, queryClient]);
  
  // THE FIX #2: A complete, correct handler for filter state.
  const handleFilterChange = useCallback((key, value) => {
    const isLocationFilter = key === 'Location Name' || key === 'Location Names';
    if (isLocationFilter) {
      const currentSelection = filters[key] || [];
      const isChecking = value.length > currentSelection.length;
      const changedItem = isChecking ? value.find(item => !currentSelection.includes(item)) : currentSelection.find(item => !value.includes(item));
      
      let newSelection;
      if (changedItem === 'All Locations') {
        newSelection = ['All Locations'];
      } else {
        newSelection = value.filter(item => item !== 'All Locations');
        if (newSelection.length === 0) {
          newSelection = ['All Locations'];
        }
      }
      setFilters({ [key]: newSelection });
    } else {
      setFilters(prev => ({ ...prev, [key]: value }));
    }
  }, [filters]);


  const handleRowClick = useCallback(row => { if (viewMode === 'bySubscriber') { setSelectedSubscriber(row); setSelectedSubscription(null); } else { setSelectedSubscription(row); setSelectedSubscriber(null); } setSubGroup('current'); setDetailOpen(true); }, [viewMode]);
  const handleEditClick = useCallback(sub => { setSelectedSubscription(sub); setEditOpen(true); }, []);
  const handleEditClose = useCallback(() => { setEditOpen(false); setSelectedSubscription(null); }, []);
  const getRowId = useCallback((r) => r?.['Subscription ID'] || r?.['Subscriber ID'], []);
  const handleAddClick = useCallback(() => setAddOpen(true), []);
  const handleViewChange = useCallback(v => {
    // This now correctly triggers the useEffect to reset the filters
    setViewMode(v);
  }, []);

  const handleManagedByClick = useCallback((subscription) => {
    const ownerId = subscription['Linked: Subscriber ID in Subscribers']?.[0];
    if (!ownerId) return;
    const owner = subscriberMap[ownerId];
    if (owner) {
      setSelectedOwner(owner);
      setOwnerDetailOpen(true);
    }
  }, [subscriberMap]);

  const handleOwnerDetailClose = useCallback(() => {
    setOwnerDetailOpen(false);
    handleDetailClose();
  }, [handleDetailClose]);

  const renderSubscriptionCard = (sub) => {    
    return (
      <RenderErrorBoundary key={sub['Subscription ID']} data={sub}>
        {() => {
          const ownerId = (sub['Linked: Subscriber ID in Subscribers'] || [])[0];

          const managedSubscribers = (sub['Linked: Active Subscriber ID in Subscribers'] || [])
              .filter(id => id !== ownerId)
              .map(id => {
                  const name = subscriberMap[id]?.['Display Name'];
                  return typeof name === 'object' ? '[Invalid Name]' : name;
              })
              .filter(Boolean);

          const ribbonInfo = roleConfig[sub.role] || { text: 'N/A', color: 'grey.500'};
          
          const ownerName = subscriberMap[ownerId]?.['Display Name'] || 'Unknown';
          const safeOwnerName = typeof ownerName === 'object' ? '[Data Error]' : ownerName;

          let termDisplay;
          const endDate = sub['Subscription End Date'];
          
          let anchorDay = sub['Monthly Billing Anchor Date'];
          if (Array.isArray(anchorDay)) {
            anchorDay = anchorDay[0];
          }

          if (endDate) {
            const subEnd = new Date(endDate.split('T')[0] + 'T00:00:00');
            termDisplay = (
              <Typography variant="body1">
                <strong>Subscription End Date:</strong> {subEnd.toLocaleDateString()}
              </Typography>
            );
          } else if (anchorDay && typeof anchorDay === 'number' && anchorDay > 0 && anchorDay < 32) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            let nextRenewalDate = new Date(today.getFullYear(), today.getMonth(), anchorDay);

            if (nextRenewalDate < today) {
              nextRenewalDate.setMonth(nextRenewalDate.getMonth() + 1);
            }
            termDisplay = (
              <Typography variant="body1">
                <strong>Monthly Renewal On:</strong> {nextRenewalDate.toLocaleDateString()}
              </Typography>
            );
          } else {
            termDisplay = (
              <Typography variant="body1">
                <strong>Subscription End Date:</strong> —
              </Typography>
            );
          }

          return (
            <Card sx={{ width: '100%', maxWidth: 600, position: 'relative' }}>
                <Ribbon text={ribbonInfo.text} color={ribbonInfo.color} />
                <CardContent sx={{ pt: 4 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Box>
                            <Typography variant="body1"><strong>Code:</strong> {sub.Code}</Typography>
                            <Typography variant="body1"><strong>Status:</strong> {sub.Status}</Typography>
                            <Typography variant="body1"><strong>Location:</strong> {sub.locationName}</Typography>
                            {termDisplay}
                            {managedSubscribers.length > 0 && sub.role !== 'Shared' && sub.role !== 'Gifted_Recipient' && (
                                <Typography variant="body2" sx={{ mt: 1, fontStyle: 'italic' }}>
                                    <strong>Managed Subscribers:</strong> {managedSubscribers.join(', ')}
                                </Typography>
                            )}
                             {(sub.role === 'Shared' || sub.role === 'Gifted_Recipient') && ownerId && (
                               <Typography variant="body2" sx={{ mt: 1, fontStyle: 'italic' }}>
                                    <strong>Plan Owner:</strong> {safeOwnerName}
                                </Typography>
                             )}
                        </Box>
                        <Button variant="text" size="large" sx={{ fontSize: '1.5rem' }} onClick={() => handleEditClick(sub)} disabled={!subPerms?.edit}>Edit Subscription</Button>
                    </Box>
                </CardContent>
                <Divider />
                <Stack>
                    {sub.entitlements && sub.entitlements.length > 0 ? sub.entitlements.map((ent, i) => {
                        const entIsAvailable = ent['Redeem Status'] === 'Available';
                        const canRedeem = !endDate || new Date(endDate) >= now;
                        const isRedeemingThisOne = redeemingEntitlementId === ent['Entitlement ID'];
                        return (
                            <React.Fragment key={ent['Entitlement ID']}>
                                {i > 0 && <Divider />}
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 2 }}>
                                    <Box>
                                        <Typography variant="body1" sx={{ fontSize: '1.5rem' }}>{ent['Display Benefit Name']?.[0] || ent['Benefit Name']?.[0]}</Typography>
                                        <Typography variant="body2" color="text.secondary">{ent['Redeem Status']}</Typography>
                                    </Box>
                                    {entIsAvailable ? (
                                        <Button variant="text" size="large" disabled={!canRedeem || !!redeemingEntitlementId || entitlementsFetching} onClick={() => handleRedeem(ent)} sx={{ fontSize: '1.5rem', minWidth: 120, p: 1, textAlign: 'center' }}>
                                            {isRedeemingThisOne ? <CircularProgress size={24} /> : 'Redeem'}
                                        </Button>
                                    ) : (
                                        <Box sx={{ textAlign: 'right' }}>
                                            <Typography variant="body1" sx={{ fontWeight: 'bold' }}>Redeemed</Typography>
                                            <Typography variant="body2" color="text.secondary">{formatRedeemedTimestamp(ent['Last Redeemed Date'])}</Typography>
                                        </Box>
                                    )}
                                </Box>
                            </React.Fragment>
                        );
                    }) : (<Typography sx={{ p: 2 }}>No entitlements.</Typography>)}
                </Stack>
            </Card>
          );
        }}
      </RenderErrorBoundary>
    );
  };

  if (loading) { return ( <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1 }}><CircularProgress /></Box> ); }
  if (error) { return ( <Box sx={{ p: 4 }}><Typography color="error">Error loading data. Please try again.</Typography></Box> ); }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      {hasViewAccess ? (
        <>
            <Snackbar open={snackbarOpen} autoHideDuration={3000} onClose={() => setSnackbarOpen(false)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}><Alert severity={snackbarSeverity} onClose={() => setSnackbarOpen(false)}>{snackbarMsg}</Alert></Snackbar>
            
            <AdminDataTable 
                title={viewMode === 'all' ? 'All Subscriptions' : 'Subscribers'} 
                data={viewMode === 'all' ? tableData.allSubscriptions : tableData.bySubscriber} 
                columns={viewMode === 'all' ? SUBSCRIPTION_COLUMNS : SUBSCRIBER_COLUMNS} 
                defaultView={viewMode === 'all' ? SUBSCRIPTION_DEFAULT_VIEW : SUBSCRIBER_DEFAULT_VIEW} 
                searchKeys={viewMode === 'all' ? ['Code','Status','First Name','Last Name'] : ['Display Name','Email','Phone','Subscription Codes'] } 
                getRowId={getRowId} 
                onRefresh={handleRefresh} 
                onAddClick={subPerms?.edit ? handleAddClick : undefined} 
                onRowClick={handleRowClick} 
                views={VIEW_OPTIONS} 
                currentView={viewMode} 
                onViewChange={handleViewChange}
                filters={filters}
                onFilterChange={handleFilterChange}
            /> 

            <Dialog
                fullScreen
                open={detailOpen}
                onClose={handleDetailClose}
                PaperProps={{
                ref: dialogRef,
                sx: {
                    display: 'flex',
                    flexDirection: 'column',
                    height: '100vh'
                }
                }}
            >
                <AppBar 
                ref={appBarRef} 
                position="sticky" 
                sx={{ bgcolor: 'grey.200', color: 'black', flexShrink: 0 }}
                elevation={0}
                >
                <Toolbar sx={{ minHeight: 48 }}>
                    <IconButton edge="start" onClick={handleDetailClose}><CloseIcon/></IconButton>
                    <Typography variant="h6" sx={{ ml: 2 }}>
                    {selectedSubscriber ? `Subscriptions for ${selectedSubscriber['Display Name']}` : selectedSubscription ? `Subscription Details` : ''}
                    </Typography>
                </Toolbar>
                </AppBar>
                <DialogContent
                ref={contentRef}
                sx={{
                    flexGrow: 1,
                    overflowY: 'auto',
                    p: 3
                }}
                >
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                    {selectedSubscriber && (<ToggleButtonGroup value={subGroup} exclusive onChange={(_, val) => val && setSubGroup(val)} size="small" sx={{ mb: 2 }}><ToggleButton value="current">Current</ToggleButton><ToggleButton value="past">Past</ToggleButton></ToggleButtonGroup>)}
                    
                    {selectedSubscriber && subGroup === 'current' && (
                        <>
                            {currentPrimarySubs.map(renderSubscriptionCard)}
                            {currentGiftedSubs.length > 0 && <Divider sx={{ width: '100%', maxWidth: 600, my: 2 }}><Typography variant="body1" sx={{ fontWeight: 'bold', color: 'text.secondary' }}>Gifted Subscriptions</Typography></Divider>}
                            {currentGiftedSubs.map(renderSubscriptionCard)}
                            {currentSharedSubs.length > 0 && <Divider sx={{ width: '100%', maxWidth: 600, my: 2 }}><Typography variant="body1" sx={{ fontWeight: 'bold', color: 'text.secondary' }}>Managed Plans</Typography></Divider>}
                            {currentSharedSubs.map(renderSubscriptionCard)}
                            {currentPrimarySubs.length === 0 && currentGiftedSubs.length === 0 && currentSharedSubs.length === 0 && <Typography>No current subscriptions.</Typography>}
                        </>
                    )}

                    {selectedSubscriber && subGroup === 'past' && (
                        <>
                            {pastPrimarySubs.map(renderSubscriptionCard)}
                            {pastGiftedSubs.length > 0 && <Divider sx={{ width: '100%', maxWidth: 600, my: 2 }}><Typography variant="body1" sx={{ fontWeight: 'bold', color: 'text.secondary' }}>Gifted Subscriptions (Past)</Typography></Divider>}
                            {pastGiftedSubs.map(renderSubscriptionCard)}
                            {pastSharedSubs.length > 0 && <Divider sx={{ width: '100%', maxWidth: 600, my: 2 }}><Typography variant="body1" sx={{ fontWeight: 'bold', color: 'text.secondary' }}>Managed Plans (Past)</Typography></Divider>}
                            {pastSharedSubs.map(renderSubscriptionCard)}
                            {pastPrimarySubs.length === 0 && pastGiftedSubs.length === 0 && pastSharedSubs.length === 0 && <Typography>No past subscriptions.</Typography>}
                        </>
                    )}
                    
                    {selectedSubscription && ( <Card key={selectedSubscription['Subscription ID']} sx={{ width:'100%', maxWidth:600 }}> <CardContent><Box sx={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}><Box><Typography variant="body1"><strong>Code:</strong> {selectedSubscription.Code}</Typography><Typography variant="body1"><strong>Status:</strong> {selectedSubscription.Status}</Typography><Typography variant="body1"><strong>Subscription End Date:</strong>{' '}{selectedSubscription['Subscription End Date'] ? new Date(selectedSubscription['Subscription End Date']).toLocaleDateString() : '—'}</Typography></Box><Button variant="text" size="large" sx={{ fontSize:'1.5rem' }} onClick={() => handleEditClick(selectedSubscription)} disabled={!subPerms?.edit}>Edit Subscription</Button></Box></CardContent><Divider/><Stack>{Array.isArray(selectedSubscription['Linked: Entitlement ID in Entitlements']) ? ( selectedSubscription['Linked: Entitlement ID in Entitlements'].map(id => entitlements.find(e => e['Entitlement ID'] === id)).filter(Boolean).map((ent,i)=> { const subEnd = selectedSubscription['Subscription End Date'] ? new Date(selectedSubscription['Subscription End Date']) : null; const subIsFuture = !subEnd || subEnd >= now; const entIsAvailable = ent['Redeem Status'] === 'Available'; const canRedeem = subIsFuture && entIsAvailable; const isRedeemingThisOne = redeemingEntitlementId === ent['Entitlement ID']; return ( <React.Fragment key={ent['Entitlement ID']}>{i > 0 && <Divider/>}<Box sx={{ display:'flex', justifyContent:'space-between', alignItems:'center', p:2 }}><Box><Typography variant="body1" sx={{ fontSize:'1.5rem' }}>{ent['Display Benefit Name']?.[0]||ent['Benefit Name']?.[0]}</Typography><Typography variant="body2" color="text.secondary">{ent['Redeem Status']}</Typography></Box>{entIsAvailable ? ( <Button variant="text" size="large" disabled={!canRedeem || !!redeemingEntitlementId || entitlementsFetching} onClick={() => handleRedeem(ent)} sx={{ fontSize:'1.5rem', minWidth:120, p:1, textAlign: 'center' }}>{isRedeemingThisOne ? <CircularProgress size={24} /> : 'Redeem'}</Button> ) : ( <Box sx={{ textAlign: 'right' }}><Typography variant="body1" sx={{ fontWeight: 'bold' }}>Redeemed</Typography><Typography variant="body2" color="text.secondary">{formatRedeemedTimestamp(ent['Last Redeemed Date'])}</Typography></Box> )}</Box></React.Fragment> ); }) ) : ( <Typography sx={{ p:2 }}>No entitlements.</Typography> )}</Stack></Card> )}
                </Box>
                </DialogContent>
            </Dialog>
            
            <AddSubscriptionDialog open={addOpen} onClose={() => setAddOpen(false)} onSave={handleAddSave} />
            <EditSubscriptionDialog 
                open={editOpen} 
                subscription={selectedSubscription} 
                onClose={handleEditClose} 
                onSave={handleEditSave}
                isSaving={updateSubscriptionMutation.isPending}
            />
        </>
      ) : (
        <Box sx={{ p: 4, textAlign: 'center', mt: 4 }}>
            <Typography variant="h6">Access Denied</Typography>
            <Typography>You do not have permission to view subscriptions. Please contact an administrator.</Typography>
        </Box>
      )}
    </Box>
  );
}