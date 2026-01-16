// src/pages/admin/subscription/Locations.jsx

import React, { useState, useCallback, useMemo } from 'react'; // Imported useMemo
import { Box, Paper, Typography, CircularProgress } from '@mui/material';
import AdminDataTable from '@/components/admin-datatable/admin-datatable';
import { useLocations } from '@/contexts/admin/AdminDataContext';

/**
 * Locations page
 * Renders a data table of locations, gated by both page‐level access
 * and component‐level AdminDataTable permission.
 */

// Define constants outside the component so they are stable and don't cause re-renders.
const columns = [
  {
    key: 'Location Name',
    label: 'Location Name',
    sortable: true,
    filter: { type: 'text' },
  },
  {
    key: 'Total Monthly Subscriptions',
    label: 'Monthly Subs',
    sortable: true,
    filter: { type: 'text' },
  },
  {
    key: 'Total Annual Subscriptions',
    label: 'Annual Subs',
    sortable: true,
    filter: { type: 'text' },
  },
];

const searchKeys = ['Location Name'];

export default function Locations({ fetchedPermissions }) {
  const { data: locationsData, isLoading, error } = useLocations();
  const [filters, setFilters] = useState({});

  // ✨ FIX: useMemo is used to create a stable reference for the views and defaultView arrays.
  // This prevents the infinite re-render loop in the AdminDataTable component.
  const views = useMemo(() => [
    {
      name: 'Essentials',
      columns: ['Location Name', 'Total Monthly Subscriptions', 'Total Annual Subscriptions'],
    },
    {
      name: 'Annual Focus',
      columns: ['Location Name', 'Total Annual Subscriptions'],
    },
    {
      name: 'Monthly Focus',
      columns: ['Location Name', 'Total Monthly Subscriptions'],
    },
  ], []);

  const defaultView = useMemo(() => views[0].columns, [views]);

  const handleFilterChange = useCallback((key, value) => {
    setFilters(prev => ({
      ...prev,
      [key]: value,
    }));
  }, []);

  // ─────────────────────────────────────────────────────────────────────────────
  // PAGE-LEVEL ACCESS GATE
  // ─────────────────────────────────────────────────────────────────────────────
  const hasAccess = fetchedPermissions?.Locations?.view || fetchedPermissions?.view;

  if (!hasAccess) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
          bgcolor: 'background.default',
          p: 3,
        }}
      >
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="h6">No access to Locations</Typography>
        </Paper>
      </Box>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Render Logic
  // ─────────────────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography color="error">Failed to load locations: {error.message}</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      {hasAccess && (
        <AdminDataTable
          title="Locations"
          data={locationsData || []}
          columns={columns}
          searchKeys={searchKeys}
          views={views}
          defaultView={defaultView} // Pass the stable defaultView prop
          filters={filters}
          onFilterChange={handleFilterChange}
          renderDetails={row => (
            <>
              <p>
                <strong>Location Name:</strong> {row['Location Name']}
              </p>
              <p>
                <strong>Monthly Subscriptions:</strong> {row['Total Monthly Subscriptions']}
              </p>
              <p>
                <strong>Annual Subscriptions:</strong> {row['Total Annual Subscriptions']}
              </p>
            </>
          )}
        />
      )}
    </Box>
  );
}
