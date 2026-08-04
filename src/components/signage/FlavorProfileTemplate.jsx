import React from 'react';
import { Box, Typography } from '@mui/material';

export default function FlavorProfileTemplate({ displaySettings, products, soldOut }) {
  const ts = displaySettings.templateSettings || {};
  const flavorColumns = ts.flavorColumns || [];
  const resolution = displaySettings.resolution || '1080p';
  const fontScale = resolution === '4K' ? 1.5 : resolution === '720p' ? 0.85 : 1;
  const pageBg = ts.pageBgColor || '#f0e8dc';

  // Group products by flavorColumn index
  const grouped = {};
  products.forEach(p => {
    const col = p.flavorColumn || 0;
    if (!grouped[col]) grouped[col] = [];
    grouped[col].push(p);
  });

  const columns = flavorColumns.length > 0
    ? flavorColumns
    : [{ name: 'Menu', color: '#f5f5f5' }];

  return (
    <Box sx={{
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      bgcolor: pageBg,
      overflow: 'hidden',
      fontFamily: '"Inter", "Helvetica Neue", sans-serif',
    }}>
      {/* Header — ~10% height, flavor names on page bg */}
      <Box sx={{
        display: 'flex',
        flexDirection: 'row',
        flexShrink: 0,
        height: '10%',
        alignItems: 'center',
        gap: '2.5%',
        px: '2.5%',
      }}>
        {columns.map((col, colIdx) => (
          <Box key={colIdx} sx={{ flex: 1, textAlign: 'center' }}>
            <Typography sx={{
              fontWeight: 800,
              fontSize: `${2.2 * fontScale}rem`,
              color: '#111',
              lineHeight: 1,
            }}>
              {col.name}
            </Typography>
          </Box>
        ))}
      </Box>

      {/* Column grid — 90% height */}
      <Box sx={{
        flex: 1,
        display: 'flex',
        flexDirection: 'row',
        gap: '2.5%',
        px: '2.5%',
        pb: '2.5%',
        minHeight: 0,
      }}>
        {columns.map((col, colIdx) => {
          const colProducts = grouped[colIdx] || [];
          const rowCount = Math.max(1, Math.ceil(colProducts.length / 2));

          return (
            <Box
              key={colIdx}
              sx={{
                flex: 1,
                bgcolor: col.color || '#f5f5f5',
                minHeight: 0,
                overflow: 'hidden',
                position: 'relative',
              }}
            >
              {colProducts.length > 0 && (
                <Box sx={{
                  position: 'absolute',
                  inset: 0,
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gridTemplateRows: rowCount <= 1 ? '1fr' : '13fr 7fr',
                }}>
                  {colProducts.map((product, pIdx) => {
                    const isTopRow = pIdx < 2;
                    const isProductSoldOut = (product.variants || []).length > 0 &&
                      product.variants.every(v => soldOut[`${product.sku}#${v.sku}`]);
                    const showImage = displaySettings.showImages !== false && product.masterImage;
                    const imgSrc = product.masterImage?.pwa?.lg || product.masterImage?.pwa?.md || product.masterImage?.url;
                    const defaultVariant = (product.variants || []).find(v => v.isDefault) || product.variants?.[0];

                    const productBg = product.masterImage?.backgroundColor || col.color || '#f5f5f5';
                    const productTextColor = product.masterImage?.textColor || '#111';

                    return (
                      <Box
                        key={product.sku}
                        sx={{
                          display: 'flex',
                          flexDirection: 'column',
                          position: 'relative',
                          bgcolor: productBg,
                          minHeight: 0,
                          overflow: 'hidden',
                          ...(isProductSoldOut && { filter: 'grayscale(100%)' }),
                        }}
                      >
                        {/* Product image — large, centered */}
                        {showImage && (
                          <Box sx={{
                            flex: 1,
                            minHeight: 0,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            overflow: 'hidden',
                          }}>
                            <Box
                              component="img"
                              src={imgSrc}
                              alt={product.name}
                              sx={{
                                maxWidth: '100%',
                                maxHeight: '100%',
                                objectFit: 'contain',
                                display: 'block',
                                transform: isTopRow ? 'scale(2.5)' : 'scale(1.35)',
                              }}
                            />
                          </Box>
                        )}

                        {/* Product name — left aligned, at bottom */}
                        <Box sx={{ px: 1, pb: 0.5, flexShrink: 0 }}>
                          <Typography sx={{
                            fontWeight: 600,
                            fontSize: `${1.6 * fontScale}vw`,
                            color: productTextColor,
                            lineHeight: 1.2,
                          }}>
                            {product.name}
                          </Typography>
                        </Box>

                        {isProductSoldOut && (
                          <Box sx={{
                            position: 'absolute',
                            top: 4,
                            right: 4,
                            px: 1,
                            py: 0.25,
                            bgcolor: '#c00',
                            color: '#fff',
                            fontWeight: 800,
                            fontSize: `${0.7 * fontScale}rem`,
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
              )}
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
