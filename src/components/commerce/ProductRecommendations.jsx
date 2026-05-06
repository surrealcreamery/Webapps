import React, { useEffect } from 'react';
import { Box, Typography } from '@mui/material';
import { trackCrossSellShown, trackCrossSellProductClicked } from '@/services/analytics';

/**
 * Cross-sell / Upsell Recommendations
 * Shows related products below cart summary
 * Apple-style "You might also like" section
 */
export function ProductRecommendations({ products, onProductClick, id }) {
  if (!products || products.length === 0) return null;

  // Limit to 2 products for cross-sell
  const displayProducts = products.slice(0, 2);
  const headingId = id ? `recommendations-heading-${id}` : 'recommendations-heading';

  useEffect(() => {
    if (products?.length > 0) {
      trackCrossSellShown(products.slice(0, 2).map(p => p.id), null);
    }
  }, [products]);

  return (
    <Box
      component="section"
      aria-labelledby={headingId}
      sx={{
        maxWidth: '600px',
        margin: '0 auto',
        px: 3,
        py: 4
      }}
    >
      {/* Section Header */}
      <Typography
        id={headingId}
        variant="h5"
        sx={{
          fontWeight: 700,
          mb: 3,
          textAlign: 'center'
        }}
      >
        All the essentials. And then some.
      </Typography>

      <Typography
        variant="body1"
        sx={{
          textAlign: 'center',
          color: 'text.secondary',
          mb: 4
        }}
      >
        Get even more out of your order.
      </Typography>

      {/* Products Grid - 2 columns matching main grid */}
      <Box 
        sx={{ 
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',  // Always 2 columns
          gap: 3
        }}
      >
        {displayProducts.map((product, index) => (
          <Box
            key={product.id}
            role="button"
            tabIndex={0}
            aria-label={`${product.name}, ${product.price}`}
            onClick={() => { trackCrossSellProductClicked(product.id, index, null); onProductClick(product.id); }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                trackCrossSellProductClicked(product.id, index, null);
                onProductClick(product.id);
              }
            }}
            sx={{
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              transition: 'transform 0.2s',
              '&:hover': {
                transform: 'translateY(-4px)'
              },
              '&:focus-visible': {
                outline: '2px solid #1976d2',
                outlineOffset: '2px'
              }
            }}
          >
            {/* Product Image */}
            <Box
              component="img"
              src={product.imageUrl || '/placeholder.png'}
              alt={product.name}
              sx={{
                width: '100%',
                aspectRatio: '1/1',
                objectFit: 'cover',
                borderRadius: 2,
                mb: 2
              }}
            />

            {/* Product Name */}
            <Typography
              variant="body1"
              sx={{
                fontWeight: 'bold',
                mb: 0.5
              }}
            >
              {product.name}
            </Typography>

            {/* Price */}
            <Typography
              variant="body2"
              color="text.secondary"
            >
              {product.price}
            </Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
}
