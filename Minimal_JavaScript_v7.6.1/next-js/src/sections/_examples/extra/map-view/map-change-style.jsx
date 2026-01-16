import { lowerCase, upperFirst } from 'es-toolkit';
import { useMemo, useState, useCallback } from 'react';

import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import FormControlLabel from '@mui/material/FormControlLabel';

import { Map, MAP_STYLES, MapControls } from 'src/components/map';

import { ControlPanelRoot } from './styles';

// ----------------------------------------------------------------------

export function MapChangeStyle({ sx, ...other }) {
  const [selectedStyle, setSelectedStyle] = useState('light');

  const handleChangeStyle = useCallback((event) => {
    setSelectedStyle(event.target.value);
  }, []);

  const styleOptions = useMemo(() => Object.keys(MAP_STYLES), []);

  return (
    <Map
      mapStyle={MAP_STYLES[selectedStyle]}
      initialViewState={{ latitude: 37.785164, longitude: -100, zoom: 3.5, bearing: 0, pitch: 0 }}
      sx={sx}
      {...other}
    >
      <MapControls />
      <ControlPanel
        value={selectedStyle}
        onChange={handleChangeStyle}
        styleOptions={styleOptions}
      />
    </Map>
  );
}

// ----------------------------------------------------------------------

function ControlPanel({ styleOptions, value, onChange }) {
  return (
    <ControlPanelRoot>
      <RadioGroup value={value} onChange={onChange}>
        {styleOptions.map((item) => (
          <FormControlLabel
            key={item}
            value={item}
            label={upperFirst(lowerCase(item))}
            control={<Radio size="small" />}
            sx={{ color: 'common.white' }}
          />
        ))}
      </RadioGroup>
    </ControlPanelRoot>
  );
}
