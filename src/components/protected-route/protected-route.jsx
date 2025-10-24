import React from 'react';
import { useUserPermissions } from '@/contexts/admin/AdminDataContext';
import { getAuth } from 'firebase/auth';
import { Box, CircularProgress, Typography } from '@mui/material';

export default function ProtectedRoute({ permission, children }) {
  // Grab current user email
  const email = getAuth().currentUser?.email;
  // Fetch all permissions for the user from React-Query
  const { data: allPermissions = {}, isLoading } = useUserPermissions(email);

  // Show spinner while loading
  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  // ✨ FIX: Get the specific permissions for this section
  const sectionPermissions = allPermissions[permission] || {};
  // ✨ FIX: Check for either the new `view` permission or the old `access` one
  const hasAccess = sectionPermissions.view === true || sectionPermissions.access === true;

  // If the user does not have access, render the "no-access" message
  if (!hasAccess) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: 'calc(100vh - 64px)', p: 2, mt: '64px' }}>
        <Typography variant="h6" gutterBottom>
          No access to {permission}
        </Typography>
        <Typography>You don’t have permission to view this page.</Typography>
      </Box>
    );
  }

  // ✨ FIX: Pass only the relevant permissions for this specific section down to the page component.
  // This ensures the page (e.g., Subscriptions.jsx) gets the correct { view, edit, delete } props.
  const pagePermissions = { ...sectionPermissions };

  // For backward compatibility, ensure `access` is set if `view` exists.
  if (pagePermissions.view !== undefined) {
    pagePermissions.access = pagePermissions.view;
  }

  return React.cloneElement(children, { fetchedPermissions: pagePermissions });
}
