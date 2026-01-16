import { lowerCase, upperFirst } from 'es-toolkit';
import { useMemo, useState, useCallback } from 'react';

import Box from '@mui/material/Box';
import Switch from '@mui/material/Switch';
import Typography from '@mui/material/Typography';
import { inputBaseClasses } from '@mui/material/InputBase';

import { Map, MapControls } from 'src/components/map';
import { NumberInput } from 'src/components/number-input';

import { ControlPanelRoot } from './styles';

// ----------------------------------------------------------------------

export function MapInteraction({ sx, ...other }) {
  const [settings, setSettings] = useState({
    minZoom: 0,
    maxZoom: 20,
    minPitch: 0,
    maxPitch: 85,
    boxZoom: true,
    dragPan: true,
    keyboard: true,
    scrollZoom: true,
    dragRotate: true,
    touchPitch: true,
    doubleClickZoom: true,
    touchZoomRotate: true,
  });

  const handleChangeSetting = useCallback((key, value) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }, []);

  return (
    <Map
      initialViewState={{ latitude: 37.729, longitude: -122.36, zoom: 11, bearing: 0, pitch: 50 }}
      {...settings}
      sx={sx}
      {...other}
    >
      <MapControls />
      <ControlPanel settings={settings} onChange={handleChangeSetting} />
    </Map>
  );
}

// ----------------------------------------------------------------------

function ControlPanel({ settings, onChange }) {
  const limits = useMemo(
    () => ({
      minZoom: [0, settings.maxZoom],
      maxZoom: [settings.minZoom, 20],
      minPitch: [0, settings.maxPitch],
      maxPitch: [settings.minPitch, 85],
    }),
    [settings.minZoom, settings.maxZoom, settings.minPitch, settings.maxPitch]
  );

  return (
    <ControlPanelRoot>
      {Object.entries(settings).map(([key, value]) => {
        const typedKey = key;
        const isNumber = typeof value === 'number';

        return (
          <Box
            key={key}
            sx={{
              display: 'flex',
              alignItems: 'center',
              color: 'common.white',
              '&:not(:last-of-type)': { mb: 0.5 },
            }}
          >
            <Typography variant="body2" sx={{ flexGrow: 1 }}>
              {upperFirst(lowerCase(key))}
            </Typography>

            {isNumber ? (
              <NumberInput
                hideButtons
                value={value}
                max={['minPitch', 'maxPitch'].includes(key) ? 85 : 20}
                onChange={(event, newValue) => {
                  if (typeof newValue === 'number') {
                    const [min, max] = limits[typedKey];
                    const boundedValue = Math.max(min, Math.min(max, newValue));
                    onChange(typedKey, boundedValue);
                  }
                }}
                sx={{ maxWidth: 40 }}
                slotProps={{
                  input: {
                    sx: {
                      [`& .${inputBaseClasses.input}`]: { py: 0, color: 'common.white' },
                    },
                  },
                }}
              />
            ) : (
              <Switch
                size="small"
                checked={value}
                onChange={(event) => onChange(typedKey, event.target.checked)}
                slotProps={{ input: { id: `${key}-switch` } }}
              />
            )}
          </Box>
        );
      })}
    </ControlPanelRoot>
  );
}
