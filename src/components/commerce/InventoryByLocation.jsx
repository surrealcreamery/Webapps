import React from 'react';
import { Box, Typography, Chip } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import WarningIcon from '@mui/icons-material/Warning';

/**
 * Display inventory availability
 * 
 * Note: Shopify Storefront API only provides total inventory across all locations.
 * For location-specific inventory, you'd need to use the Admin API.
 * 
 * @param {Object} product - Product with inventory data
 * @param {boolean} compact - Show compact view (default: false)
 */
export function InventoryByLocation({ product, compact = false }) {
  if (!product?.inventoryTracked) {
    return null;
  }

  const { totalInventory, inStock } = product;

  // Determine status
  let statusColor = 'error';
  let StatusIcon = ErrorIcon;
  let statusText = 'Out of stock';
  
  if (totalInventory > 10) {
    statusColor = 'success';
    StatusIcon = CheckCircleIcon;
    statusText = `${totalInventory} in stock`;
  } else if (totalInventory > 0) {
    statusColor = 'warning';
    StatusIcon = WarningIcon;
    statusText = `Only ${totalInventory} left`;
  }

  // Compact view - just show status chip
  if (compact) {
    return (
      <Box sx={{ mt: 1 }}>
        <Chip
          icon={<StatusIcon />}
          label={statusText}
          color={statusColor}
          size="small"
        />
      </Box>
    );
  }

  // Full view - show availability box
  return (
    <Box sx={{ mt: 2 }}>
      <Typography 
        variant="subtitle2" 
        sx={{ 
          mb: 1.5, 
          fontWeight: 600
        }}
      >
        Availability
      </Typography>

      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          p: 2,
          borderRadius: 2,
          bgcolor: inStock ? 'success.50' : 'grey.50',
          border: 1,
          borderColor: inStock ? 'success.light' : 'grey.300'
        }}
      >
        <Box>
          <Typography variant="body1" sx={{ fontWeight: 600 }}>
            {inStock ? 'In Stock' : 'Low Stock'}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {inStock 
              ? 'Available across all store locations' 
              : 'Limited availability - order now to reserve'}
          </Typography>
        </Box>

        <Chip
          icon={<StatusIcon />}
          label={statusText}
          color={statusColor}
          sx={{ fontWeight: 500 }}
        />
      </Box>
      
      {!inStock && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1, fontStyle: 'italic' }}>
          Note: You can still order - we'll confirm availability after checkout
        </Typography>
      )}
    </Box>
  );
}

export default InventoryByLocation;
