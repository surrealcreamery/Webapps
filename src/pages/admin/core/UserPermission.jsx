import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Typography,
  Divider,
  List,
  ListItemButton,
  ListItemText,
  Switch,
  Breadcrumbs,
  Button,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Link as MuiLink,
  CircularProgress,
  Autocomplete,
  TextField,
  Snackbar,
  Alert
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { Link as RouterLink, useParams } from 'react-router-dom';
import { getAuth } from 'firebase/auth';
import { useUserPermissions, useUpdateUserPermissions, useLocations } from '@/contexts/admin/AdminDataContext';

const allLocationsOption = {
  'Location Name': 'All Locations',
  'Location ID': 'ALL_LOCATIONS_IDENTIFIER'
};

const NO_LOCATIONS_SELECTED = 'NO_LOCATIONS_SELECTED_SENTINEL';

export default function UserPermissions() {
  const { email: emailFromParams } = useParams();
  const targetEmail = emailFromParams ? decodeURIComponent(emailFromParams) : null;
  const displayEmail = targetEmail || 'Unknown User';

  const {
    data: fetchedPermissions = {},
    isLoading: permsLoading,
    isError: permsError
  } = useUserPermissions(targetEmail);

  const { data: allLocations = [] } = useLocations();
  const updatePermissions = useUpdateUserPermissions();

  const presetPermissions = {
    Subscriptions:     { view: false, edit: false, delete: false, allLocations: true, allowedLocations: [] },
    Subscribers:       { view: false, edit: false, delete: false },
    Reports:           { view: false, create: false, update: false, allLocations: true, allowedLocations: [] },
    'In-store Orders': { view: false },
    Locations:         { view: false, edit: false, delete: false },
    Training:          { view: false, edit: false, delete: false },
    Recipes:           { view: false, edit: false, delete: false },
    'Device Management': { view: false, edit: false, delete: false },
    Dashboard:         { access: false },
    Campaigns:         { access: false },
    'Theme Editor':    { access: false },
    'Pricing Models':  { access: false },
    Access:            { access: false },
    'User Permissions':{ access: false },
    Plans:             { access: false }
  };
  const sectionKeys = Object.keys(presetPermissions);

  const mergedPermissions = sectionKeys.reduce((acc, key) => {
    const fetched = fetchedPermissions[key] || {};
    const preset = presetPermissions[key];
    const newPerms = {};

    Object.keys(preset).forEach(permKey => {
      newPerms[permKey] = fetched[permKey] !== undefined ? fetched[permKey] : preset[permKey];
    });

    acc[key] = newPerms;
    return acc;
  }, {});


  const [current, setCurrent] = useState(mergedPermissions);
  const [section, setSection] = useState(sectionKeys[0]);
  const [dirty, setDirty] = useState(false);
  const firstLoad = useRef(true);

  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState('success');

  useEffect(() => {
    if (firstLoad.current && !permsLoading) {
      setCurrent(mergedPermissions);
      setDirty(false);
      firstLoad.current = false;
    }
  }, [mergedPermissions, permsLoading]);

  const handlePermissionChange = (sectionKey, permissionKey) => {
    setCurrent(prev => {
      const newSectionState = { ...prev[sectionKey] };
      const currentVal = newSectionState[permissionKey];
      newSectionState[permissionKey] = !currentVal;

      if ((permissionKey === 'view' || permissionKey === 'access') && currentVal === true) {
        if ('edit' in newSectionState) newSectionState.edit = false;
        if ('delete' in newSectionState) newSectionState.delete = false;
        if ('create' in newSectionState) newSectionState.create = false;
        if ('update' in newSectionState) newSectionState.update = false;
      }
      return { ...prev, [sectionKey]: newSectionState };
    });
    setDirty(true);
  };

  const handleLocationsChange = (sectionKey, newValue) => {
    const choseAll = newValue.some(v => v['Location ID'] === allLocationsOption['Location ID']);

    if (choseAll) {
      setCurrent(prev => ({
        ...prev,
        [sectionKey]: { ...prev[sectionKey], allLocations: true, allowedLocations: [] }
      }));
    } else {
      const specificIds = newValue.map(loc => loc['Location ID']);
      setCurrent(prev => ({
        ...prev,
        [sectionKey]: { ...prev[sectionKey], allLocations: false, allowedLocations: specificIds.length > 0 ? specificIds : [NO_LOCATIONS_SELECTED] }
      }));
    }
    setDirty(true);
  };

  const handlePublish = () => {
    const permissionsToPublish = JSON.parse(JSON.stringify(current));
    Object.keys(permissionsToPublish).forEach(sectionKey => {
        if (permissionsToPublish[sectionKey].allowedLocations?.[0] === NO_LOCATIONS_SELECTED) {
            permissionsToPublish[sectionKey].allowedLocations = [];
        }
    });

    updatePermissions.mutate(
      { email: targetEmail, permissions: permissionsToPublish },
      {
        onSuccess: () => { setDirty(false); setSnackbarMessage('Permissions updated successfully!'); setSnackbarSeverity('success'); setSnackbarOpen(true); },
        onError: (error) => { console.error("Failed to update permissions:", error); setSnackbarMessage('Update failed. Please try again.'); setSnackbarSeverity('error'); setSnackbarOpen(true); }
      }
    );
  };

  if (permsLoading) {
    return ( <Box sx={{ width: '100%', height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center' }}><CircularProgress /></Box> );
  }
  if (permsError) {
    return ( <Box sx={{ p: 4 }}><Typography color="error">Error loading permissions. Please try again.</Typography></Box> );
  }

  const locationOptions = [allLocationsOption, ...allLocations];
  const isMobile = window.innerWidth <= 600;

  const renderPermissionSwitches = (key, perm) => {
    const hasCrud = 'create' in perm || 'update' in perm || 'delete' in perm || 'edit' in perm;

    if ('view' in perm) {
      const canDoMore = !!perm.view;
      return (
        <>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <Typography>View</Typography>
            <Switch checked={!!perm.view} onChange={() => handlePermissionChange(key, 'view')} />
          </Box>
          {hasCrud && (
            <>
              {/* ✨ FIX: The label for the 'create' permission is now correctly set to "Add". */}
              {'create' in perm && (
                 <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                    <Typography>Add</Typography>
                    <Switch checked={!!perm.create} onChange={() => handlePermissionChange(key, 'create')} disabled={!canDoMore} />
                 </Box>
              )}
              {'update' in perm && (
                 <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                    <Typography>Update</Typography>
                    <Switch checked={!!perm.update} onChange={() => handlePermissionChange(key, 'update')} disabled={!canDoMore} />
                 </Box>
              )}
               {'edit' in perm && (
                 <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                    <Typography>Edit</Typography>
                    <Switch checked={!!perm.edit} onChange={() => handlePermissionChange(key, 'edit')} disabled={!canDoMore} />
                 </Box>
              )}
              {'delete' in perm && (
                 <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                    <Typography>Delete</Typography>
                    <Switch checked={!!perm.delete} onChange={() => handlePermissionChange(key, 'delete')} disabled={!canDoMore} />
                 </Box>
              )}
            </>
          )}
        </>
      );
    } else {
      return (
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
          <Typography>Access</Typography>
          <Switch checked={!!perm.access} onChange={() => handlePermissionChange(key, 'access')} />
        </Box>
      );
    }
  };

  const getLocationSelectorValue = (perm) => {
    if (perm.allLocations === true) {
      return [allLocationsOption];
    }
    if (perm.allowedLocations && perm.allowedLocations.length > 0 && perm.allowedLocations[0] !== NO_LOCATIONS_SELECTED) {
      return allLocations.filter(loc => perm.allowedLocations.includes(loc['Location ID']));
    }
    return [];
  };
  
  if (isMobile) {
    return (
      <Box sx={{ width: '100%', px: 2, py: 2, mt: '48px' }}>
        <Breadcrumbs sx={{ mb: 2 }} aria-label="breadcrumb"><MuiLink component={RouterLink} to="/admin/access" color="inherit" underline="hover">Access</MuiLink><Typography color="text.primary">{displayEmail}</Typography></Breadcrumbs>
        <Typography variant="h5" gutterBottom>Permissions: {displayEmail}</Typography>
        {sectionKeys.map((key) => {
          const perm = current[key];
          const hasLocationSelector = 'allowedLocations' in perm;

          return (
            <Accordion key={key} sx={{ mb: 2 }}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}><Typography variant="h6">{key}</Typography></AccordionSummary>
              <AccordionDetails>
                {renderPermissionSwitches(key, perm)}
                {hasLocationSelector && (
                  <>
                    <Divider sx={{ my: 2 }} />
                    <Autocomplete
                      multiple
                      options={locationOptions}
                      getOptionLabel={(option) => option['Location Name']}
                      value={getLocationSelectorValue(perm)}
                      onChange={(event, newValue) => { handleLocationsChange(key, newValue); }}
                      renderInput={(params) => ( <TextField {...params} variant="standard" label="Allowed Locations" placeholder="Select" /> )}
                      disabled={!perm.view}
                    />
                  </>
                )}
              </AccordionDetails>
            </Accordion>
          );
        })}
        <Button variant="contained" fullWidth disabled={!dirty || updatePermissions.isPending} onClick={handlePublish}>{updatePermissions.isPending ? <CircularProgress size={24} color="inherit" /> : 'Update All'}</Button>
      </Box>
    );
  }

  // Desktop layout
  const currentSectionPerms = current[section];
  const hasLocationSelector = 'allowedLocations' in currentSectionPerms;

  return (
    <Box sx={{ display: 'flex', width: '100%', height: 'calc(100vh - 48px)', mt: '48px' }}>
      <Box sx={{ width: 250, bgcolor: '#f4f4f4', p: 2, borderRight: '1px solid #ddd', overflowY: 'auto' }}>
        <List>
          {sectionKeys.map((key) => (
            <ListItemButton
              key={key}
              selected={section === key}
              onClick={() => setSection(key)}
              sx={{ mb: 0.5, '&.Mui-selected, &.Mui-selected:hover': { bgcolor: 'black', color: 'white' } }}
            >
              <ListItemText primary={key} />
            </ListItemButton>
          ))}
        </List>
      </Box>
      <Box sx={{ flexGrow: 1, p: 3, overflowY: 'auto' }}>
        <Breadcrumbs sx={{ mb: 2 }}>
            <MuiLink component={RouterLink} to="/admin/access" underline="hover">Access</MuiLink>
            <Typography color="text.primary">{displayEmail}</Typography>
        </Breadcrumbs>
        <Typography variant="h4" gutterBottom>
            {current[section] ? section : 'Select a Section'}
        </Typography>
        <Divider sx={{ mb: 2 }} />

        {current[section] && (
          <>
            {renderPermissionSwitches(section, currentSectionPerms)}
            
            {hasLocationSelector && (
              <>
                <Divider sx={{ my: 2 }} />
                <Autocomplete
                  multiple
                  options={locationOptions}
                  getOptionLabel={(option) => option['Location Name']}
                  value={getLocationSelectorValue(currentSectionPerms)}
                  onChange={(event, newValue) => { handleLocationsChange(section, newValue); }}
                  renderInput={(params) => ( <TextField {...params} variant="outlined" label="Allowed Locations" placeholder="Select locations" /> )}
                  disabled={!currentSectionPerms.view}
                  sx={{ mt: 2 }}
                />
              </>
            )}

            <Button variant="contained" disabled={!dirty || updatePermissions.isPending} onClick={handlePublish} sx={{mt: 4}}>
              {updatePermissions.isPending ? <CircularProgress size={24} color="inherit" /> : 'Update All'}
            </Button>
          </>
        )}
      </Box>
       <Snackbar open={snackbarOpen} autoHideDuration={4000} onClose={() => setSnackbarOpen(false)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert onClose={() => setSnackbarOpen(false)} severity={snackbarSeverity} sx={{ width: '100%' }}>
            {snackbarMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
}