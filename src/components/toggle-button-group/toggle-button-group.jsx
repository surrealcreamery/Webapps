// src/components/TypeToggleGroup.jsx
import React from 'react';
import { ToggleButtonGroup, ToggleButton, Box, Typography } from '@mui/material';

const TypeToggleGroup = ({ value, onChange }) => (
  <Box sx={{ mb: 2 }}>
    <Typography 
      variant="subtitle2" 
      sx={{ 
        fontWeight: 'bold', 
        fontSize: '0.875rem', 
        mb: 1, 
        textTransform: 'uppercase' 
      }}
    >
      Type
    </Typography>
    <ToggleButtonGroup
      value={value}
      exclusive
      onChange={(_, v) => v !== null && onChange(v)}
      aria-label="Pricing Model Type"
      size="small"
    >
      <ToggleButton value="Acquisition" aria-label="Acquisition">
        Acquisition
      </ToggleButton>
      <ToggleButton value="Renewal" aria-label="Renewal">
        Renewal
      </ToggleButton>
      <ToggleButton value="Deprecated" aria-label="Deprecated">
        Deprecated
      </ToggleButton>
    </ToggleButtonGroup>
  </Box>
);

export default TypeToggleGroup;
