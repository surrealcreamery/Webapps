import React from 'react';
import { Box, Typography } from '@mui/material';

export default function ClassicTemplate({ displaySettings, products, soldOut }) {
  const ts = displaySettings.templateSettings || {};
  const cols = displaySettings.columns || 3;
  const gridTopOffset = displaySettings.gridTopOffset || 0; // % from top to push grid down
  const isDark = displaySettings.theme !== 'light';
  const bgColor = ts.backgroundColor || (isDark ? '#111' : '#f5f5f5');
  const textColor = isDark ? '#fff' : '#111';
  const mutedColor = isDark ? '#888' : '#666';
  // Cards always white with dark text
  const cardBg = '#fff';
  const cardTextColor = '#111';
  const cardMutedColor = '#666';
  const resolution = displaySettings.resolution || '1080p';
  const fontScale = resolution === '4K' ? 1.5 : resolution === '720p' ? 0.85 : 1;

  // Auto-calculate rows from product count
  const rows = displaySettings.rows && displaySettings.rows > 0
    ? displaySettings.rows
    : Math.ceil(products.length / cols);

  const visibleProducts = products.slice(0, cols * rows);

  return (
    <Box sx={{
      width: '100%',
      height: '100%',
      bgcolor: bgColor,
      color: textColor,
      p: 3,
      fontFamily: '"Inter", "Helvetica Neue", sans-serif',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      position: 'relative',
    }}>
      {/* Background image */}
      {ts.backgroundImage && (
        <Box
          component="img"
          src={ts.backgroundImage}
          sx={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            pointerEvents: 'none',
            zIndex: 0,
          }}
        />
      )}

      {/* Header (logo + title + subtitle) */}
      {(ts.headerImage || ts.headerText || ts.subtitleText) && (
        <Box sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          mb: 2,
          position: 'relative',
          zIndex: 1,
          flexShrink: 0,
        }}>
          {ts.headerImage && (
            <Box
              component="img"
              src={ts.headerImage}
              alt="Logo"
              sx={{
                maxHeight: `${100 * fontScale}px`,
                maxWidth: '70%',
                objectFit: 'contain',
                mb: (ts.headerText || ts.subtitleText) ? 1 : 0,
              }}
            />
          )}
          {ts.headerText && (
            <Typography component="div" sx={{
              fontWeight: 800,
              fontSize: `${(displaySettings.headerFontSize || 2) * fontScale}rem !important`,
              letterSpacing: 1,
              lineHeight: 1.1,
            }}>
              {ts.headerText}
            </Typography>
          )}
          {ts.subtitleText && (
            <Typography component="div" sx={{
              color: mutedColor,
              fontSize: `${(displaySettings.subtitleFontSize || 1.3) * fontScale}rem !important`,
              fontWeight: 600,
              mt: 0.5,
            }}>
              {ts.subtitleText}
            </Typography>
          )}
        </Box>
      )}

      {/* Product grid */}
      <Box sx={{
        flex: 1,
        display: 'grid',
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
        gap: 2,
        minHeight: 0,
        position: 'relative',
        zIndex: 1,
        ...(gridTopOffset > 0 && { mt: `${gridTopOffset}vh` }),
      }}>
        {visibleProducts.map(product => {
          const defaultVariant = (product.variants || []).find(v => v.isDefault) || product.variants?.[0];
          const isProductSoldOut = (product.variants || []).length > 0 &&
            product.variants.every(v => soldOut[`${product.sku}#${v.sku}`]);
          const showImage = displaySettings.showImages !== false && product.masterImage;

          return (
            <Box
              key={product.sku}
              sx={{
                bgcolor: cardBg,
                borderRadius: 3,
                border: displaySettings.cardOutline !== false ? '3px solid #000' : 'none',
                overflow: 'hidden',
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                minHeight: 0,
                transition: 'opacity 0.3s',
                ...(isProductSoldOut && {
                  filter: 'grayscale(100%)',
                }),
              }}
            >
              {/* Image — fills available space, object-fit keeps full image visible */}
              {showImage && (
                <Box sx={{
                  flex: 1,
                  minHeight: 0,
                  overflow: 'hidden',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  bgcolor: '#fff',
                  p: 1,
                }}>
                  <Box
                    component="img"
                    src={product.masterImage.pwa?.lg || product.masterImage.pwa?.md || product.masterImage.url}
                    alt={product.name}
                    sx={{
                      maxWidth: '100%',
                      maxHeight: '100%',
                      objectFit: 'contain',
                      display: 'block',
                    }}
                  />
                </Box>
              )}

              {/* Bottom label banner: name + price */}
              <Box sx={{
                borderTop: '3px solid #000',
                bgcolor: '#fff',
                px: 1.5,
                py: 1,
                textAlign: 'center',
                flexShrink: 0,
              }}>
                <Typography
                  sx={{
                    color: cardTextColor,
                    fontWeight: 800,
                    fontSize: `${(cols <= 2 ? 1.4 : cols >= 4 ? 0.95 : 1.15) * fontScale}rem`,
                    lineHeight: 1.15,
                  }}
                >
                  {product.name}
                </Typography>
                {displaySettings.showPrices !== false && defaultVariant?.price != null && (
                  <Typography sx={{
                    color: cardMutedColor,
                    fontWeight: 700,
                    fontSize: `${(cols <= 2 ? 1.2 : 1) * fontScale}rem`,
                    mt: 0.25,
                  }}>
                    ${Number(defaultVariant.price) % 1 === 0 ? Number(defaultVariant.price) : Number(defaultVariant.price).toFixed(2)}
                  </Typography>
                )}
              </Box>

              {/* Sold Out badge overlay */}
              {isProductSoldOut && (
                <Box sx={{
                  position: 'absolute',
                  top: 8,
                  right: 8,
                  px: 1.25,
                  py: 0.5,
                  bgcolor: '#c00',
                  color: '#fff',
                  fontWeight: 800,
                  fontSize: `${0.85 * fontScale}rem`,
                  letterSpacing: 1,
                  textTransform: 'uppercase',
                  borderRadius: 0.5,
                  boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
                  zIndex: 2,
                  filter: 'grayscale(0%)',
                }}>
                  Sold Out
                </Box>
              )}
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
