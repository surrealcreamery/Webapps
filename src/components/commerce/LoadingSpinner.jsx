import { Box, CircularProgress } from '@mui/material';

export default function LoadingSpinner({ label = 'Loading', size = 40, ...props }) {
  return (
    <Box role="status" aria-live="polite" display="inline-flex" alignItems="center" {...props}>
      <CircularProgress size={size} aria-label={label} />
    </Box>
  );
}
