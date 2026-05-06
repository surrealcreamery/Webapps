import React from 'react';
import { Box, Typography } from '@mui/material';

export default function ShowcaseTemplate({ displaySettings, products, soldOut }) {
  const ts = displaySettings.templateSettings || {};
  const cols = displaySettings.columns || 3;
  const gridTopOffset = displaySettings.gridTopOffset || 0;
  const resolution = displaySettings.resolution || '1080p';
  const fontScale = resolution === '4K' ? 1.5 : resolution === '720p' ? 0.85 : 1;

  const themeDark = displaySettings.theme !== 'light';
  const bgColor = ts.backgroundColor || (themeDark ? '#1a1a2e' : '#f5f5f5');
  // Determine if background is actually dark by checking luminance
  const isDark = (() => {
    const hex = bgColor.replace('#', '');
    if (hex.length < 6) return themeDark;
    const r = parseInt(hex.slice(0, 2), 16), g = parseInt(hex.slice(2, 4), 16), b = parseInt(hex.slice(4, 6), 16);
    return (r * 299 + g * 587 + b * 114) / 1000 < 128;
  })();
  const cardStyle = ts.cardStyle || 'outlined';
  const rows = displaySettings.rows && displaySettings.rows > 0
    ? displaySettings.rows
    : Math.ceil(products.length / cols);
  const textColor = isDark ? '#fff' : '#111';
  const mutedColor = isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.5)';
  const borderColor = isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.2)';
  const subtitleBg = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.06)';
  const subtitleColor = isDark ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.7)';
  const filledBg = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)';
  // Cards always white with dark text
  const cardTextColor = '#111';
  const cardMutedColor = '#666';

  return (
    <Box sx={{
      width: '100%',
      height: '100%',
      bgcolor: bgColor,
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: '"Inter", "Helvetica Neue", sans-serif',
      position: 'relative',
    }}>
      {/* Background image */}
      {ts.backgroundImage && (
        <Box
          component="img"
          src={ts.backgroundImage}
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            opacity: ts.backgroundOpacity ?? 1,
            pointerEvents: 'none',
          }}
        />
      )}

      {/* Header area */}
      {(ts.headerImage || ts.headerText) && (
        <Box sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          pt: 3,
          pb: 1,
          position: 'relative',
          zIndex: 1,
        }}>
          {ts.headerImage && (
            <Box
              component="img"
              src={ts.headerImage}
              alt="Logo"
              sx={{
                maxHeight: `${80 * fontScale}px`,
                maxWidth: '60%',
                objectFit: 'contain',
                mb: ts.headerText ? 1 : 0,
              }}
            />
          )}
          {ts.headerText && (
            <Typography component="div" sx={{
              color: textColor,
              fontWeight: 800,
              fontSize: `${(displaySettings.headerFontSize || 2) * fontScale}rem !important`,
              letterSpacing: 1,
            }}>
              {ts.headerText}
            </Typography>
          )}
        </Box>
      )}

      {/* Subtitle bar */}
      {ts.subtitleText && (
        <Box sx={{
          bgcolor: subtitleBg,
          py: 1,
          px: 3,
          textAlign: 'center',
          position: 'relative',
          zIndex: 1,
        }}>
          <Typography sx={{
            color: subtitleColor,
            fontSize: `${(displaySettings.subtitleFontSize || 1.1) * fontScale}rem !important`,
            fontWeight: 500,
            letterSpacing: 0.5,
          }}>
            {ts.subtitleText}
          </Typography>
        </Box>
      )}

      {/* Product grid */}
      <Box sx={{
        flex: 1,
        display: 'grid',
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
        gap: 2.5,
        p: 3,
        position: 'relative',
        zIndex: 1,
        minHeight: 0,
        ...(gridTopOffset > 0 && { mt: `${gridTopOffset}vh` }),
      }}>
        {products.slice(0, cols * rows).map(product => {
          const isProductSoldOut = (product.variants || []).length > 0 &&
            product.variants.every(v => soldOut[`${product.sku}#${v.sku}`]);
          const showImage = displaySettings.showImages !== false && product.masterImage;
          const imgSrc = product.masterImage?.pwa?.lg || product.masterImage?.pwa?.md || product.masterImage?.url;

          const cardBorder = displaySettings.cardOutline !== false ? '2px solid #000' : 'none';
          const cardBg = '#fff';

          const priceNode = displaySettings.showPrices !== false && (() => {
            const defaultVariant = (product.variants || []).find(v => v.isDefault) || product.variants?.[0];
            return defaultVariant?.price != null ? (
              <Typography component="div" sx={{ color: cardStyle === 'floating' ? mutedColor : cardMutedColor, fontSize: `${2.2 * fontScale}rem !important`, mt: 0.5 }}>
                ${Number(defaultVariant.price) % 1 === 0 ? Number(defaultVariant.price) : Number(defaultVariant.price).toFixed(2)}
              </Typography>
            ) : null;
          })();

          const soldOutBadge = isProductSoldOut && (
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
          );

          // ─── Floating card: colored card at bottom, image overlaps above ───
          if (cardStyle === 'floating') {
            const productBg = product.masterImage?.backgroundColor || (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)');
            const productTextColor = product.masterImage?.textColor || textColor;

            return (
              <Box
                key={product.sku}
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  position: 'relative',
                  minHeight: 0,
                  ...(isProductSoldOut && { filter: 'grayscale(100%)' }),
                }}
              >
                {/* Product image — sits at bottom of its area, overlaps into card */}
                {showImage && (
                  <Box sx={{
                    flex: 3,
                    minHeight: 0,
                    display: 'flex',
                    alignItems: 'flex-end',
                    justifyContent: 'center',
                    mb: '-20%',
                    zIndex: 1,
                  }}>
                    <Box
                      component="img"
                      src={imgSrc}
                      alt={product.name}
                      sx={{
                        maxWidth: '90%',
                        maxHeight: '100%',
                        objectFit: 'contain',
                        display: 'block',
                      }}
                    />
                  </Box>
                )}

                {/* Colored card at bottom — flex: 2 so it always fills ~40% of cell */}
                <Box sx={{
                  flex: 2,
                  bgcolor: productBg,
                  borderRadius: 3,
                  px: 2,
                  pt: '20%',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'flex-start',
                  textAlign: 'center',
                }}>
                  <Typography component="div" sx={{
                    color: productTextColor,
                    fontWeight: 700,
                    fontSize: `${(cols <= 2 ? 3.4 : cols >= 4 ? 2.8 : 3.2) * fontScale}rem !important`,
                    lineHeight: 1.2,
                  }}>
                    {product.name}
                  </Typography>
                  {displaySettings.showPrices !== false && (() => {
                    const defaultVariant = (product.variants || []).find(v => v.isDefault) || product.variants?.[0];
                    return defaultVariant?.price != null ? (
                      <Typography component="div" sx={{ color: productTextColor, fontWeight: 600, fontSize: `${(cols <= 2 ? 2.8 : 2.4) * fontScale}rem !important`, mt: 0.25, opacity: 0.85 }}>
                        ${Number(defaultVariant.price) % 1 === 0 ? Number(defaultVariant.price) : Number(defaultVariant.price).toFixed(2)}
                      </Typography>
                    ) : null;
                  })()}
                </Box>
                {soldOutBadge}
              </Box>
            );
          }

          // ─── Outlined / Filled card (existing) ───
          return (
            <Box
              key={product.sku}
              sx={{
                border: cardStyle === 'filled' ? 'none' : cardBorder,
                bgcolor: cardStyle === 'filled' ? filledBg : cardBg,
                borderRadius: 3,
                overflow: 'hidden',
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                transition: 'opacity 0.3s',
                minHeight: 0,
                ...(isProductSoldOut && {
                  filter: 'grayscale(100%)',
                }),
              }}
            >
              {/* Product image — fills available space, contain keeps full image visible */}
              {showImage && (
                <Box sx={{
                  flex: 1,
                  minHeight: 0,
                  overflow: 'hidden',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  bgcolor: cardStyle === 'filled' ? 'transparent' : '#fff',
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
                    }}
                  />
                </Box>
              )}

              {/* Product name — bottom */}
              <Box sx={{
                px: 2,
                py: 1.5,
                textAlign: 'center',
                ...(!showImage && { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }),
              }}>
                <Typography component="div" sx={{
                  color: cardStyle === 'filled' ? textColor : cardTextColor,
                  fontWeight: 700,
                  fontSize: `${(cols <= 2 ? 2.8 : cols >= 4 ? 1.6 : 2.2) * fontScale}rem !important`,
                  lineHeight: 1.2,
                }}>
                  {product.name}
                </Typography>
                {priceNode}
              </Box>

              {soldOutBadge}
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
