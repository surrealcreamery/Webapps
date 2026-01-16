'use client';

import { Marker } from 'react-map-gl/maplibre';

import { Iconify } from '../iconify';

// ----------------------------------------------------------------------

export function MapMarker({ sx, ...other }) {
  return (
    <Marker {...other}>
      <Iconify
        width={26}
        icon="custom:location-fill"
        sx={[{ color: 'error.main' }, ...(Array.isArray(sx) ? sx : [sx])]}
      />
    </Marker>
  );
}
