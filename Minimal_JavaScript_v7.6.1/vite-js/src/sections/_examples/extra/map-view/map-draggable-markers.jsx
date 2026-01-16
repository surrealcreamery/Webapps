import { useState, useCallback } from 'react';

import Typography from '@mui/material/Typography';

import { Map, MapMarker, MapControls } from 'src/components/map';

import { ControlPanelRoot } from './styles';

// ----------------------------------------------------------------------

const EVENT_NAMES = ['onDragStart', 'onDrag', 'onDragEnd'];

export function MapDraggableMarkers({ sx, ...other }) {
  const [marker, setMarker] = useState({
    latitude: 40,
    longitude: -100,
  });

  const [events, setEvents] = useState({
    onDragStart: undefined,
    onDrag: undefined,
    onDragEnd: undefined,
  });

  const updateEvent = useCallback((type, lngLat) => {
    setEvents((prev) => ({ ...prev, [type]: lngLat }));
  }, []);

  const handleMarkerDragStart = useCallback(
    (event) => updateEvent('onDragStart', event.lngLat),
    [updateEvent]
  );

  const handleMarkerDrag = useCallback(
    (event) => {
      updateEvent('onDrag', event.lngLat);
      setMarker({ longitude: event.lngLat.lng, latitude: event.lngLat.lat });
    },
    [updateEvent]
  );

  const handleMarkerDragEnd = useCallback(
    (event) => updateEvent('onDragEnd', event.lngLat),
    [updateEvent]
  );

  return (
    <Map initialViewState={{ latitude: 40, longitude: -100, zoom: 3.5 }} sx={sx} {...other}>
      <MapControls />

      <MapMarker
        {...marker}
        draggable
        anchor="bottom"
        onDragStart={handleMarkerDragStart}
        onDrag={handleMarkerDrag}
        onDragEnd={handleMarkerDragEnd}
      />

      <ControlPanel events={events} />
    </Map>
  );
}

// ----------------------------------------------------------------------

function ControlPanel({ events }) {
  return (
    <ControlPanelRoot sx={{ gap: 0.5, display: 'flex', flexDirection: 'column' }}>
      {EVENT_NAMES.map((event) => {
        const lngLat = events[event];

        return (
          <div key={event}>
            <Typography variant="subtitle2" sx={{ color: 'common.white' }}>
              {event}:
            </Typography>

            <Typography
              component={lngLat ? 'span' : 'em'}
              variant={lngLat ? 'subtitle2' : 'body2'}
              sx={{ color: lngLat ? 'primary.main' : 'error.main' }}
            >
              {lngLat ? `${lngLat.lng.toFixed(5)}, ${lngLat.lat.toFixed(5)}` : 'null'}
            </Typography>
          </div>
        );
      })}
    </ControlPanelRoot>
  );
}
