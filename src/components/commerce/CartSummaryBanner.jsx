import React from 'react';
import { Box, Button, Typography, IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { LayoutContext } from '@/contexts/commerce/CommerceLayoutContext';
import { useCart } from '@/hooks/useCart';

/**
 * Apple-style cart summary banner
 * Shows at top of homepage after adding item to cart
 * Fixed position in page flow (not floating)
 */
export function CartSummaryBanner({ onClose }) {
  const localCart = useCart();
  const { sendToCommerce } = React.useContext(LayoutContext);

  const lineItems = localCart.cart;
  
  // Get the most recently added item (last in array)
  const latestItem = lineItems[lineItems.length - 1];

  if (!latestItem) return null;

  const handleReviewCart = () => {
    sendToCommerce({ type: 'OPEN_CART' });
  };

  return (
    <Box
      sx={{
        bgcolor: 'white',
        borderBottom: 2,
        borderColor: 'divider',
        mb: 4
      }}
    >
      <Box
        sx={{
          maxWidth: '600px',
          margin: '0 auto',
          px: 3,
          py: 3
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, position: 'relative' }}>
          {/* Close Button - top right */}
          <IconButton
            onClick={() => sendToCommerce({ type: 'CLOSE_CART_BANNER' })}
            sx={{
              position: 'absolute',
              top: -8,
              right: -8,
              color: 'text.secondary'
            }}
          >
            <CloseIcon />
          </IconButton>

          {/* Product Image - Hidden on mobile */}
          <Box
            component="img"
            src={latestItem.image}
            alt={latestItem.name}
            sx={{
              width: 80,
              height: 80,
              objectFit: 'cover',
              borderRadius: 2,
              flexShrink: 0,
              display: { xs: 'none', sm: 'block' }  // Hide on mobile (xs), show on sm and up
            }}
          />

          {/* Product Info */}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="body2" color="success.main" sx={{ fontWeight: 600, mb: 0.5 }}>
              ✓ Added to cart
            </Typography>
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 0.5 }}>
              {latestItem.name}
            </Typography>
            <Typography variant="body1" color="text.secondary">
              {latestItem.variantName && latestItem.variantName !== 'Default Title' && latestItem.variantName}
            </Typography>
          </Box>

          {/* Review Cart Button - to the right */}
          <Button
            variant="contained"
            onClick={handleReviewCart}
            sx={{
              flexShrink: 0,
              whiteSpace: 'nowrap',
              backgroundColor: '#000000',
              color: '#ffffff',
              '&:hover': {
                backgroundColor: '#333333'
              }
            }}
          >
            Review Cart
          </Button>
        </Box>
      </Box>
    </Box>
  );
}
