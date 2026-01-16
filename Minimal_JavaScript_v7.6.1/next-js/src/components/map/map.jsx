'use client';

import { lazy, Suspense } from 'react';

import NoSsr from '@mui/material/NoSsr';
import Skeleton from '@mui/material/Skeleton';
import { styled } from '@mui/material/styles';

import { MAP_STYLES } from './map-styles';

// ----------------------------------------------------------------------

const LazyMap = lazy(() => import('react-map-gl/maplibre'));

export function Map({ ref, sx, ...other }) {
  const renderFallback = () => (
    <Skeleton
      variant="rectangular"
      sx={{
        top: 0,
        left: 0,
        width: 1,
        height: 1,
        position: 'absolute',
      }}
    />
  );

  return (
    <MapRoot sx={sx}>
      <NoSsr fallback={renderFallback()}>
        <Suspense fallback={renderFallback()}>
          <LazyMap ref={ref} mapStyle={MAP_STYLES.light} {...other} />
        </Suspense>
      </NoSsr>
    </MapRoot>
  );
}

// ----------------------------------------------------------------------

const MapRoot = styled('div')({
  width: '100%',
  overflow: 'hidden',
  position: 'relative',
});
