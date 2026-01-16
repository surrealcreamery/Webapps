import { Layer, Source } from 'react-map-gl/maplibre';
import { useMemo, useState, useCallback } from 'react';

import { useTheme } from '@mui/material/styles';
import Typography from '@mui/material/Typography';

import { Map, MapPopup, MapControls } from 'src/components/map';

// ----------------------------------------------------------------------

export function MapHighlightByFilter({ sx, ...other }) {
  const theme = useTheme();
  const [hoverLocation, setHoverLocation] = useState(null);

  const handleHoverMap = useCallback((event) => {
    const feature = event.features?.[0];
    const name = feature?.properties?.name;

    if (typeof name === 'string') {
      const countyName = name.split(',')[0].trim();
      setHoverLocation({
        longitude: event.lngLat.lng,
        latitude: event.lngLat.lat,
        countyName,
      });
    } else {
      setHoverLocation(null);
    }
  }, []);

  const selectedCounty = hoverLocation?.countyName;

  const filter = useMemo(() => ['in', selectedCounty || 'N/A', ['get', 'name']], [selectedCounty]);

  return (
    <Map
      minZoom={2}
      onMouseMove={handleHoverMap}
      interactiveLayerIds={['counties']}
      initialViewState={{ latitude: 38.88, longitude: -98, zoom: 3 }}
      sx={sx}
      {...other}
    >
      <MapControls />

      <Source
        id="counties"
        type="geojson"
        data="https://raw.githubusercontent.com/visgl/deck.gl-data/refs/heads/master/examples/arc/counties.json"
      >
        <Layer beforeId="waterway_label" {...baseLayer(theme)} />
        <Layer beforeId="waterway_label" {...highlightLayer(theme)} filter={filter} />
      </Source>

      {hoverLocation && selectedCounty && (
        <MapPopup
          longitude={hoverLocation.longitude}
          latitude={hoverLocation.latitude}
          closeButton={false}
        >
          <Typography variant="body2">{selectedCounty}</Typography>
        </MapPopup>
      )}
    </Map>
  );
}

// ----------------------------------------------------------------------

const baseLayer = (theme) => ({
  id: 'counties',
  type: 'fill',
  source: '',
  paint: {
    'fill-outline-color': theme.palette.grey[900],
    'fill-color': theme.palette.grey[900],
    'fill-opacity': 0.12,
  },
});

const highlightLayer = (theme) => ({
  id: 'counties-highlighted',
  type: 'fill',
  source: 'counties',
  paint: {
    'fill-outline-color': theme.palette.error.main,
    'fill-color': theme.palette.error.main,
    'fill-opacity': 0.48,
  },
});
