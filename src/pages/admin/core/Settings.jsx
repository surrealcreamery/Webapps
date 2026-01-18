import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  TextField,
  Button,
  Divider,
  IconButton,
  InputAdornment,
  CircularProgress,
  Snackbar,
  Alert,
  Chip,
  Stack,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Tabs,
  Tab,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import { Icon } from '@iconify/react';
import { getAuth } from 'firebase/auth';
import { ADMIN_API_URL, authFetch } from '@/constants/admin/adminConstants';

const Iconify = ({ icon, width = 20, sx, ...other }) => (
  <Box component={Icon} icon={icon} sx={{ width, height: width, flexShrink: 0, ...sx }} {...other} />
);

// Platform configs
const PLATFORMS = {
  square: { name: 'Square', icon: 'simple-icons:square', color: '#006aff' },
  shopify: { name: 'Shopify', icon: 'simple-icons:shopify', color: '#96bf48' },
  shipday: { name: 'Shipday', icon: 'mdi:truck-delivery', color: '#ff6b00' },
};

// Sidebar sections
const SIDEBAR_SECTIONS = [
  { id: 'api-keys', label: 'API Keys & Tokens', icon: 'solar:key-bold-duotone' },
  { id: 'locations', label: 'Locations', icon: 'solar:map-point-bold-duotone' },
];

// Config sections definition for API Keys
const CONFIG_SECTIONS = [
  {
    id: 'shopify',
    title: 'Shopify',
    icon: 'simple-icons:shopify',
    color: '#96bf48',
    fields: [
      { key: 'SHOPIFY_STORE_DOMAIN', label: 'Store Domain', placeholder: 'your-store.myshopify.com', sensitive: false },
      { key: 'SHOPIFY_ACCESS_TOKEN', label: 'Access Token', placeholder: 'shpat_xxxxx', sensitive: true },
    ],
  },
  {
    id: 'square',
    title: 'Square',
    icon: 'simple-icons:square',
    color: '#006aff',
    fields: [
      { key: 'SQUARE_ACCESS_TOKEN', label: 'Access Token', placeholder: 'EAAAxxxxx', sensitive: true },
    ],
  },
  {
    id: 'websocket',
    title: 'WebSocket',
    icon: 'mdi:broadcast',
    color: '#9c27b0',
    fields: [
      { key: 'WEBSOCKET_ENDPOINT', label: 'WebSocket Endpoint', placeholder: 'wss://xxxxx.execute-api.us-east-1.amazonaws.com/production', sensitive: false },
    ],
  },
];

export default function Settings() {
  const [activeSection, setActiveSection] = useState('api-keys');
  const [config, setConfig] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [showSensitive, setShowSensitive] = useState({});
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  // Locations state
  const [locationsByPlatform, setLocationsByPlatform] = useState({ square: [], shopify: [], shipday: [] });
  const [linkedGroups, setLinkedGroups] = useState([]);
  const [locationsLoading, setLocationsLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [locationTab, setLocationTab] = useState('square');
  const [statusFilter, setStatusFilter] = useState('active');

  // Shipday add form
  const [shipdayName, setShipdayName] = useState('');
  const [shipdayApiKey, setShipdayApiKey] = useState('');
  const [addingShipday, setAddingShipday] = useState(false);

  // Shipday edit
  const [editingShipdaySk, setEditingShipdaySk] = useState(null);
  const [editShipdayApiKey, setEditShipdayApiKey] = useState('');
  const [updatingShipday, setUpdatingShipday] = useState(false);

  // Location secrets edit (for Square/Shopify tokens)
  const [editingSecretsSk, setEditingSecretsSk] = useState(null);
  const [editSecrets, setEditSecrets] = useState({});
  const [updatingSecrets, setUpdatingSecrets] = useState(false);

  // Link modal
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [linkingLocations, setLinkingLocations] = useState([]);
  const [linkPlatformTab, setLinkPlatformTab] = useState('square');
  const [linkingInProgress, setLinkingInProgress] = useState(false);
  const [addingToGroup, setAddingToGroup] = useState(null); // group index when adding to existing group

  // Expanded groups and unlink confirmation
  const [expandedGroups, setExpandedGroups] = useState({});
  const [unlinkConfirm, setUnlinkConfirm] = useState({ open: false, sk1: null, sk2: null, names: '' });
  const [deleteGroupConfirm, setDeleteGroupConfirm] = useState({ open: false, groupIdx: null, locationNames: [] });
  const [deletingGroup, setDeletingGroup] = useState(false);

  // Pending new linked location (created but not yet linked to anything)
  const [pendingNewGroup, setPendingNewGroup] = useState(null);

  // Fetch config on mount
  useEffect(() => {
    fetchConfig();
  }, []);

  // Auto-load locations when navigating to Locations tab
  useEffect(() => {
    if (activeSection === 'locations' && Object.values(locationsByPlatform).every(arr => arr.length === 0) && !locationsLoading) {
      fetchLocations();
    }
  }, [activeSection]);

  const fetchConfig = async () => {
    setLoading(true);
    try {
      const response = await authFetch(ADMIN_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'getConfig' }),
      });
      const data = await response.json();
      if (data.success) {
        setConfig(data.config || {});
      }
    } catch (error) {
      console.error('Failed to fetch config:', error);
      setSnackbar({ open: true, message: 'Failed to load settings', severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (key, value) => {
    setConfig(prev => ({ ...prev, [key]: value }));
    setDirty(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const auth = getAuth();
      const userEmail = auth.currentUser?.email || 'unknown';
      const response = await authFetch(ADMIN_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'updateConfig', config, updatedBy: userEmail }),
      });
      const data = await response.json();
      if (data.success) {
        setDirty(false);
        setSnackbar({ open: true, message: 'Settings saved successfully', severity: 'success' });
      }
    } catch (error) {
      setSnackbar({ open: true, message: 'Failed to save settings', severity: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const toggleShowSensitive = (key) => {
    setShowSensitive(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // Fetch all locations
  const fetchLocations = async () => {
    setLocationsLoading(true);
    try {
      const [locationsRes, linkedRes] = await Promise.all([
        authFetch(ADMIN_API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'getLocations' }),
        }),
        authFetch(ADMIN_API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'getLinkedGroups' }),
        }),
      ]);

      const locationsData = await locationsRes.json();
      const linkedData = await linkedRes.json();

      if (locationsData.success) {
        setLocationsByPlatform(locationsData.byPlatform || { square: [], shopify: [], shipday: [] });
      }
      if (linkedData.success) {
        setLinkedGroups(linkedData.groups || []);
      }
    } catch (error) {
      console.error('Failed to fetch locations:', error);
      setSnackbar({ open: true, message: 'Failed to load locations', severity: 'error' });
    } finally {
      setLocationsLoading(false);
    }
  };

  // Sync locations from Square and Shopify APIs
  const handleSync = async () => {
    setSyncing(true);
    try {
      const response = await authFetch(ADMIN_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'syncLocations' }),
      });
      const data = await response.json();
      if (data.success) {
        const squareCount = data.synced?.square?.count || 0;
        const shopifyCount = data.synced?.shopify?.count || 0;
        setSnackbar({ open: true, message: `Synced ${squareCount} Square and ${shopifyCount} Shopify locations`, severity: 'success' });
        fetchLocations();
      }
    } catch (error) {
      setSnackbar({ open: true, message: 'Failed to sync locations', severity: 'error' });
    } finally {
      setSyncing(false);
    }
  };

  // Add Shipday location
  const handleAddShipday = async () => {
    if (!shipdayName || !shipdayApiKey) return;
    setAddingShipday(true);
    try {
      const auth = getAuth();
      const response = await authFetch(ADMIN_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'addShipdayLocation',
          name: shipdayName,
          apiKey: shipdayApiKey,
          updatedBy: auth.currentUser?.email || 'unknown',
        }),
      });
      const data = await response.json();
      if (data.success) {
        setShipdayName('');
        setShipdayApiKey('');
        setSnackbar({ open: true, message: 'Shipday location added', severity: 'success' });
        fetchLocations();
      }
    } catch (error) {
      setSnackbar({ open: true, message: 'Failed to add Shipday location', severity: 'error' });
    } finally {
      setAddingShipday(false);
    }
  };

  // Update Shipday API key
  const handleUpdateShipdayApiKey = async (sk) => {
    if (!editShipdayApiKey) return;
    setUpdatingShipday(true);
    try {
      const auth = getAuth();
      const response = await authFetch(ADMIN_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'updateShipdayApiKey',
          sk,
          newApiKey: editShipdayApiKey,
          updatedBy: auth.currentUser?.email || 'unknown',
        }),
      });
      const data = await response.json();
      if (data.success) {
        setEditingShipdaySk(null);
        setEditShipdayApiKey('');
        setSnackbar({ open: true, message: 'Shipday API key updated', severity: 'success' });
        fetchLocations();
      } else {
        setSnackbar({ open: true, message: data.error || 'Failed to update API key', severity: 'error' });
      }
    } catch (error) {
      setSnackbar({ open: true, message: 'Failed to update Shipday API key', severity: 'error' });
    } finally {
      setUpdatingShipday(false);
    }
  };

  // Delete location
  const handleDeleteLocation = async (sk) => {
    if (!window.confirm('Are you sure you want to delete this location?')) return;
    try {
      const response = await authFetch(ADMIN_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'deleteLocation', sk }),
      });
      const data = await response.json();
      if (data.success) {
        setSnackbar({ open: true, message: 'Location deleted', severity: 'success' });
        fetchLocations();
      }
    } catch (error) {
      setSnackbar({ open: true, message: 'Failed to delete location', severity: 'error' });
    }
  };

  // Update location secrets (tokens for Square/Shopify)
  const handleUpdateLocationSecrets = async (sk) => {
    if (!editSecrets || Object.keys(editSecrets).length === 0) return;
    setUpdatingSecrets(true);
    try {
      const auth = getAuth();
      const response = await authFetch(ADMIN_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'updateLocationSecrets',
          sk,
          secrets: editSecrets,
          updatedBy: auth.currentUser?.email || 'unknown',
        }),
      });
      const data = await response.json();
      if (data.success) {
        setEditingSecretsSk(null);
        setEditSecrets({});
        setSnackbar({ open: true, message: 'Location credentials updated', severity: 'success' });
        fetchLocations();
      } else {
        setSnackbar({ open: true, message: data.error || 'Failed to update credentials', severity: 'error' });
      }
    } catch (error) {
      setSnackbar({ open: true, message: 'Failed to update credentials', severity: 'error' });
    } finally {
      setUpdatingSecrets(false);
    }
  };

  // Toggle expanded group
  const toggleGroupExpanded = (idx) => {
    setExpandedGroups(prev => ({ ...prev, [idx]: !prev[idx] }));
  };

  // Link modal functions
  const openLinkModal = (groupIdx = null, initialLocation = null) => {
    setLinkingLocations(initialLocation ? [initialLocation] : []);
    setAddingToGroup(groupIdx);
    setLinkPlatformTab('square');
    setLinkModalOpen(true);
  };

  const addToLinking = (location) => {
    // Check if already added
    if (linkingLocations.some(l => l.sk === location.sk)) return;
    setLinkingLocations(prev => [...prev, location]);
  };

  const removeFromLinking = (sk) => {
    setLinkingLocations(prev => prev.filter(l => l.sk !== sk));
  };

  const handleCreateLinks = async () => {
    if (linkingLocations.length < 1) return;

    // Creating new with 1 location - save as pending and close
    if (addingToGroup === null && linkingLocations.length === 1) {
      setPendingNewGroup(linkingLocations[0]);
      setLinkModalOpen(false);
      setLinkingLocations([]);
      setSnackbar({ open: true, message: 'Linked location created. Add more locations to link.', severity: 'success' });
      return;
    }

    setLinkingInProgress(true);
    try {
      if (addingToGroup === 'pending') {
        // Adding to pending new group - link new locations to the pending location
        for (const newLoc of linkingLocations) {
          await authFetch(ADMIN_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'linkLocations',
              sk1: pendingNewGroup.sk,
              sk2: newLoc.sk,
            }),
          });
        }
        setPendingNewGroup(null); // Clear pending after linking
      } else if (addingToGroup !== null && addingToGroup >= 0) {
        // Adding to existing group - link each new location to the first member of existing group
        const existingGroup = linkedGroups[addingToGroup] || [];
        for (const newLoc of linkingLocations) {
          await authFetch(ADMIN_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'linkLocations',
              sk1: existingGroup[0].sk,
              sk2: newLoc.sk,
            }),
          });
        }
      } else {
        // Creating new group with 2+ locations - link each pair
        for (let i = 0; i < linkingLocations.length; i++) {
          for (let j = i + 1; j < linkingLocations.length; j++) {
            await authFetch(ADMIN_API_URL, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action: 'linkLocations',
                sk1: linkingLocations[i].sk,
                sk2: linkingLocations[j].sk,
              }),
            });
          }
        }
      }
      setSnackbar({ open: true, message: 'Locations linked successfully', severity: 'success' });
      setLinkModalOpen(false);
      setLinkingLocations([]);
      setAddingToGroup(null);
      fetchLocations();
    } catch (error) {
      setSnackbar({ open: true, message: 'Failed to link locations', severity: 'error' });
    } finally {
      setLinkingInProgress(false);
    }
  };

  // Unlink - show confirmation
  const handleUnlink = (sk1, sk2, name1, name2) => {
    console.log('handleUnlink called:', { sk1, sk2, name1, name2 });
    setUnlinkConfirm({ open: true, sk1, sk2, names: `${name1} ↔ ${name2}` });
  };

  // Confirm unlink
  const confirmUnlink = async () => {
    const { sk1, sk2 } = unlinkConfirm;
    setUnlinkConfirm({ open: false, sk1: null, sk2: null, names: '' });
    try {
      const response = await authFetch(ADMIN_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'unlinkLocations', sk1, sk2 }),
      });
      const data = await response.json();
      if (data.success) {
        setSnackbar({ open: true, message: 'Locations unlinked', severity: 'success' });
        await fetchLocations();
      } else {
        setSnackbar({ open: true, message: data.error || 'Failed to unlink locations', severity: 'error' });
      }
    } catch (error) {
      setSnackbar({ open: true, message: 'Failed to unlink locations', severity: 'error' });
    }
  };

  // Delete entire linked group - show confirmation
  const handleDeleteGroup = (groupIdx) => {
    const group = linkedGroups[groupIdx];
    if (!group) return;
    setDeleteGroupConfirm({
      open: true,
      groupIdx,
      locationNames: group.map(loc => loc.name),
    });
  };

  // Confirm delete group - unlink all locations from each other
  const confirmDeleteGroup = async () => {
    const { groupIdx } = deleteGroupConfirm;
    const group = linkedGroups[groupIdx];
    if (!group) return;

    setDeleteGroupConfirm({ open: false, groupIdx: null, locationNames: [] });
    setDeletingGroup(true);

    try {
      // Unlink every pair in the group
      for (let i = 0; i < group.length; i++) {
        for (let j = i + 1; j < group.length; j++) {
          await authFetch(ADMIN_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'unlinkLocations',
              sk1: group[i].sk,
              sk2: group[j].sk,
            }),
          });
        }
      }
      setSnackbar({ open: true, message: 'Linked locations deleted', severity: 'success' });
      await fetchLocations();
    } catch (error) {
      setSnackbar({ open: true, message: 'Failed to delete linked locations', severity: 'error' });
    } finally {
      setDeletingGroup(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  // Render API Keys content
  const renderApiKeysContent = () => (
    <Stack spacing={3}>
      {CONFIG_SECTIONS.map((section) => (
        <Card key={section.id} variant="outlined">
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
              <Box sx={{ width: 40, height: 40, borderRadius: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: `${section.color}15` }}>
                <Iconify icon={section.icon} width={24} sx={{ color: section.color }} />
              </Box>
              <Typography variant="h6">{section.title}</Typography>
            </Box>
            <Divider sx={{ mb: 2 }} />
            <Stack spacing={2}>
              {section.fields.map((field) => (
                <TextField
                  key={field.key}
                  label={field.label}
                  placeholder={field.placeholder}
                  value={config[field.key] || ''}
                  onChange={(e) => handleChange(field.key, e.target.value)}
                  type={field.sensitive && !showSensitive[field.key] ? 'password' : 'text'}
                  fullWidth
                  size="small"
                  InputProps={{
                    endAdornment: field.sensitive && (
                      <InputAdornment position="end">
                        <IconButton onClick={() => toggleShowSensitive(field.key)} edge="end" size="small">
                          <Iconify icon={showSensitive[field.key] ? 'solar:eye-bold' : 'solar:eye-closed-bold'} width={18} />
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                />
              ))}
            </Stack>
          </CardContent>
        </Card>
      ))}
      <Button
        variant="contained"
        startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <Iconify icon="solar:disk-bold" />}
        onClick={handleSave}
        disabled={!dirty || saving}
        sx={{ alignSelf: 'flex-start' }}
      >
        {saving ? 'Saving...' : 'Save Changes'}
      </Button>
    </Stack>
  );

  // Render location card
  const renderLocationCard = (location, showDelete = false) => {
    const platform = PLATFORMS[location.platform];
    const hasLinks = location.links && Object.keys(location.links).length > 0;
    const isEditingThis = editingShipdaySk === location.sk;

    return (
      <Card key={location.sk} variant="outlined" sx={{ mb: 1.5 }}>
        <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Box sx={{ width: 32, height: 32, borderRadius: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: `${platform.color}15` }}>
                <Iconify icon={platform.icon} width={18} sx={{ color: platform.color }} />
              </Box>
              <Box>
                <Typography variant="subtitle2" fontWeight="bold">{location.name}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {(location.platformData?.address || location.address) && `${location.platformData?.address || location.address}, `}{location.platformData?.city || location.city}
                </Typography>
              </Box>
            </Box>
            <Stack direction="row" spacing={1} alignItems="center">
              {hasLinks && (
                <Chip label={`${Object.keys(location.links).length} linked`} size="small" color="success" variant="outlined" />
              )}
              {(location.platformData?.status || location.status) === 'ACTIVE' && <Chip label="Active" size="small" color="success" />}
              {(location.platformData?.active ?? location.active) === true && location.platform === 'shopify' && <Chip label="Active" size="small" color="success" />}
              {location.platform === 'shipday' && !isEditingThis && (
                <>
                  <Typography variant="body2" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
                    {location.secrets?.apiKey || location.apiKey}
                  </Typography>
                  <IconButton
                    size="small"
                    onClick={() => {
                      setEditingShipdaySk(location.sk);
                      setEditShipdayApiKey(location.secrets?.apiKey || location.apiKey || '');
                    }}
                  >
                    <Iconify icon="solar:pen-bold" width={16} />
                  </IconButton>
                </>
              )}
              {/* Square/Shopify token status and edit button */}
              {(location.platform === 'square' || location.platform === 'shopify') && editingSecretsSk !== location.sk && (
                <>
                  {location.secrets?.accessToken ? (
                    <Chip label="Token Set" size="small" color="success" variant="outlined" />
                  ) : (
                    <Chip label="No Token" size="small" color="warning" variant="outlined" />
                  )}
                  <IconButton
                    size="small"
                    onClick={() => {
                      setEditingSecretsSk(location.sk);
                      setEditSecrets({
                        accessToken: location.secrets?.accessToken || '',
                        ...(location.platform === 'shopify' ? { storeDomain: location.secrets?.storeDomain || '' } : {}),
                      });
                    }}
                  >
                    <Iconify icon="solar:pen-bold" width={16} />
                  </IconButton>
                </>
              )}
              {showDelete && !isEditingThis && editingSecretsSk !== location.sk && (
                <IconButton size="small" color="error" onClick={() => handleDeleteLocation(location.sk)}>
                  <Iconify icon="solar:trash-bin-trash-bold" width={18} />
                </IconButton>
              )}
            </Stack>
          </Box>
          {/* Shipday API Key Edit Row */}
          {location.platform === 'shipday' && isEditingThis && (
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1.5 }}>
              <TextField
                label="API Key"
                value={editShipdayApiKey}
                onChange={(e) => setEditShipdayApiKey(e.target.value)}
                size="small"
                type={showSensitive[`edit_${location.sk}`] ? 'text' : 'password'}
                sx={{ flex: 1 }}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton onClick={() => toggleShowSensitive(`edit_${location.sk}`)} edge="end" size="small">
                        <Iconify icon={showSensitive[`edit_${location.sk}`] ? 'solar:eye-bold' : 'solar:eye-closed-bold'} width={18} />
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
              <Button
                variant="contained"
                size="small"
                onClick={() => handleUpdateShipdayApiKey(location.sk)}
                disabled={!editShipdayApiKey || updatingShipday}
                startIcon={updatingShipday ? <CircularProgress size={14} color="inherit" /> : <Iconify icon="solar:check-circle-bold" width={16} />}
              >
                Update
              </Button>
              <Button
                variant="outlined"
                size="small"
                onClick={() => {
                  setEditingShipdaySk(null);
                  setEditShipdayApiKey('');
                }}
              >
                Cancel
              </Button>
            </Stack>
          )}
          {/* Square/Shopify Token Edit Row */}
          {(location.platform === 'square' || location.platform === 'shopify') && editingSecretsSk === location.sk && (
            <Stack spacing={1.5} sx={{ mt: 1.5 }}>
              {location.platform === 'shopify' && (
                <TextField
                  label="Store Domain"
                  value={editSecrets.storeDomain || ''}
                  onChange={(e) => setEditSecrets(prev => ({ ...prev, storeDomain: e.target.value }))}
                  size="small"
                  fullWidth
                  placeholder="your-store.myshopify.com"
                />
              )}
              <TextField
                label="Access Token"
                value={editSecrets.accessToken || ''}
                onChange={(e) => setEditSecrets(prev => ({ ...prev, accessToken: e.target.value }))}
                size="small"
                fullWidth
                type={showSensitive[`edit_token_${location.sk}`] ? 'text' : 'password'}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton onClick={() => toggleShowSensitive(`edit_token_${location.sk}`)} edge="end" size="small">
                        <Iconify icon={showSensitive[`edit_token_${location.sk}`] ? 'solar:eye-bold' : 'solar:eye-closed-bold'} width={18} />
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
              <Stack direction="row" spacing={1} justifyContent="flex-end">
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => {
                    setEditingSecretsSk(null);
                    setEditSecrets({});
                  }}
                >
                  Cancel
                </Button>
                <Button
                  variant="contained"
                  size="small"
                  onClick={() => handleUpdateLocationSecrets(location.sk)}
                  disabled={!editSecrets.accessToken || updatingSecrets}
                  startIcon={updatingSecrets ? <CircularProgress size={14} color="inherit" /> : <Iconify icon="solar:check-circle-bold" width={16} />}
                >
                  Update
                </Button>
              </Stack>
            </Stack>
          )}
        </CardContent>
      </Card>
    );
  };

  // Render platform locations tab
  const renderPlatformTab = (platform) => {
    const locations = locationsByPlatform[platform] || [];
    const platformConfig = PLATFORMS[platform];

    // Filter by status for Square and Shopify (check platformData first, then root)
    const isActive = (loc) => {
      if (platform === 'square') return (loc.platformData?.status || loc.status) === 'ACTIVE';
      if (platform === 'shopify') return (loc.platformData?.active ?? loc.active) === true;
      return true; // Shipday doesn't have status
    };

    const activeLocations = locations.filter(isActive);
    const inactiveLocations = locations.filter(loc => !isActive(loc));
    const filteredLocations = platform === 'shipday' ? locations : (statusFilter === 'active' ? activeLocations : inactiveLocations);

    return (
      <Stack spacing={2}>
        {/* Active/Inactive toggle for Square and Shopify */}
        {(platform === 'square' || platform === 'shopify') && locations.length > 0 && (
          <Stack direction="row" spacing={1}>
            <Chip
              label={`Active (${activeLocations.length})`}
              onClick={() => setStatusFilter('active')}
              color={statusFilter === 'active' ? 'success' : 'default'}
              variant={statusFilter === 'active' ? 'filled' : 'outlined'}
              sx={{ fontSize: '1.2rem', px: 1, py: 0.5, height: 'auto', cursor: 'pointer' }}
            />
            <Chip
              label={`Inactive (${inactiveLocations.length})`}
              onClick={() => setStatusFilter('inactive')}
              color={statusFilter === 'inactive' ? 'error' : 'default'}
              variant={statusFilter === 'inactive' ? 'filled' : 'outlined'}
              sx={{ fontSize: '1.2rem', px: 1, py: 0.5, height: 'auto', cursor: 'pointer' }}
            />
          </Stack>
        )}

        {platform === 'shipday' && (
          <Card variant="outlined" sx={{ bgcolor: '#fafafa' }}>
            <CardContent>
              <Typography variant="subtitle2" gutterBottom>Add Shipday Location</Typography>
              <Stack direction="row" spacing={2} alignItems="flex-end">
                <TextField
                  label="Location Name"
                  value={shipdayName}
                  onChange={(e) => setShipdayName(e.target.value)}
                  size="small"
                  sx={{ flex: 1 }}
                />
                <TextField
                  label="API Key"
                  value={shipdayApiKey}
                  onChange={(e) => setShipdayApiKey(e.target.value)}
                  size="small"
                  type={showSensitive.shipdayNew ? 'text' : 'password'}
                  sx={{ flex: 1 }}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton onClick={() => toggleShowSensitive('shipdayNew')} edge="end" size="small">
                          <Iconify icon={showSensitive.shipdayNew ? 'solar:eye-bold' : 'solar:eye-closed-bold'} width={18} />
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                />
                <Button
                  variant="contained"
                  onClick={handleAddShipday}
                  disabled={!shipdayName || !shipdayApiKey || addingShipday}
                  startIcon={addingShipday ? <CircularProgress size={16} color="inherit" /> : <Iconify icon="solar:add-circle-bold" />}
                >
                  Add
                </Button>
              </Stack>
            </CardContent>
          </Card>
        )}

        {filteredLocations.length === 0 ? (
          <Card variant="outlined">
            <CardContent>
              <Typography variant="body2" color="text.secondary" textAlign="center">
                {locations.length === 0
                  ? `No ${platformConfig.name} locations found. ${platform !== 'shipday' ? 'Click "Sync" to fetch from API.' : ''}`
                  : `No ${statusFilter} ${platformConfig.name} locations.`
                }
              </Typography>
            </CardContent>
          </Card>
        ) : (
          filteredLocations.map(loc => renderLocationCard(loc, platform === 'shipday'))
        )}
      </Stack>
    );
  };

  // Render linked groups tab
  const renderLinkedTab = () => (
    <Stack spacing={2}>
      <Button
        variant="contained"
        startIcon={<Iconify icon="solar:link-bold" />}
        onClick={() => openLinkModal()}
        sx={{ alignSelf: 'flex-start' }}
      >
        Create New Linked Location
      </Button>

      {/* Pending new group (1 location, not yet linked) */}
      {pendingNewGroup && (
        <Card variant="outlined" sx={{ borderColor: 'warning.main', borderStyle: 'dashed' }}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              p: 2,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flex: 1 }}>
              <Iconify icon={PLATFORMS[pendingNewGroup.platform].icon} width={16} sx={{ color: PLATFORMS[pendingNewGroup.platform].color }} />
              <Typography variant="subtitle2">{pendingNewGroup.name}</Typography>
            </Box>
            <Chip label="Pending" size="small" color="warning" />
            <Button
              size="small"
              variant="outlined"
              startIcon={<Iconify icon="solar:add-circle-bold" />}
              onClick={() => openLinkModal('pending')}
            >
              Add Location
            </Button>
            <IconButton size="small" onClick={() => setPendingNewGroup(null)}>
              <Iconify icon="solar:close-circle-bold" width={18} />
            </IconButton>
          </Box>
        </Card>
      )}

      {linkedGroups.length === 0 && !pendingNewGroup && (
        <Card variant="outlined">
          <CardContent>
            <Typography variant="body2" color="text.secondary" textAlign="center">
              No linked locations yet. Click "Create New Linked Location" to link locations across platforms.
            </Typography>
          </CardContent>
        </Card>
      )}

      {linkedGroups.map((group, idx) => {
          const isExpanded = expandedGroups[idx];
          return (
            <Card key={idx} variant="outlined">
              {/* Collapsible Header - Horizontal Chain */}
              <Box
                onClick={() => toggleGroupExpanded(idx)}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  p: 2,
                  cursor: 'pointer',
                  '&:hover': { bgcolor: 'action.hover' },
                }}
              >
                <Iconify
                  icon={isExpanded ? 'solar:alt-arrow-down-bold' : 'solar:alt-arrow-right-bold'}
                  width={18}
                  sx={{ color: 'text.secondary' }}
                />
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', flex: 1 }}>
                  {group.map((loc, i) => (
                    <React.Fragment key={loc.sk}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Iconify icon={PLATFORMS[loc.platform].icon} width={16} sx={{ color: PLATFORMS[loc.platform].color }} />
                        <Typography variant="subtitle2">{loc.name}</Typography>
                      </Box>
                      {i < group.length - 1 && (
                        <Iconify icon="solar:link-bold" width={14} sx={{ color: 'success.main', mx: 0.5 }} />
                      )}
                    </React.Fragment>
                  ))}
                </Box>
                <Chip label={`${group.length} locations`} size="small" variant="outlined" />
              </Box>

              {/* Expanded Content */}
              {isExpanded && (
                <CardContent sx={{ pt: 0 }}>
                  <Divider sx={{ mb: 2 }} />
                  {/* Vertical chain */}
                  <Stack spacing={0}>
                    {group.map((loc, i) => {
                      const platform = PLATFORMS[loc.platform];
                      return (
                        <React.Fragment key={loc.sk}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 1.5, px: 2, bgcolor: `${platform.color}08`, borderRadius: 1 }}>
                            <Box sx={{ width: 36, height: 36, borderRadius: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: `${platform.color}15` }}>
                              <Iconify icon={platform.icon} width={20} sx={{ color: platform.color }} />
                            </Box>
                            <Box sx={{ flex: 1 }}>
                              <Typography variant="subtitle2">{loc.name}</Typography>
                              <Typography variant="caption" color="text.secondary">
                                {platform.name} • {loc.platformId}
                              </Typography>
                            </Box>
                            {loc.platform === 'shipday' && (loc.secrets?.apiKey || loc.apiKey) && (
                              <Chip label="API Key Set" size="small" color="success" variant="outlined" />
                            )}
                          </Box>
                          {i < group.length - 1 && (
                            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 0.5 }}>
                              <Box sx={{ width: 2, height: 12, bgcolor: 'divider' }} />
                              <IconButton
                                size="small"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  handleUnlink(loc.sk, group[i + 1].sk, loc.name, group[i + 1].name);
                                }}
                                onMouseDown={(e) => e.stopPropagation()}
                                sx={{ bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', '&:hover': { bgcolor: 'error.lighter', borderColor: 'error.main' } }}
                              >
                                <Iconify icon="solar:link-minimalistic-2-broken" width={14} />
                              </IconButton>
                              <Box sx={{ width: 2, height: 12, bgcolor: 'divider' }} />
                            </Box>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </Stack>

                  {/* Add location row - styled like a location */}
                  {(() => {
                    const existingPlatforms = group.map(loc => loc.platform);
                    const hasAllPlatforms = ['square', 'shopify', 'shipday'].every(p => existingPlatforms.includes(p));
                    if (hasAllPlatforms) return null;
                    return (
                      <>
                        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 0.5 }}>
                          <Box sx={{ width: 2, height: 12, bgcolor: 'divider' }} />
                          <Iconify icon="solar:link-bold" width={14} sx={{ color: 'text.disabled' }} />
                          <Box sx={{ width: 2, height: 12, bgcolor: 'divider' }} />
                        </Box>
                        <Box
                          onClick={(e) => {
                            e.stopPropagation();
                            openLinkModal(idx);
                          }}
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 2,
                            py: 1.5,
                            px: 2,
                            bgcolor: 'action.hover',
                            borderRadius: 1,
                            cursor: 'pointer',
                            border: '1px dashed',
                            borderColor: 'divider',
                            '&:hover': { borderColor: 'primary.main', bgcolor: 'primary.lighter' },
                          }}
                        >
                          <Box sx={{ width: 36, height: 36, borderRadius: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'background.paper', border: '1px dashed', borderColor: 'divider' }}>
                            <Iconify icon="solar:add-circle-bold" width={20} sx={{ color: 'text.secondary' }} />
                          </Box>
                          <Typography variant="subtitle2" color="text.secondary">Add a Linked Location</Typography>
                        </Box>
                      </>
                    );
                  })()}

                  {/* Delete linked locations button */}
                  <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
                    <Button
                      size="small"
                      color="error"
                      startIcon={<Iconify icon="solar:trash-bin-trash-bold" width={16} />}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteGroup(idx);
                      }}
                    >
                      Delete Linked Location{group.length > 1 ? 's' : ''}
                    </Button>
                  </Box>
                </CardContent>
              )}
            </Card>
          );
        })}
    </Stack>
  );

  // Render Locations content
  const renderLocationsContent = () => (
    <Stack spacing={3}>
      {/* Header with sync button */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Stack direction="row" spacing={1}>
          <Chip label={`${locationsByPlatform.square.length} Square`} size="small" sx={{ bgcolor: '#006aff15', color: '#006aff', fontSize: '1.2rem', px: 1, py: 0.5, height: 'auto' }} />
          <Chip label={`${locationsByPlatform.shopify.length} Shopify`} size="small" sx={{ bgcolor: '#96bf4815', color: '#5c8c1a', fontSize: '1.2rem', px: 1, py: 0.5, height: 'auto' }} />
          <Chip label={`${locationsByPlatform.shipday.length} Shipday`} size="small" sx={{ bgcolor: '#ff6b0015', color: '#ff6b00', fontSize: '1.2rem', px: 1, py: 0.5, height: 'auto' }} />
          <Chip label={`${linkedGroups.length} Linked Groups`} size="small" color="success" variant="outlined" sx={{ fontSize: '1.2rem', px: 1, py: 0.5, height: 'auto' }} />
        </Stack>
        <Stack direction="row" spacing={1}>
          <Button
            variant="outlined"
            size="small"
            startIcon={syncing ? <CircularProgress size={16} /> : <Iconify icon="solar:refresh-bold" />}
            onClick={handleSync}
            disabled={syncing}
          >
            {syncing ? 'Syncing...' : 'Sync Square & Shopify'}
          </Button>
        </Stack>
      </Box>

      {/* Platform tabs */}
      <Tabs
        value={locationTab}
        onChange={(e, v) => setLocationTab(v)}
        sx={{ borderBottom: 1, borderColor: 'divider', '& .MuiTab-root': { textTransform: 'none' } }}
      >
        <Tab value="square" label={<Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}><Iconify icon="simple-icons:square" width={16} sx={{ color: '#006aff' }} />Square</Box>} />
        <Tab value="shopify" label={<Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}><Iconify icon="simple-icons:shopify" width={16} sx={{ color: '#96bf48' }} />Shopify</Box>} />
        <Tab value="shipday" label={<Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}><Iconify icon="mdi:truck-delivery" width={16} sx={{ color: '#ff6b00' }} />Shipday</Box>} />
        <Tab value="linked" label={<Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}><Iconify icon="solar:link-bold" width={16} />Linked</Box>} />
      </Tabs>

      {/* Tab content */}
      {locationsLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          {locationTab === 'square' && renderPlatformTab('square')}
          {locationTab === 'shopify' && renderPlatformTab('shopify')}
          {locationTab === 'shipday' && renderPlatformTab('shipday')}
          {locationTab === 'linked' && renderLinkedTab()}
        </>
      )}
    </Stack>
  );

  // Link modal
  const renderLinkModal = () => {
    // Get existing group member sks and platforms if adding to group
    let existingGroupSks = [];
    let existingPlatforms = [];

    if (addingToGroup === 'pending' && pendingNewGroup) {
      existingGroupSks = [pendingNewGroup.sk];
      existingPlatforms = [pendingNewGroup.platform];
    } else if (typeof addingToGroup === 'number' && addingToGroup >= 0 && linkedGroups[addingToGroup]) {
      existingGroupSks = linkedGroups[addingToGroup].map(l => l.sk);
      existingPlatforms = linkedGroups[addingToGroup].map(l => l.platform);
    }

    // Also include platforms from currently selected locations
    const selectedPlatforms = linkingLocations.map(l => l.platform);
    const allUsedPlatforms = [...new Set([...existingPlatforms, ...selectedPlatforms])];

    // Filter out:
    // - Already selected locations
    // - Existing group members
    // - Platforms already used in the group
    // - Locations that already have ANY links (already part of a group)
    const availableLocations = [
      ...locationsByPlatform.square,
      ...locationsByPlatform.shopify,
      ...locationsByPlatform.shipday,
    ].filter(loc => {
      if (linkingLocations.some(l => l.sk === loc.sk)) return false;
      if (existingGroupSks.includes(loc.sk)) return false;
      if (allUsedPlatforms.includes(loc.platform)) return false;
      // Hide locations that already have any links (already in a group)
      if (loc.links && Object.keys(loc.links).length > 0) return false;
      return true;
    });

    // Determine which platform tabs to show (only platforms not already used)
    const availablePlatformTabs = ['square', 'shopify', 'shipday'].filter(p => !allUsedPlatforms.includes(p));

    // Use current tab if available, otherwise first available tab
    const activeTab = availablePlatformTabs.includes(linkPlatformTab) ? linkPlatformTab : availablePlatformTabs[0];
    const filteredLocations = availableLocations.filter(loc => loc.platform === activeTab);

    // Determine modal title
    let modalTitle = 'Create Linked Location';
    if (addingToGroup === 'pending') {
      modalTitle = `Add to ${pendingNewGroup?.name || 'Linked Location'}`;
    } else if (addingToGroup !== null && addingToGroup >= 0) {
      modalTitle = 'Add to Linked Location';
    }

    return (
      <Dialog open={linkModalOpen} onClose={() => { setLinkModalOpen(false); setAddingToGroup(null); setLinkingLocations([]); }} maxWidth="sm" fullWidth>
        <DialogTitle>{modalTitle}</DialogTitle>
        <DialogContent>
          {/* Selected locations */}
          {linkingLocations.length > 0 && (
            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle2" gutterBottom>Selected Locations:</Typography>
              <Stack spacing={1}>
                {linkingLocations.map((loc, i) => {
                  const platform = PLATFORMS[loc.platform];
                  return (
                    <React.Fragment key={loc.sk}>
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 1.5, bgcolor: `${platform.color}08`, borderRadius: 1 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                          <Iconify icon={platform.icon} width={20} sx={{ color: platform.color }} />
                          <Typography variant="body2">{loc.name}</Typography>
                        </Box>
                        <IconButton size="small" onClick={() => removeFromLinking(loc.sk)}>
                          <Iconify icon="solar:close-circle-bold" width={18} />
                        </IconButton>
                      </Box>
                      {i < linkingLocations.length - 1 && (
                        <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                          <Iconify icon="solar:link-bold" width={16} sx={{ color: 'success.main' }} />
                        </Box>
                      )}
                    </React.Fragment>
                  );
                })}
              </Stack>
            </Box>
          )}

          {/* Platform tabs for selection - only show available platforms */}
          {availablePlatformTabs.length > 0 ? (
            <>
              <Typography variant="subtitle2" gutterBottom>Add Location:</Typography>
              <Tabs
                value={activeTab}
                onChange={(e, v) => setLinkPlatformTab(v)}
                sx={{ mb: 2, '& .MuiTab-root': { textTransform: 'none', minWidth: 'auto', px: 2 } }}
              >
                {availablePlatformTabs.includes('square') && <Tab value="square" label="Square" />}
                {availablePlatformTabs.includes('shopify') && <Tab value="shopify" label="Shopify" />}
                {availablePlatformTabs.includes('shipday') && <Tab value="shipday" label="Shipday" />}
              </Tabs>
            </>
          ) : (
            <Typography variant="body2" color="text.secondary" textAlign="center" py={2}>
              All platforms are already linked
            </Typography>
          )}

          {/* Available locations */}
          {availablePlatformTabs.length > 0 && (
            <Box sx={{ maxHeight: 300, overflow: 'auto' }}>
              {filteredLocations.length === 0 ? (
                <Typography variant="body2" color="text.secondary" textAlign="center" py={2}>
                  No available {PLATFORMS[activeTab]?.name || ''} locations
                </Typography>
              ) : (
                <Stack spacing={1}>
                  {filteredLocations.map(loc => {
                    const platform = PLATFORMS[loc.platform];
                    return (
                      <Box
                        key={loc.sk}
                        onClick={() => addToLinking(loc)}
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1.5,
                          p: 1.5,
                          borderRadius: 1,
                          border: '1px solid',
                          borderColor: 'divider',
                          cursor: 'pointer',
                          '&:hover': { bgcolor: 'action.hover' },
                        }}
                      >
                        <Iconify icon={platform.icon} width={18} sx={{ color: platform.color }} />
                        <Box sx={{ flex: 1 }}>
                          <Typography variant="body2">{loc.name}</Typography>
                          <Typography variant="caption" color="text.secondary">{loc.platformData?.city || loc.city}</Typography>
                        </Box>
                        <Iconify icon="solar:add-circle-bold" width={20} sx={{ color: 'primary.main' }} />
                      </Box>
                    );
                  })}
                </Stack>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setLinkModalOpen(false); setAddingToGroup(null); setLinkingLocations([]); }}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleCreateLinks}
            disabled={linkingInProgress || linkingLocations.length < 1}
            startIcon={linkingInProgress ? <CircularProgress size={16} color="inherit" /> : <Iconify icon="solar:link-bold" />}
          >
            {linkingInProgress
              ? 'Linking...'
              : addingToGroup === null
                ? (linkingLocations.length === 1 ? 'Continue' : `Link ${linkingLocations.length} Locations`)
                : `Add ${linkingLocations.length} Location${linkingLocations.length !== 1 ? 's' : ''}`
            }
          </Button>
        </DialogActions>
      </Dialog>
    );
  };

  return (
    <Box sx={{ display: 'flex', flex: 1, minHeight: 0 }}>
      {/* Sidebar */}
      <Box sx={{ width: 250, flexShrink: 0, bgcolor: '#f4f4f4', borderRight: '1px solid #ddd', p: 2 }}>
        <List disablePadding>
          {SIDEBAR_SECTIONS.map((section) => (
            <ListItemButton
              key={section.id}
              selected={activeSection === section.id}
              onClick={() => setActiveSection(section.id)}
              sx={{
                mb: 0.5,
                borderRadius: 1,
                '&.Mui-selected, &.Mui-selected:hover': {
                  bgcolor: 'black',
                  color: 'white',
                  '& .MuiListItemIcon-root': { color: 'white' },
                },
              }}
            >
              <ListItemIcon sx={{ minWidth: 36 }}>
                <Iconify icon={section.icon} width={20} />
              </ListItemIcon>
              <ListItemText primary={section.label} primaryTypographyProps={{ variant: 'body2' }} />
            </ListItemButton>
          ))}
        </List>
      </Box>

      {/* Content */}
      <Box sx={{ flex: 1, p: 3, minHeight: 0, overflow: 'auto' }}>
        <Typography variant="h5" fontWeight="bold" gutterBottom>
          {SIDEBAR_SECTIONS.find(s => s.id === activeSection)?.label}
        </Typography>
        <Divider sx={{ mb: 3 }} />

        {activeSection === 'api-keys' && renderApiKeysContent()}
        {activeSection === 'locations' && renderLocationsContent()}
      </Box>

      {/* Link Modal */}
      {renderLinkModal()}

      {/* Unlink Confirmation Dialog */}
      <Dialog open={unlinkConfirm.open} onClose={() => setUnlinkConfirm({ open: false, sk1: null, sk2: null, names: '' })}>
        <DialogTitle>Unlink Locations?</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to unlink <strong>{unlinkConfirm.names}</strong>?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setUnlinkConfirm({ open: false, sk1: null, sk2: null, names: '' })}>
            Cancel
          </Button>
          <Button variant="contained" color="error" onClick={confirmUnlink}>
            Unlink
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Group Confirmation Dialog */}
      <Dialog open={deleteGroupConfirm.open} onClose={() => setDeleteGroupConfirm({ open: false, groupIdx: null, locationNames: [] })}>
        <DialogTitle>Delete Linked Locations?</DialogTitle>
        <DialogContent>
          <Typography gutterBottom>
            Are you sure you want to delete this linked location group? This will remove all links between:
          </Typography>
          <Box component="ul" sx={{ m: 0, pl: 2 }}>
            {deleteGroupConfirm.locationNames.map((name, i) => (
              <li key={i}><strong>{name}</strong></li>
            ))}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteGroupConfirm({ open: false, groupIdx: null, locationNames: [] })}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={confirmDeleteGroup}
            disabled={deletingGroup}
            startIcon={deletingGroup ? <CircularProgress size={16} color="inherit" /> : null}
          >
            {deletingGroup ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={() => setSnackbar(prev => ({ ...prev, open: false }))} severity={snackbar.severity}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
