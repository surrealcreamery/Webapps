import { useRef, useState, useCallback } from 'react';

import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import FormControlLabel from '@mui/material/FormControlLabel';

import { Map, MapControls } from 'src/components/map';

import { ControlPanelRoot } from './styles';

// ----------------------------------------------------------------------

export function MapViewportAnimation({ data, sx, ...other }) {
  const mapRef = useRef(null);
  const [selectedCity, setSelectedCity] = useState(data[2].city ?? '');

  const handleChangeLocation = useCallback((event, location) => {
    setSelectedCity(event.target.value);

    const mapEl = mapRef.current;
    if (!mapEl) return;

    const currentCenter = mapEl.getCenter();
    const sameLocation =
      Math.abs(currentCenter.lng - location.longitude) < 0.0001 &&
      Math.abs(currentCenter.lat - location.latitude) < 0.0001;

    if (!sameLocation) {
      mapEl.flyTo({ center: [location.longitude, location.latitude], duration: 2000 });
    }
  }, []);

  return (
    <Map
      ref={mapRef}
      initialViewState={{ latitude: 37.7751, longitude: -122.4193, zoom: 11, bearing: 0, pitch: 0 }}
      sx={sx}
      {...other}
    >
      <MapControls />
      <ControlPanel data={data} selectedCity={selectedCity} onSelectCity={handleChangeLocation} />
    </Map>
  );
}

// ----------------------------------------------------------------------

function ControlPanel({ data, selectedCity, onSelectCity }) {
  return (
    <ControlPanelRoot>
      {data.map((location) => (
        <RadioGroup
          key={location.city}
          value={selectedCity}
          onChange={(event) => onSelectCity(event, location)}
        >
          <FormControlLabel
            value={location.city}
            label={location.city}
            control={<Radio />}
            sx={{ color: 'common.white' }}
          />
        </RadioGroup>
      ))}
    </ControlPanelRoot>
  );
}
