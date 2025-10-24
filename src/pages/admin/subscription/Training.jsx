// src/pages/admin/subscription/Training.jsx
import React from 'react';
import { Box, Paper, Typography } from '@mui/material';

const Training = ({ fetchedPermissions }) => {
  // Page-level access check
  if (!fetchedPermissions?.view) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', bgcolor: 'background.default', p: 3 }}>
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="h6">No access to Training</Typography>
        </Paper>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Training Resources
      </Typography>
      <Paper sx={{ p: 3 }}>
        <Typography variant="body1">
          This is the placeholder page for Training content. You can add training videos, documents, and other resources here.
        </Typography>
      </Paper>
    </Box>
  );
};

export default Training;
