// src/pages/admin/subscription/ThemeEditor.jsx
import React, { useState } from 'react';
import {
  Box,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Typography,
  TextField,
  Button,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { createTheme } from '@mui/material/styles';

const defaultTheme = createTheme();

const ThemeEditor = () => {
  const [themeValues, setThemeValues] = useState(defaultTheme);

  // helper to update nested value
  const updatePath = (path, value) => {
    setThemeValues(prev => {
      const next = { ...prev };
      let o = next;
      path.forEach((key, i) => {
        if (i === path.length - 1) o[key] = value;
        else o = o[key] = { ...o[key] };
      });
      return next;
    });
  };

  const sections = [
    { key: 'breakpoints', label: 'Breakpoints' },
    { key: 'direction',   label: 'Direction' },
    { key: 'palette',     label: 'Palette' },
    { key: 'spacing',     label: 'Spacing' },
    { key: 'shape',       label: 'Shape' },
    { key: 'typography',  label: 'Typography' },
    { key: 'zIndex',      label: 'Z‑Index' },
    { key: 'shadows',     label: 'Shadows' },
    { key: 'components',  label: 'Components' },
    { key: 'transitions', label: 'Transitions' },
  ];

  return (
    <Box sx={{ p: 4 }}>
      <Typography variant="h4" gutterBottom>
        Theme Editor
      </Typography>

      {sections.map(({ key, label }) => (
        <Accordion key={key} defaultExpanded={false} sx={{ mb: 2 }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="h6">{label}</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Box
              component="pre"
              sx={{
                bgcolor: '#f5f5f5',
                p: 2,
                borderRadius: 1,
                fontSize: '0.875rem',
                overflowX: 'auto',
              }}
            >
              {/* Display the raw JSON for this section */}
              {JSON.stringify(themeValues[key], null, 2)}
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              You could replace the above JSON block with a dynamic form that
              calls <code>updatePath</code> for the individual fields under <strong>{key}</strong>.
            </Typography>
          </AccordionDetails>
        </Accordion>
      ))}

      <Button
        variant="contained"
        onClick={() => {
          console.log('New theme configuration:', themeValues);
          alert('Check the console for your updated theme object');
        }}
      >
        Save Theme
      </Button>
    </Box>
  );
};

export default ThemeEditor;
