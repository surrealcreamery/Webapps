import React from 'react';
import { Box, Typography } from '@mui/material';

/**
 * Cross-sell / Upsell Recommendations
 * Shows related products below cart summary
 * Apple-style "You might also like" section
 */
export function ProductRecommendations({ products, onProductClick }) {
  if (!products || products.length === 0) return null;

  // Limit to 2 products for cross-sell
  const displayProducts = products.slice(0, 2);

  return (
    <Box
      sx={{
        maxWidth: '600px',
        margin: '0 auto',
        px: 3,
        py: 4
      }}
    >
      {/* Section Header */}
      <Typography
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
        {displayProducts.map((product) => (
          <Box
            key={product.id}
            onClick={() => onProductClick(product.id)}
            sx={{
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              transition: 'transform 0.2s',
              '&:hover': {
                transform: 'translateY(-4px)'
              }
            }}
          >
            {/* Product Image */}
            <Box
              component="img"
              src={product.imageUrl}
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
