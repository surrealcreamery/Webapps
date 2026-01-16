import { useMemo, useState, useCallback } from 'react';

import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';

import { Map, MAP_STYLES } from 'src/components/map';

import { ControlPanelRoot } from './styles';

// ----------------------------------------------------------------------

const leftMapStyle = {
  width: '50%',
  height: '100%',
  position: 'absolute',
};

const rightMapStyle = {
  left: '50%',
  width: '50%',
  height: '100%',
  position: 'absolute',
};

// ----------------------------------------------------------------------

export function MapSideBySide({ sx, ...other }) {
  const [viewState, setViewState] = useState({
    longitude: -122.43,
    latitude: 37.78,
    zoom: 12,
    pitch: 30,
  });

  const [mode, setMode] = useState('side-by-side');

  const handleMove = useCallback((event) => setViewState(event.viewState), []);

  const width = typeof window === 'undefined' ? 100 : window.innerWidth;

  const leftMapPadding = useMemo(
    () => ({ left: mode === 'split-screen' ? width / 2 : 0, top: 0, right: 0, bottom: 0 }),
    [width, mode]
  );

  const rightMapPadding = useMemo(
    () => ({ right: mode === 'split-screen' ? width / 2 : 0, top: 0, left: 0, bottom: 0 }),
    [width, mode]
  );

  const handleChangeMode = useCallback((event, newMode) => {
    if (newMode !== null) {
      setMode(newMode);
    }
  }, []);

  return (
    <div style={{ position: 'relative' }}>
      <Map
        id="left-map"
        {...viewState}
        padding={leftMapPadding}
        onMove={handleMove}
        style={leftMapStyle}
        mapStyle={MAP_STYLES.light}
        sx={sx}
        {...other}
      />

      <Map
        id="right-map"
        {...viewState}
        padding={rightMapPadding}
        onMove={handleMove}
        style={rightMapStyle}
        mapStyle={MAP_STYLES.dark}
        sx={{
          top: 0,
          position: 'absolute',
          ...sx,
        }}
        {...other}
      />

      <ControlPanel mode={mode} onModeChange={handleChangeMode} />
    </div>
  );
}

// ----------------------------------------------------------------------

function ControlPanel({ mode, onModeChange }) {
  return (
    <ControlPanelRoot sx={{ p: 0, bgcolor: 'common.white' }}>
      <ToggleButtonGroup color="primary" value={mode} exclusive onChange={onModeChange}>
        <ToggleButton value="side-by-side">Side by side</ToggleButton>
        <ToggleButton value="split-screen">Split screen</ToggleButton>
      </ToggleButtonGroup>
    </ControlPanelRoot>
  );
}
