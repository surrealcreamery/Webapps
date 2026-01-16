import { lazy, Suspense } from 'react';
import { styled } from '@mui/material/styles';
import { Box, CircularProgress } from '@mui/material';

// Lazy load ApexCharts for better performance
const LazyChart = lazy(() => import('react-apexcharts'));

// Loading fallback component
function ChartLoading({ sx }) {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        height: '100%',
        minHeight: 200,
        ...sx,
      }}
    >
      <CircularProgress size={32} />
    </Box>
  );
}

export function Chart({ sx, type, series, className, options = {}, ...other }) {
  return (
    <ChartRoot className={className} sx={sx} {...other}>
      <Suspense fallback={<ChartLoading />}>
        <LazyChart type={type} series={series} options={options} width="100%" height="100%" />
      </Suspense>
    </ChartRoot>
  );
}

const ChartRoot = styled('div')(({ theme }) => ({
  width: '100%',
  flexShrink: 0,
  position: 'relative',
  borderRadius: Number(theme.shape.borderRadius) * 1.5,
}));
