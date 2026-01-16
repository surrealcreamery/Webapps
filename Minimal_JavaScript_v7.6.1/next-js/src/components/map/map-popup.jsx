'use client';

import { Popup } from 'react-map-gl/maplibre';

import { styled } from '@mui/material/styles';

// ----------------------------------------------------------------------

export function MapPopup({ sx, children, ...other }) {
  return (
    <MapPopupRoot anchor="bottom" sx={sx} {...other}>
      {children}
    </MapPopupRoot>
  );
}

// ----------------------------------------------------------------------

const MapPopupRoot = styled(Popup)``;
