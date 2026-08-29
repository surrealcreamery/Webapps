// src/pages/CustomPage.jsx
// Renders dynamic pages from the Pages builder (catalog-api getPageConfig)

import React, { useEffect, useLayoutEffect, useRef, useState, useMemo, useCallback } from 'react';
import { Box, Container, Typography, Button, CircularProgress, TextField, Alert, Stack, Tabs, Tab, Checkbox, FormControlLabel, LinearProgress } from '@mui/material';
import { useParams, useNavigate, useSearchParams, Navigate } from 'react-router-dom';
import OtpInput from '@/components/events/OtpInput';
import { OTP_VERIFY_URL, ASSET_API_URL } from '@/constants/events/eventsConstants';
import { Helmet } from 'react-helmet-async';
import { motion, AnimatePresence } from 'framer-motion';
import { getPageConfig, validateDiscountCode, getPublishedPages, fetchEvents, fetchEventLocations } from '@/services/pageConfigService';

import { useCatalog } from '@/contexts/commerce/CatalogContext';
import { useCheckout } from '@/components/commerce/CheckoutContext';
import { getTextColorForBackground } from '@/state/catalog/catalogUtils';
import { useSelector } from '@xstate/react';
import { LayoutContext } from '@/contexts/commerce/CommerceLayoutContext';
import { CartDrawer } from '@/components/commerce/CartDrawer';
import { useCart } from '@/hooks/useCart';

const childFadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};

const stagger = {
  visible: { transition: { staggerChildren: 0.15 } },
};

// Gradient builder (matches Commerce.jsx logic)
function buildGradientCSS(dir, startColor, endColor) {
  if (!dir) return null;
  const parts = dir.split(':');
  const type = parts[0];
  if (type === 'radial') {
    const position = (parts[1] || 'center').replace('-', ' ');
    return `radial-gradient(circle at ${position}, ${startColor} 0%, ${endColor} 100%)`;
  }
  if (type === 'linear') {
    const posToCoord = {
      'top-left': { x: 0, y: 0 }, 'top': { x: 1, y: 0 }, 'top-right': { x: 2, y: 0 },
      'left': { x: 0, y: 1 }, 'center': { x: 1, y: 1 }, 'right': { x: 2, y: 1 },
      'bottom-left': { x: 0, y: 2 }, 'bottom': { x: 1, y: 2 }, 'bottom-right': { x: 2, y: 2 },
    };
    const start = posToCoord[parts[1]] || posToCoord['top'];
    const end = posToCoord[parts[2]] || posToCoord['bottom'];
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const angle = Math.round(Math.atan2(dx, -dy) * (180 / Math.PI) + 360) % 360;
    return `linear-gradient(${angle}deg, ${startColor} 0%, ${endColor} 100%)`;
  }
  return null;
}

// ─── Section Renderers ───

const HERO_TEXT_POSITION_MAP = {
  'top-left': { justifyContent: 'flex-start', alignItems: 'flex-start', textAlign: 'left' },
  'top-center': { justifyContent: 'flex-start', alignItems: 'center', textAlign: 'center' },
  'top-right': { justifyContent: 'flex-start', alignItems: 'flex-end', textAlign: 'right' },
  'center-left': { justifyContent: 'center', alignItems: 'flex-start', textAlign: 'left' },
  'center-center': { justifyContent: 'center', alignItems: 'center', textAlign: 'center' },
  'center-right': { justifyContent: 'center', alignItems: 'flex-end', textAlign: 'right' },
  'bottom-left': { justifyContent: 'flex-end', alignItems: 'flex-start', textAlign: 'left' },
  'bottom-center': { justifyContent: 'flex-end', alignItems: 'center', textAlign: 'center' },
  'bottom-right': { justifyContent: 'flex-end', alignItems: 'flex-end', textAlign: 'right' },
};

function HeroSection({ config, navigate }) {
  const pos = HERO_TEXT_POSITION_MAP[config.textPosition] || HERO_TEXT_POSITION_MAP['center-left'];
  const background = useMemo(() => {
    if (config.gradientDirection && config.gradientStartColor && config.gradientEndColor) {
      const css = buildGradientCSS(config.gradientDirection, config.gradientStartColor, config.gradientEndColor);
      if (css) return css;
    }
    return config.backgroundColor || 'linear-gradient(180deg, #1a1a1a 0%, #2d1f3d 50%, #1a1a1a 100%)';
  }, [config]);

  return (
    <motion.div variants={childFadeUp}>
      <Box
        sx={{
          position: 'relative',
          width: (config.sizeMode === 'fixed' && config.width) ? { xs: '100%', md: config.width } : { xs: 'calc(100% - 32px)', sm: 'calc(100% - 48px)' },
          height: (config.sizeMode === 'fixed' && config.height) ? config.height : undefined,
          maxWidth: 'lg',
          mx: 'auto',
          mt: 3,
          aspectRatio: config.sizeMode === 'fixed' ? undefined : (config.aspectRatio || '16 / 9'),
          display: 'flex',
          flexDirection: 'column',
          alignItems: pos.alignItems,
          justifyContent: pos.justifyContent,
          overflow: 'hidden',
          borderRadius: 2,
          py: { xs: 3, md: 6 },
        }}
      >
        <Box sx={{ position: 'absolute', inset: 0, background }} />
        {config.imageUrl && (
          <img
            src={config.imageUrl}
            alt={config.title || config.subtitle || 'Hero image'}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
          />
        )}
        {config.title && (
          <Box sx={{ position: 'relative', zIndex: 1, px: { xs: 3, md: 6 }, mb: 1, filter: 'drop-shadow(0px 4px 8px rgba(0,0,0,0.15))' }}>
            <Typography
              variant="h1"
              aria-hidden="true"
              sx={{
                position: 'absolute', top: 0, left: 0, px: { xs: 3, md: 6 },
                fontFamily: "'Fredoka', sans-serif", fontWeight: 700,
                fontSize: { xs: '3.6rem', sm: '5rem', md: '6.4rem' },
                lineHeight: 1.05, letterSpacing: '-0.02em', whiteSpace: 'pre-line',
                color: '#3BBCE0',
                WebkitTextStroke: { xs: '6px #3BBCE0', md: '8px #3BBCE0' },
                textShadow: '0px 6px 0 #0a2a5e, 0px 7px 0 #0a2a5e, 0px 8px 0 #0a2a5e, 0px 9px 0 #0a2a5e',
              }}
            >
              {config.title}
            </Typography>
            <Typography
              variant="h1"
              sx={{
                position: 'relative',
                fontFamily: "'Fredoka', sans-serif", fontWeight: 700,
                fontSize: { xs: '3.6rem', sm: '5rem', md: '6.4rem' },
                lineHeight: 1.05, letterSpacing: '-0.02em', whiteSpace: 'pre-line',
                background: 'linear-gradient(to bottom, #ffffff 0%, #ffffff 40%, #d8e8f0 55%, #ffffff 70%, #ffffff 100%)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              }}
            >
              {config.title}
            </Typography>
          </Box>
        )}
        {config.subtitle && (
          <Typography
            sx={{
              position: 'relative', zIndex: 1, color: '#2d2d2d',
              fontSize: { xs: '1.6rem', sm: '1.8rem', md: '2rem' },
              fontWeight: 700, textAlign: pos.textAlign, mx: { xs: 3, md: 6 }, mb: 3,
              px: 2, py: 1, lineHeight: 1.4, whiteSpace: 'pre-line',
              backgroundColor: 'rgba(255,255,255,0.85)', borderRadius: 2,
              border: '2px solid white', display: 'inline-block',
            }}
          >
            {config.subtitle}
          </Typography>
        )}
        {config.buttons?.length > 0 && (
          <Box sx={{ position: 'relative', zIndex: 1, display: 'flex', gap: 2, px: { xs: 3, md: 6 } }} role="group" aria-label="Hero actions">
            {config.buttons.map((button, idx) => (
              <Button
                key={idx}
                variant="contained"
                aria-label={button.link?.startsWith('http') ? `${button.label} (opens in new tab)` : undefined}
                onClick={() => {
                  if (button.link?.startsWith('http')) window.open(button.link, '_blank', 'noopener,noreferrer');
                  else navigate(button.link);
                }}
                sx={button.style === 'filled' ? {
                  backgroundColor: '#d81b60', color: 'white', border: '2px solid black',
                  fontSize: '1.6rem', fontWeight: 800, textTransform: 'none',
                  px: { xs: 2.5, sm: 3.5 }, py: { xs: 1, sm: 1.2 }, borderRadius: '30px',
                  boxShadow: 'none', '&:hover': { backgroundColor: '#c2185b', boxShadow: 'none' },
                } : {
                  backgroundColor: '#0A6E88', color: 'white', border: '2px solid black',
                  fontSize: '1.6rem', fontWeight: 800, textTransform: 'none',
                  px: { xs: 2.5, sm: 3.5 }, py: { xs: 1, sm: 1.2 }, borderRadius: '30px',
                  boxShadow: 'none', '&:hover': { backgroundColor: '#085A6F', boxShadow: 'none' },
                }}
              >
                {button.label}
              </Button>
            ))}
          </Box>
        )}
      </Box>
    </motion.div>
  );
}

function ProductCarouselSection({ config, allProducts, onProductClick }) {
  const products = useMemo(() => {
    if (config.productSource === 'manual' && config.productIds?.length > 0) {
      return config.productIds.map(id => {
        const idUpper = id?.toUpperCase();
        return allProducts.find(p =>
          p.id === id ||
          p.sku?.toUpperCase() === idUpper ||
          p.variants?.some(v => v.sku?.toUpperCase() === idUpper)
        );
      }).filter(Boolean);
    }
    return allProducts.slice(0, config.maxProducts || 8);
  }, [config, allProducts]);

  return (
    <motion.div variants={childFadeUp}>
      <Box sx={{ width: '100vw', marginLeft: 'calc(-50vw + 50%)', backgroundColor: config.backgroundColor || '#f5f5f5', py: 6 }}>
        <Container maxWidth="lg">
          {config.title && <Typography variant="h2" sx={{ fontWeight: 700, fontSize: 'h4.fontSize', mb: 1, px: 2 }}>{config.title}</Typography>}
          {config.subtitle && <Typography sx={{ color: 'text.secondary', mb: 3, px: 2, fontSize: '1.6rem' }}>{config.subtitle}</Typography>}
          <Box
            role="region"
            aria-label="Products carousel"
            tabIndex={0}
            sx={{
              display: 'flex', gap: 2, overflowX: 'auto', pb: 2, px: 2,
              scrollSnapType: 'x mandatory',
              '&::-webkit-scrollbar': { display: 'none' }, scrollbarWidth: 'none',
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowRight') e.currentTarget.scrollBy({ left: 260, behavior: 'smooth' });
              if (e.key === 'ArrowLeft') e.currentTarget.scrollBy({ left: -260, behavior: 'smooth' });
            }}
          >
            {products.map((product) => (
              <Box
                key={product.id}
                role="button"
                tabIndex={0}
                onClick={() => onProductClick(product.id)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onProductClick(product.id); } }}
                sx={{
                  flexShrink: 0, width: { xs: '200px', sm: '240px', md: '280px' },
                  scrollSnapAlign: 'start', cursor: 'pointer', backgroundColor: 'white',
                  borderRadius: 3, overflow: 'hidden',
                  transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                  '&:hover, &:focus-visible': { transform: 'translateY(-4px)', boxShadow: '0 8px 24px rgba(0,0,0,0.12)' },
                }}
              >
                <Box sx={{ position: 'relative', paddingTop: '100%', backgroundColor: '#fafafa' }}>
                  <img
                    src={product.imageUrl || product.images?.[0]?.url || 'https://placehold.co/300x300/f0f0f0/999?text=Product'}
                    alt={product.name}
                    loading="lazy"
                    style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                </Box>
                <Box sx={{ p: 2 }}>
                  <Typography sx={{ fontWeight: 600, fontSize: '1.6rem', mb: 0.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {product.name}
                  </Typography>
                  <Typography sx={{ color: 'text.secondary', fontSize: '1.6rem' }}>
                    {product.price || `$${product.variants?.[0]?.price || '0.00'}`}
                  </Typography>
                </Box>
              </Box>
            ))}
          </Box>
        </Container>
      </Box>
    </motion.div>
  );
}

function PageCarouselSection({ config, navigate }) {
  const [pages, setPages] = useState([]);
  const params = useParams();
  const currentSlug = params['*'] || params.slug;

  useEffect(() => {
    getPublishedPages().then(setPages);
  }, []);

  const displayPages = useMemo(() => {
    let filtered = pages.filter(p => p.slug !== currentSlug);
    if (config.pageIds?.length > 0) {
      filtered = config.pageIds
        .map(id => filtered.find(p => p.id === id))
        .filter(Boolean);
    }
    return filtered.slice(0, config.maxPages || 6);
  }, [pages, config.pageIds, config.maxPages, currentSlug]);

  if (displayPages.length === 0) return null;

  return (
    <motion.div variants={childFadeUp}>
      <Box sx={{ width: '100vw', marginLeft: 'calc(-50vw + 50%)', backgroundColor: config.backgroundColor || '#f5f5f5', py: 6 }}>
        <Container maxWidth="lg">
          {config.title && <Typography variant="h2" sx={{ fontWeight: 700, fontSize: 'h4.fontSize', mb: 1, px: 2 }}>{config.title}</Typography>}
          {config.subtitle && <Typography sx={{ color: 'text.secondary', mb: 3, px: 2, fontSize: '1.6rem' }}>{config.subtitle}</Typography>}
          <Box
            role="region"
            aria-label="Pages carousel"
            tabIndex={0}
            sx={{
              display: 'flex', gap: 2, overflowX: 'auto', pb: 2, px: 2,
              scrollSnapType: 'x mandatory',
              '&::-webkit-scrollbar': { display: 'none' }, scrollbarWidth: 'none',
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowRight') e.currentTarget.scrollBy({ left: 260, behavior: 'smooth' });
              if (e.key === 'ArrowLeft') e.currentTarget.scrollBy({ left: -260, behavior: 'smooth' });
            }}
          >
            {displayPages.map((page) => (
              <Box
                key={page.id}
                component="a"
                href={`/${page.slug}`}
                onClick={(e) => { e.preventDefault(); navigate(`/${page.slug}`); }}
                sx={{
                  flexShrink: 0, width: { xs: '200px', sm: '240px', md: '280px' },
                  scrollSnapAlign: 'start', cursor: 'pointer', backgroundColor: 'white',
                  borderRadius: 3, overflow: 'hidden',
                  transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                  '&:hover, &:focus-visible': { transform: 'translateY(-4px)', boxShadow: '0 8px 24px rgba(0,0,0,0.12)' },
                }}
              >
                <Box sx={{ position: 'relative', paddingTop: '56.25%', backgroundColor: '#fafafa' }}>
                  <img
                    src={page.imageUrl || 'https://placehold.co/300x170/f0f0f0/999?text=Page'}
                    alt={page.title}
                    loading="lazy"
                    style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                </Box>
                <Box sx={{ p: 2 }}>
                  <Typography sx={{ fontWeight: 600, fontSize: '1.6rem', mb: 0.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {page.title}
                  </Typography>
                </Box>
              </Box>
            ))}
          </Box>
        </Container>
      </Box>
    </motion.div>
  );
}

function ProductGridSection({ config, allProducts, onProductClick }) {
  const { storeLocations = [], selectedLocation } = useCatalog();
  const selectedLocationId = selectedLocation || localStorage.getItem('selectedLocation');
  const warehouseIds = useMemo(() => storeLocations.filter(l => l.type === 'Warehouse').map(l => l.id), [storeLocations]);

  const products = useMemo(() => {
    if (config.productSource === 'manual' && config.productIds?.length > 0) {
      return config.productIds.map(id => {
        const idUpper = id?.toUpperCase();
        return allProducts.find(p =>
          p.id === id ||
          p.sku?.toUpperCase() === idUpper ||
          p.variants?.some(v => v.sku?.toUpperCase() === idUpper)
        );
      }).filter(Boolean);
    }
    return allProducts.slice(0, config.maxProducts || 12);
  }, [config, allProducts]);

  if (!products.length) return null;

  return (
    <motion.div variants={childFadeUp}>
      <Box sx={{ width: '100vw', marginLeft: 'calc(-50vw + 50%)', backgroundColor: config.backgroundColor || '#ffffff', py: 6 }}>
        <Container maxWidth="lg">
          {config.title && <Typography variant="h2" sx={{ fontWeight: 700, fontSize: 'h4.fontSize', mb: 1, px: 2 }}>{config.title}</Typography>}
          {config.subtitle && <Typography sx={{ color: 'text.secondary', mb: 3, px: 2, fontSize: '1.6rem' }}>{config.subtitle}</Typography>}
          <Box
            role="region"
            aria-label={config.title || 'Products'}
            sx={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
              gap: 2,
              px: 2,
            }}
          >
            {products.map((product) => {
              const inv = product.inventory;
              const isTracked = inv?.trackInventory;
              const locations = inv?.byLocation || [];
              const anyLocationHasStock = locations.some(l => (l.quantity || 0) > 0);
              const storeQty = isTracked && selectedLocationId
                ? locations.find(l => l.locationId === selectedLocationId)?.quantity || 0
                : null;
              const allowsShipping = !product.fulfillmentMethods?.length || product.fulfillmentMethods.includes('shipping');
              const canShipFromAnywhere = allowsShipping && locations.some(l => {
                if ((l.quantity || 0) <= 0) return false;
                const loc = storeLocations.find(sl => sl.id === l.locationId);
                return loc && !loc.disableShipping;
              });
              const isSoldOut = isTracked && (!anyLocationHasStock || (storeQty != null && storeQty <= 0 && !canShipFromAnywhere));

              return (
                <ProductCard
                  key={product.id}
                  product={product}
                  onClick={() => onProductClick(product.id)}
                  soldOut={isSoldOut}
                />
              );
            })}
          </Box>
        </Container>
      </Box>
    </motion.div>
  );
}

function CtaButtonsSection({ config, navigate }) {
  if (!config.buttons?.length) return null;
  return (
    <motion.div variants={childFadeUp}>
      <Container maxWidth="lg" sx={{ py: 4 }}>
        {config.title && <Typography variant="h2" sx={{ fontWeight: 700, fontSize: 'h4.fontSize', mb: 2, textAlign: 'center' }}>{config.title}</Typography>}
        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }} role="group" aria-label={config.title || 'Actions'}>
          {config.buttons.map((button, idx) => (
            <Button
              key={idx}
              variant="contained"
              aria-label={button.link?.startsWith('http') ? `${button.label} (opens in new tab)` : undefined}
              onClick={() => {
                if (button.link?.startsWith('#section-')) {
                  const el = document.getElementById(button.link.slice(1));
                  if (el) el.scrollIntoView({ behavior: 'smooth' });
                } else if (button.link?.startsWith('http')) window.open(button.link, '_blank', 'noopener,noreferrer');
                else if (button.link?.startsWith('/events?eventId=')) navigate(button.link + '&register=true');
                else navigate(button.link);
              }}
              sx={{
                backgroundColor: button.color || '#0A6E88', color: button.textColor || 'white',
                fontSize: '1.6rem', fontWeight: 700, textTransform: 'none',
                px: 4, py: 1.5, borderRadius: '30px', boxShadow: 'none',
                '&:hover': { opacity: 0.9, boxShadow: 'none' },
              }}
            >
              {button.label}
            </Button>
          ))}
        </Box>
      </Container>
    </motion.div>
  );
}

function TextSection({ config }) {
  const htmlContent = config.html || config.content;
  return (
    <motion.div variants={childFadeUp}>
      <Box sx={{ width: '100vw', marginLeft: 'calc(-50vw + 50%)', backgroundColor: config.backgroundColor || 'transparent', pt: config.paddingTop || config.padding || '24px', pb: config.paddingBottom || config.padding || '24px' }}>
        <Container maxWidth="lg">
          <Box sx={{ maxWidth: config.maxWidth || '100%', mx: (config.alignment || config.align) === 'center' ? 'auto' : 0, textAlign: config.alignment || config.align || 'left' }}>
            {config.title && <Typography variant="h2" sx={{ fontWeight: 700, fontSize: 'h4.fontSize', mb: 2 }}>{config.title}</Typography>}
            {config.body && (
              <Typography sx={{ fontSize: config.fontSize || '1.6rem', lineHeight: 1.8, color: config.textColor || 'text.primary', whiteSpace: 'pre-line' }}>
                {config.body}
              </Typography>
            )}
            {htmlContent && <Box dangerouslySetInnerHTML={{ __html: htmlContent }} sx={{ fontSize: config.fontSize || '1.6rem', lineHeight: 1.8, whiteSpace: 'pre-line', '& a': { color: 'primary.main' } }} />}
          </Box>
        </Container>
      </Box>
    </motion.div>
  );
}

function ImageSection({ config }) {
  if (!config.imageUrl) return null;
  const fullBleed = config.fullBleed || config.fullWidth;
  const alt = config.altText || config.alt || '';
  const isExternal = config.link?.startsWith('http');
  const imgStyle = { width: '100%', height: 'auto', display: 'block', borderRadius: fullBleed ? 0 : 8 };
  const imgEl = config.mobileImageUrl ? (
    <picture>
      <source media="(max-width: 768px)" srcSet={config.mobileImageUrl} />
      <img src={config.imageUrl} alt={alt} role={alt ? undefined : 'presentation'} style={imgStyle} />
    </picture>
  ) : (
    <img src={config.imageUrl} alt={alt} role={alt ? undefined : 'presentation'} style={imgStyle} />
  );
  return (
    <motion.div variants={childFadeUp}>
      <Box sx={{ width: '100vw', marginLeft: 'calc(-50vw + 50%)', backgroundColor: config.backgroundColor || 'transparent', py: fullBleed ? 0 : 4 }}>
        <Container maxWidth={fullBleed ? false : 'lg'} disableGutters={!!fullBleed}>
          {config.link ? (
            <a
              href={config.link}
              aria-label={alt || 'View linked content'}
              {...(isExternal ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
              style={{ display: 'block' }}
            >
              {imgEl}
            </a>
          ) : imgEl}
        </Container>
      </Box>
    </motion.div>
  );
}

// ─── Shared Product Card (used by ProductGridSection + BXGY wizard) ───

function ProductCard({ product, onClick, selected, badge, soldOut }) {
  const bgColor = product.masterImage?.backgroundColor || product.images?.[0]?.backgroundColor || '#1a1a2e';
  const textColor = product.masterImage?.textColor || product.images?.[0]?.textColor || getTextColorForBackground(bgColor);
  const imgSrc = product.imageUrl || product.images?.[0]?.url;
  const pwa = product.pwa || product.masterImage?.pwa;

  const variants = product.variants?.filter(v => v.price) || [];
  let price = '';
  if (variants.length > 1) {
    const prices = variants.map(v => parseFloat(v.price)).sort((a, b) => a - b);
    price = prices[0] === prices[prices.length - 1]
      ? `$${prices[0].toFixed(2)}`
      : `$${prices[0].toFixed(2)} - $${prices[prices.length - 1].toFixed(2)}`;
  } else if (variants.length === 1) {
    price = `$${parseFloat(variants[0].price).toFixed(2)}`;
  } else if (product.price) {
    price = `$${parseFloat(product.price).toFixed(2)}`;
  }

  return (
    <Box
      data-product-id={product.id}
      role="button"
      tabIndex={0}
      aria-label={product.name}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }}
      sx={{
        cursor: 'pointer',
        transition: 'transform 0.2s',
        '&:active': { transform: 'scale(0.96)' },
        '&:focus-visible': { outline: '2px solid #1976d2', outlineOffset: 2, borderRadius: 1 },
      }}
    >
      <Box
        sx={{
          borderRadius: 3,
          overflow: 'hidden',
          bgcolor: 'white',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          ...(selected != null ? {
            outline: selected ? '3px solid #1976d2' : '3px solid transparent',
            outlineOffset: -3,
            transition: 'outline-color 0.2s',
          } : {}),
        }}
      >
        {soldOut && (
          <Box sx={{ bgcolor: 'rgba(180, 30, 30, 1)', py: 0.5, textAlign: 'center' }}>
            <Typography sx={{ color: '#fff', fontWeight: 800, fontSize: '1.4rem', letterSpacing: 2, textTransform: 'uppercase' }}>
              Sold Out
            </Typography>
          </Box>
        )}
        {badge && (
          <Box sx={{
            position: 'absolute', top: soldOut ? 36 : 8, right: 8, zIndex: 2,
            bgcolor: badge === 'FREE' ? '#4caf50' : '#ff9800',
            color: 'white', fontWeight: 800, fontSize: '1.2rem',
            px: 1, py: 0.3, borderRadius: 1,
          }}>
            {badge}
          </Box>
        )}
        {selected && (
          <Box sx={{
            position: 'absolute', top: soldOut ? 36 : 8, left: 8, zIndex: 2,
            width: 24, height: 24, borderRadius: '50%',
            bgcolor: '#1976d2', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Typography sx={{ color: 'white', fontWeight: 800, fontSize: '1.4rem', lineHeight: 1 }}>&#10003;</Typography>
          </Box>
        )}
        <Box sx={{ position: 'relative', paddingTop: '100%' }}>
          <Box
            sx={{
              position: 'absolute',
              left: 0, right: 0, bottom: 0,
              height: '50%',
              bgcolor: bgColor,
              borderRadius: '16px 16px 0 0',
            }}
          />
          {imgSrc && (
            <Box
              sx={{
                position: 'absolute',
                top: '3%', left: '2%', right: '2%', bottom: '3%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <img
                src={imgSrc}
                srcSet={pwa ? `${pwa.xs || pwa.sm} 320w, ${pwa.sm} 480w, ${pwa.md} 960w, ${pwa.lg} 1440w` : undefined}
                sizes={pwa ? '(max-width: 600px) 45vw, (max-width: 960px) 33vw, 300px' : undefined}
                alt={product.imageAlt || product.name}
                loading="lazy"
                style={{
                  width: '100%', height: '100%', objectFit: 'cover',
                  ...(soldOut ? { filter: 'grayscale(100%)' } : {}),
                }}
              />
            </Box>
          )}
        </Box>
        <Box sx={{ bgcolor: bgColor, p: 1.5, pt: 0.5, flex: 1 }}>
          {price && (
            <Typography sx={{ fontSize: '1.6rem', fontWeight: 700, color: textColor }}>
              {price}
            </Typography>
          )}
          <Typography sx={{ fontWeight: 400, fontSize: '1.6rem', lineHeight: 1.2, color: textColor, mb: 0.5 }}>
            {product.name}
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}

// ─── Offer Redemption Section ───

function OfferRedemptionSection({ config, allProducts, navigate, localCart }) {
  const [searchParams] = useSearchParams();
  const { setCheckoutPromoCode } = useCheckout();
  const [state, setState] = useState('idle'); // idle | validating | valid | invalid | success
  const [codeInput, setCodeInput] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [bxgyStep, setBxgyStep] = useState(null); // 'buy' | 'get' | null
  const [buySelections, setBuySelections] = useState([]); // [{product, variant, quantity}]
  const [getSelections, setGetSelections] = useState([]); // [{product, variant, quantity}]
  const validatedRef = useRef(false);
  const claimFiredRef = useRef(false);
  const suppressBuyAdvanceRef = useRef(false);

  const urlCode = searchParams.get('code');

  const doValidate = useCallback(async (code) => {
    setState('validating');
    setError('');
    const res = await validateDiscountCode(code);
    if (res.success && res.valid) {
      setResult(res);
      setState('valid');
    } else {
      setError(res.reason || 'Invalid code');
      setState('invalid');
    }
  }, []);

  // Auto-validate URL code on mount
  useEffect(() => {
    if (urlCode && !validatedRef.current) {
      validatedRef.current = true;
      doValidate(urlCode);
    }
  }, [urlCode, doValidate]);

  const handleManualSubmit = (e) => {
    e.preventDefault();
    if (codeInput.trim()) doValidate(codeInput.trim());
  };

  const handleRetry = () => {
    setState('idle');
    setError('');
    setCodeInput('');
    setBxgyStep(null);
    setBuySelections([]);
    setGetSelections([]);
    validatedRef.current = false;
    claimFiredRef.current = false;
  };

  // Determine effective action
  const effectiveAction = useMemo(() => {
    if (!result?.discount) return config.redemptionAction || 'save-to-cart';
    if (config.redemptionAction === 'auto') {
      return result.discount.discountCategory === 'BUY_X_GET_Y' ? 'bxgy' : 'save-to-cart';
    }
    return config.redemptionAction;
  }, [config.redemptionAction, result]);

  // BXGY product lists (buy side + get side)
  const findProductBySku = useCallback((sku) => {
    const skuUpper = sku.toUpperCase();
    return allProducts.find(p =>
      p.sku?.toUpperCase() === skuUpper ||
      p.variants?.some(v => v.sku?.toUpperCase() === skuUpper)
    );
  }, [allProducts]);

  const buyProducts = useMemo(() => {
    if (effectiveAction !== 'bxgy' || !result?.discount?.buyProductSkus?.length) return [];
    return result.discount.buyProductSkus.map(findProductBySku).filter(Boolean);
  }, [effectiveAction, result, findProductBySku]);

  const getProducts = useMemo(() => {
    if (effectiveAction !== 'bxgy' || !result?.discount?.getProductSkus?.length) return [];
    return result.discount.getProductSkus.map(findProductBySku).filter(Boolean);
  }, [effectiveAction, result, findProductBySku]);

  const buyQuantity = result?.discount?.buyQuantity || 1;
  const getQuantity = result?.discount?.getQuantity || 1;
  const totalBuySelected = buySelections.reduce((sum, s) => sum + s.quantity, 0);
  const totalGetSelected = getSelections.reduce((sum, s) => sum + s.quantity, 0);

  const getBadge = useMemo(() => {
    if (!result?.discount) return null;
    const vt = result.discount.getValueType || 'FREE';
    if (vt === 'FREE') return 'FREE';
    if (vt === 'PERCENTAGE') return `${result.discount.getValue}% off`;
    return null;
  }, [result]);

  // Auto-start BXGY flow when validation succeeds
  useEffect(() => {
    if (state === 'valid' && effectiveAction === 'bxgy' && !bxgyStep) {
      if (buyProducts.length === 0) {
        setBxgyStep('get');
      } else {
        setBxgyStep('buy');
      }
    }
  }, [state, effectiveAction, bxgyStep, buyProducts.length]);

  // Auto-advance: buy → get when buyQuantity reached
  useEffect(() => {
    if (bxgyStep === 'buy' && totalBuySelected >= buyQuantity) {
      if (suppressBuyAdvanceRef.current) {
        suppressBuyAdvanceRef.current = false;
        return;
      }
      setBxgyStep('get');
    }
  }, [bxgyStep, totalBuySelected, buyQuantity]);

  // Auto-advance: get → checkout when getQuantity reached
  useEffect(() => {
    if (bxgyStep === 'get' && totalGetSelected >= getQuantity && !claimFiredRef.current) {
      claimFiredRef.current = true;
      // Defer to next tick so state is settled
      setTimeout(() => handleBxgyClaim(), 0);
    }
  }, [bxgyStep, totalGetSelected, getQuantity]);

  const handleRedeem = (code) => {
    setCheckoutPromoCode(code);
    setState('success');
    if (effectiveAction === 'checkout') {
      navigate('/checkout');
    }
  };

  const handleBuySelect = useCallback((product, variant) => {
    setBuySelections(prev => {
      const key = variant?.sku || variant?.id || product.id;
      const existing = prev.find(s => (s.variant?.sku || s.variant?.id || s.product.id) === key);
      if (existing) {
        // Deselect
        return prev.filter(s => s !== existing);
      }
      // Check if we can still add
      const total = prev.reduce((sum, s) => sum + s.quantity, 0);
      if (total >= buyQuantity) return prev;
      return [...prev, { product, variant, quantity: 1 }];
    });
  }, [buyQuantity]);

  const handleGetSelect = useCallback((product, variant) => {
    setGetSelections(prev => {
      const key = variant?.sku || variant?.id || product.id;
      const existing = prev.find(s => (s.variant?.sku || s.variant?.id || s.product.id) === key);
      if (existing) {
        return prev.filter(s => s !== existing);
      }
      const total = prev.reduce((sum, s) => sum + s.quantity, 0);
      if (total >= getQuantity) return prev;
      return [...prev, { product, variant, quantity: 1 }];
    });
  }, [getQuantity]);

  const handleBuyContinue = () => setBxgyStep('get');

  const handleBxgyClaim = () => {
    const code = result.customerDiscount?.code || urlCode || codeInput;
    // Add buy items to cart
    for (const sel of buySelections) {
      localCart.addToCart(sel.product, sel.variant, sel.quantity);
    }
    // Add get items to cart as free gifts
    for (const sel of getSelections) {
      localCart.addToCart(sel.product, sel.variant, sel.quantity, [], { isFreeGift: true, discountId: result.discount?.id });
    }
    setCheckoutPromoCode(code);
    navigate('/checkout');
  };

  const discountLabel = useMemo(() => {
    if (!result?.discount) return '';
    const d = result.discount;
    if (d.valueType === 'PERCENTAGE') return `${d.value}% off`;
    if (d.valueType === 'FIXED_AMOUNT') return `$${(d.value / 100).toFixed(2)} off`;
    return d.name;
  }, [result]);

  const activeCode = result?.customerDiscount?.code || urlCode || codeInput;
  const customerName = result?.customerDiscount?.customerName;

  return (
    <motion.div variants={childFadeUp}>
      <Box
        sx={{
          width: '100vw',
          marginLeft: 'calc(-50vw + 50%)',
          bgcolor: config.backgroundColor || '#f5f5f5',
          py: 6,
        }}
      >
        <Container maxWidth={bxgyStep ? 'lg' : 'sm'} sx={{ textAlign: 'center' }}>
          <Typography variant="h4" sx={{ fontWeight: 700, mb: 1, color: config.textColor || '#1a1a1a' }}>
            {config.title || 'Redeem Your Offer'}
          </Typography>
          {config.subtitle && (
            <Typography sx={{ fontSize: '1.4rem', mb: 1, color: config.textColor || '#1a1a1a', opacity: 0.8 }}>
              {config.subtitle}
            </Typography>
          )}

          {/* Validating */}
          {state === 'validating' && (
            <Box sx={{ py: 4, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
              <CircularProgress size={32} />
              <Typography sx={{ color: config.textColor || '#1a1a1a', opacity: 0.7 }}>
                Checking your code...
              </Typography>
            </Box>
          )}

          {/* Idle — manual entry */}
          {state === 'idle' && !urlCode && config.showCodeInput !== false && (
            <Box sx={{ py: 3 }}>
              <Typography sx={{ mb: 2, color: config.textColor || '#1a1a1a', opacity: 0.7 }}>
                {config.description || 'Enter your code below to claim your reward.'}
              </Typography>
              <form onSubmit={handleManualSubmit} aria-label="Redeem discount code">
                <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1 }}>
                  <TextField
                    value={codeInput}
                    onChange={(e) => setCodeInput(e.target.value)}
                    label="Discount code"
                    size="small"
                    sx={{ width: 260, bgcolor: 'white', borderRadius: 1 }}
                    inputProps={{ 'aria-required': true }}
                  />
                  <Button type="submit" variant="contained" disabled={!codeInput.trim()}>
                    {config.buttonLabel || 'Redeem'}
                  </Button>
                </Box>
              </form>
            </Box>
          )}

          {/* Valid — save-to-cart */}
          {state === 'valid' && effectiveAction === 'save-to-cart' && (
            <Box sx={{ py: 3 }}>
              {customerName && (
                <Typography variant="h5" sx={{ fontWeight: 600, mb: 1, color: config.textColor || '#1a1a1a' }}>
                  Hi {customerName}!
                </Typography>
              )}
              <Typography sx={{ fontSize: '1.8rem', mb: 1, color: config.textColor || '#1a1a1a' }}>
                You've unlocked: <strong>{discountLabel}</strong>
              </Typography>
              <Typography sx={{ fontSize: '1.4rem', mb: 3, color: config.textColor || '#1a1a1a', opacity: 0.6 }}>
                Code: {activeCode}
              </Typography>
              <Button
                variant="contained"
                size="large"
                onClick={() => handleRedeem(activeCode)}
                sx={{ px: 4, py: 1.5, borderRadius: '30px', fontSize: '1.6rem', fontWeight: 700 }}
              >
                Start Shopping
              </Button>
            </Box>
          )}

          {/* Valid — checkout */}
          {state === 'valid' && effectiveAction === 'checkout' && (
            <Box sx={{ py: 3 }}>
              {customerName && (
                <Typography variant="h5" sx={{ fontWeight: 600, mb: 1, color: config.textColor || '#1a1a1a' }}>
                  Hi {customerName}!
                </Typography>
              )}
              <Typography sx={{ fontSize: '1.8rem', mb: 1, color: config.textColor || '#1a1a1a' }}>
                You've unlocked: <strong>{discountLabel}</strong>
              </Typography>
              <Button
                variant="contained"
                size="large"
                onClick={() => handleRedeem(activeCode)}
                sx={{ px: 4, py: 1.5, borderRadius: '30px', fontSize: '1.6rem', fontWeight: 700 }}
              >
                Go to Checkout
              </Button>
            </Box>
          )}

          {/* Valid — BXGY two-step wizard */}
          {state === 'valid' && effectiveAction === 'bxgy' && (
            <Box sx={{ py: 3 }} aria-live="polite">
              {customerName && (
                <Typography variant="h5" sx={{ fontWeight: 600, mb: 1, color: config.textColor || '#1a1a1a' }}>
                  Hi {customerName}!
                </Typography>
              )}

              {/* Step 1: Buy */}
              {bxgyStep === 'buy' && (
                <>
                  <Typography sx={{ fontSize: '1.8rem', mb: 1, color: config.textColor || '#1a1a1a', fontWeight: 700 }}>
                    Pick your item{buyQuantity > 1 ? 's' : ''}
                  </Typography>
                  {buyQuantity > 1 && (
                    <Typography sx={{ fontSize: '1.4rem', mb: 3, color: config.textColor || '#1a1a1a', opacity: 0.7 }}>
                      {totalBuySelected} of {buyQuantity} selected
                    </Typography>
                  )}
                  <Box sx={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
                    gap: 2, mb: 3, px: 2, textAlign: 'left',
                  }}>
                    {buyProducts.map((product) => {
                      const sel = buySelections.find(s => s.product.id === product.id);
                      const variants = product.variants?.filter(v => v.price) || [];
                      return (
                        <ProductCard
                          key={product.id}
                          product={product}
                          onClick={() => handleBuySelect(product, sel?.variant || variants[0])}
                          selected={!!sel}
                        />
                      );
                    })}
                  </Box>
                  {buyQuantity > 1 && (
                    <Button
                      variant="contained"
                      size="large"
                      disabled={totalBuySelected < buyQuantity}
                      onClick={handleBuyContinue}
                      sx={{ px: 4, py: 1.5, borderRadius: '30px', fontSize: '1.6rem', fontWeight: 700 }}
                    >
                      Continue
                    </Button>
                  )}
                </>
              )}

              {/* Step 2: Get */}
              {bxgyStep === 'get' && (
                <>
                  <Typography sx={{ fontSize: '1.8rem', mb: 1, color: config.textColor || '#1a1a1a', fontWeight: 700 }}>
                    Pick your free item{getQuantity > 1 ? 's' : ''}!
                  </Typography>
                  {urlCode && (
                    <Alert severity="success" sx={{ mb: 2, mx: 'auto', maxWidth: 420, justifyContent: 'center' }}>
                      Discount code applied — pick your free item!
                    </Alert>
                  )}
                  {getQuantity > 1 && (
                    <Typography sx={{ fontSize: '1.4rem', mb: 3, color: config.textColor || '#1a1a1a', opacity: 0.7 }}>
                      {totalGetSelected} of {getQuantity} selected
                    </Typography>
                  )}
                  <Box sx={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
                    gap: 2, mb: 3, px: 2, textAlign: 'left',
                  }}>
                    {getProducts.map((product) => {
                      const sel = getSelections.find(s => s.product.id === product.id);
                      const variants = product.variants?.filter(v => v.price) || [];
                      return (
                        <ProductCard
                          key={product.id}
                          product={product}
                          onClick={() => handleGetSelect(product, sel?.variant || variants[0])}
                          selected={!!sel}
                          badge={getBadge}
                        />
                      );
                    })}
                  </Box>
                  <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
                    {buyProducts.length > 0 && (
                      <Button
                        variant="outlined"
                        size="large"
                        onClick={() => { claimFiredRef.current = false; suppressBuyAdvanceRef.current = true; setBxgyStep('buy'); }}
                        sx={{ px: 3, py: 1.5, borderRadius: '30px', fontSize: '1.6rem', fontWeight: 700 }}
                      >
                        Back
                      </Button>
                    )}
                    {getQuantity > 1 && (
                      <Button
                        variant="contained"
                        size="large"
                        disabled={totalGetSelected < getQuantity}
                        onClick={handleBxgyClaim}
                        sx={{ px: 4, py: 1.5, borderRadius: '30px', fontSize: '1.6rem', fontWeight: 700 }}
                      >
                        Claim & Checkout
                      </Button>
                    )}
                  </Box>
                </>
              )}
            </Box>
          )}

          {/* Success */}
          {state === 'success' && (
            <Box sx={{ py: 3 }}>
              <Alert severity="success" sx={{ mb: 2, justifyContent: 'center' }}>
                {config.successMessage || 'Your discount has been applied!'}
              </Alert>
              <Button
                variant="contained"
                onClick={() => navigate('/')}
                sx={{ borderRadius: '30px', px: 4 }}
              >
                Start Shopping
              </Button>
            </Box>
          )}

          {/* Invalid */}
          {state === 'invalid' && (
            <Box sx={{ py: 3 }}>
              <Alert severity="warning" sx={{ mb: 2, justifyContent: 'center' }}>
                {error}
              </Alert>
              <Button variant="outlined" onClick={handleRetry}>
                Try another code
              </Button>
            </Box>
          )}
        </Container>
      </Box>
    </motion.div>
  );
}

// ─── Event Registration Section ───

// Format "2026-08-16" → "Saturday, August 16th 2026"
const formatEventDate = (dateStr) => {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr.replace(/-/g, '/'));
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const day = d.getDate();
    const suffix = [11, 12, 13].includes(day) ? 'th' : { 1: 'st', 2: 'nd', 3: 'rd' }[day % 10] || 'th';
    return `${days[d.getDay()]}, ${months[d.getMonth()]} ${day}${suffix} ${d.getFullYear()}`;
  } catch { return dateStr; }
};

// Format "14:45" → "2:45pm"
const formatEventTime = (timeStr) => {
  if (!timeStr) return '';
  try {
    const [h, m] = timeStr.split(':').map(Number);
    const ampm = h >= 12 ? 'pm' : 'am';
    const hr = h % 12 || 12;
    return m ? `${hr}:${String(m).padStart(2, '0')}${ampm}` : `${hr}${ampm}`;
  } catch { return timeStr; }
};

const EVENTS_API = 'https://svlh6ckfdkcgh4fbvub2nyz2r40mcvdq.lambda-url.us-east-1.on.aws';

function EventRegistrationSection({ config, navigate }) {
  const [events, setEvents] = useState(null);
  const [locations, setLocations] = useState(null);
  const [loading, setLoading] = useState(true);
  const [regCount, setRegCount] = useState(null);

  const targetEvent = useMemo(() => events?.find(e => e.id === config.eventId), [events, config.eventId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [evts, locs] = await Promise.all([fetchEvents(), fetchEventLocations()]);
        if (!cancelled) { setEvents(evts); setLocations(locs); }
      } catch (err) {
        console.error('[EventRegistration] fetch error:', err);
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  // Fetch registration count
  useEffect(() => {
    if (!config.eventId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(EVENTS_API, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'getRegistrationCount', eventId: config.eventId }),
        });
        const data = await res.json();
        if (!cancelled && data.success) setRegCount(data);
      } catch (err) {
        console.error('[EventRegistration] reg count error:', err);
      }
    })();
    return () => { cancelled = true; };
  }, [config.eventId]);

  const handleRegister = () => {
    navigate(`/events/${config.eventId}/register`);
  };

  if (loading) {
    return (
      <Box sx={{ py: 6, textAlign: 'center', bgcolor: config.backgroundColor || '#ffffff' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!targetEvent) {
    return (
      <Box sx={{ py: 6, textAlign: 'center', bgcolor: config.backgroundColor || '#ffffff' }}>
        <Container maxWidth="sm">
          <Alert severity="warning">Event not found.</Alert>
        </Container>
      </Box>
    );
  }

  const isTentpole = (targetEvent.type || '').toLowerCase() === 'tentpole' && Array.isArray(targetEvent.schedule);
  const today = new Date().toISOString().slice(0, 10);
  // Filter to future stops, preserving original indices for the events flow
  const futureStops = isTentpole
    ? targetEvent.schedule.map((stop, i) => ({ ...stop, originalIndex: i })).filter(s => !s.date || s.date >= today)
    : [];
  const hasMultipleStops = futureStops.length > 1;
  // If admin picked a specific stop, use it only if it's still future; otherwise fall through
  const adminStop = config.stopIndex != null && targetEvent.schedule?.[config.stopIndex];
  const adminStopIsFuture = adminStop && (!adminStop.date || adminStop.date >= today);
  const resolvedStopIndex = adminStopIsFuture ? config.stopIndex
    : (futureStops.length === 1) ? futureStops[0].originalIndex
    : null;

  // All stops past — registration closed
  if (isTentpole && futureStops.length === 0) {
    return (
      <motion.div variants={childFadeUp}>
        <Box sx={{ py: 3, bgcolor: config.backgroundColor || '#ffffff' }}>
          <Container maxWidth="sm" sx={{ textAlign: 'center' }}>
            <Typography sx={{ fontWeight: 700, mb: 1, fontSize: config.titleSize || '2.4rem' }}>
              {config.title || 'Registration Closed'}
            </Typography>
            <Typography sx={{ fontSize: '1.4rem', opacity: 0.6 }}>All dates for this event have passed.</Typography>
          </Container>
        </Box>
      </motion.div>
    );
  }

  return (
    <motion.div variants={childFadeUp}>
      <Box sx={{ py: 3, bgcolor: config.backgroundColor || '#ffffff' }}>
        <Container maxWidth="sm" sx={{ textAlign: 'center' }}>
          <Typography sx={{ fontWeight: 700, mb: 1, fontSize: config.titleSize || '2.4rem' }}>
            {config.title || 'Register Now'}
          </Typography>
          {config.subtitle && (
            <Typography sx={{ fontSize: config.subtitleSize || '1.4rem', mb: 3, opacity: 0.8 }}>
              {config.subtitle}
            </Typography>
          )}

          {/* Single CTA — admin picked a future stop, single future stop, or non-tentpole */}
          {(!hasMultipleStops || resolvedStopIndex != null) && (() => {
            const stop = isTentpole && resolvedStopIndex != null ? targetEvent.schedule[resolvedStopIndex] : null;
            const feeCents = stop ? (stop.admissionFeeCents || targetEvent.admissionFeeCents || 0) : (targetEvent.admissionFeeCents || 0);
            return (
              <>
                {stop && (() => {
                  const locName = locations?.find(l => l.id === stop.locationId)?.name || '';
                  return (
                    <Typography sx={{ fontSize: '1.4rem', mb: 1, color: 'text.secondary' }}>
                      {[locName, formatEventDate(stop.date), stop.startTime ? `at ${formatEventTime(stop.startTime)}` : ''].filter(Boolean).join(', ')}
                    </Typography>
                  );
                })()}
                {feeCents > 0 && (
                  <Typography sx={{ fontSize: '1.3rem', mb: 1, color: 'text.secondary' }}>
                    ${(feeCents / 100).toFixed(2)}
                  </Typography>
                )}
                {regCount && (() => {
                  const count = stop
                    ? (regCount.byDate?.[stop.date] || 0)
                    : regCount.total;
                  const capacity = stop
                    ? regCount.capacityByDate?.[stop.date]
                    : (regCount.capacityByDate ? Object.values(regCount.capacityByDate)[0] : null);
                  const isFull = capacity && count >= capacity;
                  if (count > 0 || isFull) {
                    return (
                      <Typography sx={{ fontSize: '1.3rem', mb: 3, color: isFull ? 'error.main' : 'text.secondary', fontWeight: isFull ? 600 : 500 }}>
                        {isFull
                          ? `Sold Out (${count}/${capacity})`
                          : capacity
                            ? `${count}/${capacity} spots filled`
                            : `${count} ${count === 1 ? 'person' : 'people'} registered`}
                      </Typography>
                    );
                  }
                  return null;
                })()}
                <Button
                  variant="contained"
                  size="large"
                  onClick={() => handleRegister(resolvedStopIndex)}
                  disabled={regCount && (() => {
                    const count = stop
                      ? (regCount.byDate?.[stop.date] || 0)
                      : regCount.total;
                    const capacity = stop
                      ? regCount.capacityByDate?.[stop.date]
                      : (regCount.capacityByDate ? Object.values(regCount.capacityByDate)[0] : null);
                    return capacity && count >= capacity;
                  })()}
                  sx={{ borderRadius: '30px', px: 5, py: 1.5, fontSize: '1.6rem', fontWeight: 700 }}
                >
                  {regCount && (() => {
                    const count = stop
                      ? (regCount.byDate?.[stop.date] || 0)
                      : regCount.total;
                    const capacity = stop
                      ? regCount.capacityByDate?.[stop.date]
                      : (regCount.capacityByDate ? Object.values(regCount.capacityByDate)[0] : null);
                    return capacity && count >= capacity ? 'Sold Out' : 'Register';
                  })() || 'Register'}
                </Button>
              </>
            );
          })()}

          {/* Multiple future stops — show stop picker inline */}
          {hasMultipleStops && resolvedStopIndex == null && (
            <Stack spacing={2} sx={{ mt: 2 }}>
              {[...futureStops].sort((a, b) => (a.date || '').localeCompare(b.date || '')).map((stop) => {
                const locName = locations?.find(l => l.id === stop.locationId)?.name || '';
                const timeLabel = stop.startTime && stop.endTime
                  ? `${formatEventTime(stop.startTime)} – ${formatEventTime(stop.endTime)}`
                  : stop.startTime ? `at ${formatEventTime(stop.startTime)}` : '';
                const stopFee = stop.admissionFeeCents || targetEvent.admissionFeeCents || 0;
                const stopCount = regCount?.byDate?.[stop.date] || 0;
                const stopCap = regCount?.capacityByDate?.[stop.date];
                const stopSoldOut = stopCap && stopCount >= stopCap;
                return (
                  <Button
                    key={stop.originalIndex}
                    variant="outlined"
                    onClick={() => handleRegister(stop.originalIndex)}
                    disabled={!!stopSoldOut}
                    sx={{ justifyContent: 'flex-start', textAlign: 'left', p: 2, textTransform: 'none', borderRadius: 2, opacity: stopSoldOut ? 0.6 : 1 }}
                  >
                    <Box>
                      {locName && <Typography variant="subtitle1" fontWeight={600}>{locName}</Typography>}
                      <Typography variant="body2" color={locName ? 'text.secondary' : 'text.primary'} fontWeight={locName ? 400 : 600}>
                        {formatEventDate(stop.date)}
                      </Typography>
                      {timeLabel && <Typography variant="body2" color="text.secondary">{timeLabel}</Typography>}
                      {stopFee > 0 && (
                        <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '1.2rem', mt: 0.5 }}>
                          ${(stopFee / 100).toFixed(2)}
                        </Typography>
                      )}
                      {regCount && (() => {
                        const count = regCount.byDate?.[stop.date] || 0;
                        const capacity = regCount.capacityByDate?.[stop.date];
                        const isFull = capacity && count >= capacity;
                        const remaining = capacity ? capacity - count : null;
                        if (isFull) {
                          return (
                            <Typography variant="body2" sx={{ color: 'error.main', fontWeight: 600, fontSize: '1.2rem', mt: 0.5 }}>
                              Sold Out
                            </Typography>
                          );
                        }
                        if (remaining !== null) {
                          return (
                            <Typography variant="body2" sx={{ color: 'success.main', fontWeight: 600, fontSize: '1.2rem', mt: 0.5 }}>
                              {remaining} spot{remaining !== 1 ? 's' : ''} remaining
                            </Typography>
                          );
                        }
                        if (count > 0) {
                          return (
                            <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '1.2rem', mt: 0.5 }}>
                              {count} registered
                            </Typography>
                          );
                        }
                        return null;
                      })()}
                    </Box>
                  </Button>
                );
              })}
            </Stack>
          )}
        </Container>
      </Box>
    </motion.div>
  );
}

// ─── Tournament Points Table ───

function TournamentPointsTableSection({ config }) {
  const [activeTab, setActiveTab] = useState(0);
  const brackets = config.brackets || [];
  const current = brackets[activeTab];
  const textColor = getTextColorForBackground(config.backgroundColor || '#ffffff');

  const ordinalSuffix = (n) => {
    if ([11, 12, 13].includes(n % 100)) return 'th';
    return { 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] || 'th';
  };

  return (
    <motion.div variants={childFadeUp}>
      <Box sx={{ width: '100vw', marginLeft: 'calc(-50vw + 50%)', backgroundColor: config.backgroundColor || '#ffffff', py: 3 }}>
        <Container maxWidth="sm">
          {config.title && (
            <Typography variant="h4" sx={{ fontWeight: 700, textAlign: 'center', mb: 0.5, color: textColor }}>
              {config.title}
            </Typography>
          )}
          {config.subtitle && (
            <Typography sx={{ textAlign: 'center', fontSize: '1.4rem', color: textColor, opacity: 0.7, mb: 3 }}>
              {config.subtitle}
            </Typography>
          )}

          {brackets.length > 0 && (
            <>
              <Tabs
                value={activeTab}
                onChange={(_, v) => setActiveTab(v)}
                centered
                sx={{
                  mb: 3,
                  '& .MuiTab-root': { fontSize: '1.3rem', fontWeight: 600, color: textColor, opacity: 0.6 },
                  '& .Mui-selected': { opacity: 1 },
                }}
              >
                {brackets.map((b, i) => (
                  <Tab key={i} label={b.label} />
                ))}
              </Tabs>

              {current && (
                <Box>
                  {(current.placements || []).map((p, i) => (
                    <Box
                      key={i}
                      sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        py: 1.5,
                        px: 2,
                        borderBottom: i < current.placements.length - 1 ? '1px solid' : 'none',
                        borderColor: textColor === '#ffffff' || textColor === 'white' ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)',
                        '&:hover': { bgcolor: textColor === '#ffffff' || textColor === 'white' ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)' },
                      }}
                    >
                      <Typography sx={{ fontSize: '1.5rem', fontWeight: i < 3 ? 700 : 500, color: textColor }}>
                        {p.place}{ordinalSuffix(p.place)} Place
                      </Typography>
                      <Typography sx={{ fontSize: '1.5rem', fontWeight: 700, color: textColor }}>
                        {p.points} pts
                      </Typography>
                    </Box>
                  ))}
                </Box>
              )}
            </>
          )}
        </Container>
      </Box>
    </motion.div>
  );
}

// ─── Events Section (card carousel or list) ───

// Format "2026-07-11" + "15:00" → "Saturday, July 11th at 3PM"
const formatStopDateTime = (dateStr, timeStr) => {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr.replace(/-/g, '/'));
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const day = d.getDate();
    const suffix = [11, 12, 13].includes(day) ? 'th' : { 1: 'st', 2: 'nd', 3: 'rd' }[day % 10] || 'th';
    let label = `${days[d.getDay()]}, ${months[d.getMonth()]} ${day}${suffix}`;
    if (timeStr) label += ` at ${formatEventTime(timeStr)}`;
    return label;
  } catch { return dateStr; }
};

function EventsSection({ config, navigate }) {
  const contentSource = config.contentSource || 'events';
  const [events, setEvents] = useState(null);
  const [locations, setLocations] = useState(null);
  const [loading, setLoading] = useState(true);
  const [regCounts, setRegCounts] = useState({});
  const [pages, setPages] = useState([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (contentSource === 'pages') {
          const p = await getPublishedPages();
          if (!cancelled) setPages(p);
        } else {
          const [evts, locs] = await Promise.all([fetchEvents(), fetchEventLocations()]);
          if (!cancelled) { setEvents(evts); setLocations(locs); }
        }
      } catch (err) {
        console.error('[EventsSection] fetch error:', err);
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [contentSource]);

  // Resolve which events to display
  const displayEvents = useMemo(() => {
    if (!events) return [];
    if (config.eventSource === 'manual' && config.eventIds?.length) {
      return config.eventIds.map(id => events.find(e => e.id === id)).filter(Boolean);
    }
    // upcoming: filter to active future events
    const today = new Date().toISOString().slice(0, 10);
    return events
      .filter(e => {
        if (e.status && e.status !== 'Active') return false;
        const isTentpole = (e.type || '').toLowerCase() === 'tentpole' && Array.isArray(e.schedule);
        if (isTentpole) return e.schedule.some(s => s.date >= today);
        return e.startDate >= today || e.endDate >= today;
      })
      .sort((a, b) => (a.startDate || '').localeCompare(b.startDate || ''))
      .slice(0, config.maxEvents || 3);
  }, [events, config.eventSource, config.eventIds, config.maxEvents]);

  // Fetch reg counts for displayed events
  useEffect(() => {
    if (!displayEvents.length) return;
    let cancelled = false;
    displayEvents.forEach(async (ev) => {
      try {
        const res = await fetch(EVENTS_API, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'getRegistrationCount', eventId: ev.id }),
        });
        const data = await res.json();
        if (!cancelled && data.success) setRegCounts(prev => ({ ...prev, [ev.id]: data }));
      } catch {}
    });
    return () => { cancelled = true; };
  }, [displayEvents.map(e => e.id).join(',')]);

  if (loading) {
    return (
      <Box sx={{ py: 6, textAlign: 'center', bgcolor: config.backgroundColor || 'white' }}>
        <CircularProgress />
      </Box>
    );
  }

  // ── Pages content source ──
  if (contentSource === 'pages') {
    const pageCards = config.pageCards || [];
    if (!pageCards.length) return null;
    const displayPages = pageCards
      .map(pc => {
        const page = pages.find(p => p.id === pc.pageId);
        return page ? { ...page, cardImageUrl: pc.imageUrl } : null;
      })
      .filter(Boolean);
    if (!displayPages.length) return null;

    const isCardList = config.displayFormat === 'card-list';

    return (
      <motion.div variants={childFadeUp}>
        <Box sx={{ py: 3, bgcolor: config.backgroundColor || 'white' }}>
          <Container maxWidth="md">
            {config.title && (
              <Typography sx={{ fontWeight: 700, mb: 0.5, fontSize: '2rem' }}>{config.title}</Typography>
            )}
            {config.subtitle && (
              <Typography sx={{ fontSize: '1.4rem', mb: 2, opacity: 0.8 }}>{config.subtitle}</Typography>
            )}
            <Box sx={{
              display: 'flex',
              gap: 2,
              overflowX: isCardList ? { xs: 'visible', md: 'auto' } : 'auto',
              flexDirection: isCardList ? { xs: 'column', md: 'row' } : 'row',
              pb: 2,
              scrollSnapType: isCardList ? { xs: 'none', md: 'x mandatory' } : 'x mandatory',
            }}>
              {displayPages.map((page) => (
                <Box
                  key={page.id}
                  onClick={() => navigate(page.slug.startsWith('/') ? page.slug : `/${page.slug}`)}
                  sx={{
                    flexShrink: isCardList ? { xs: 1, md: 0 } : 0,
                    width: isCardList ? { xs: '100%', md: 300 } : 300,
                    cursor: 'pointer',
                    borderRadius: 2,
                    overflow: 'hidden',
                    border: '1px solid',
                    borderColor: 'grey.300',
                    scrollSnapAlign: 'start',
                    transition: 'transform 0.2s, box-shadow 0.2s',
                    '&:hover': { transform: 'scale(1.02)', boxShadow: 6 },
                  }}
                >
                  <Box sx={{ pt: '56.25%', bgcolor: 'grey.200', position: 'relative' }}>
                    {page.cardImageUrl ? (
                      <img src={page.cardImageUrl} alt={page.title} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <Typography sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', color: 'grey.400', fontSize: '1.2rem' }}>
                        No Image
                      </Typography>
                    )}
                  </Box>
                  <Box sx={{ p: 2 }}>
                    <Typography sx={{ fontWeight: 600, fontSize: '1.4rem' }} noWrap>{page.title}</Typography>
                  </Box>
                </Box>
              ))}
            </Box>
          </Container>
        </Box>
      </motion.div>
    );
  }

  if (!displayEvents.length) return null;

  const isListFormat = config.displayFormat === 'list';
  const isCardList = config.displayFormat === 'card-list';

  // ── List format: vertical stop cards ──
  if (isListFormat) {
    // Build a flat list of stops from all display events
    const today = new Date().toISOString().slice(0, 10);
    const allStops = [];
    displayEvents.forEach(ev => {
      const isTentpole = (ev.type || '').toLowerCase() === 'tentpole' && Array.isArray(ev.schedule);
      if (isTentpole) {
        // If admin picked specific stops via eventStops, use those; otherwise show all future stops
        const pickedStopIdx = config.eventStops?.[ev.id];
        if (pickedStopIdx != null && ev.schedule[pickedStopIdx]) {
          allStops.push({ event: ev, stop: ev.schedule[pickedStopIdx], stopIndex: pickedStopIdx });
        } else {
          ev.schedule.forEach((stop, i) => {
            if (!stop.date || stop.date >= today) {
              allStops.push({ event: ev, stop, stopIndex: i });
            }
          });
        }
      } else {
        // Non-tentpole: single entry
        allStops.push({ event: ev, stop: null, stopIndex: null });
      }
    });
    allStops.sort((a, b) => ((a.stop?.date || a.event.startDate || '').localeCompare(b.stop?.date || b.event.startDate || '')));

    if (!allStops.length) return null;

    return (
      <motion.div variants={childFadeUp}>
        <Box sx={{ py: 3, bgcolor: config.backgroundColor || 'white' }}>
          <Container maxWidth="sm" sx={{ textAlign: 'center' }}>
            {config.title && (
              <Typography sx={{ fontWeight: 700, mb: 1, fontSize: '2rem' }}>
                {config.title}
              </Typography>
            )}
            {config.subtitle && (
              <Typography sx={{ fontSize: '1.4rem', mb: 3, opacity: 0.8 }}>
                {config.subtitle}
              </Typography>
            )}
            <Stack spacing={2}>
              {allStops.map(({ event: ev, stop, stopIndex }, i) => {
                const regCount = regCounts[ev.id];
                const locName = stop ? (locations?.find(l => l.id === stop.locationId)?.name || '') : '';
                const dateLabel = stop
                  ? formatStopDateTime(stop.date, stop.startTime)
                  : formatEventDate(ev.startDate);
                const count = stop ? (regCount?.byDate?.[stop.date] || 0) : (regCount?.total || 0);
                const capacity = stop ? regCount?.capacityByDate?.[stop.date] : null;
                const isFull = capacity && count >= capacity;
                const remaining = capacity ? capacity - count : null;

                const handleClick = () => {
                  sessionStorage.setItem('eventDeepLinkReturn', window.location.pathname);
                  navigate(`/events/${ev.id}/register`, { state: { stopIndex } });
                };

                return (
                  <Button
                    key={`${ev.id}-${stopIndex ?? 'all'}-${i}`}
                    variant="outlined"
                    onClick={handleClick}
                    disabled={!!isFull}
                    sx={{ justifyContent: 'flex-start', textAlign: 'left', p: 2, textTransform: 'none', borderRadius: 2, opacity: isFull ? 0.6 : 1 }}
                  >
                    <Box>
                      {(locName || ev.title) && (
                        <Typography variant="subtitle1" fontWeight={600}>
                          {locName || ev.title}
                        </Typography>
                      )}
                      <Typography variant="body2" color="text.secondary">
                        {dateLabel}
                      </Typography>
                      {isFull && (
                        <Typography variant="body2" sx={{ color: 'error.main', fontWeight: 600, mt: 0.5 }}>
                          Sold Out
                        </Typography>
                      )}
                      {!isFull && remaining !== null && (
                        <Typography variant="body2" sx={{ color: 'success.main', fontWeight: 600, mt: 0.5 }}>
                          {remaining} spot{remaining !== 1 ? 's' : ''} remaining
                        </Typography>
                      )}
                      {!isFull && remaining === null && count > 0 && (
                        <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
                          {count} registered
                        </Typography>
                      )}
                    </Box>
                  </Button>
                );
              })}
            </Stack>
          </Container>
        </Box>
      </motion.div>
    );
  }

  // ── Card / Card List format ──
  return (
    <motion.div variants={childFadeUp}>
      <Box sx={{ py: 3, bgcolor: config.backgroundColor || 'white' }}>
        <Container maxWidth="md">
          {config.title && (
            <Typography sx={{ fontWeight: 700, mb: 0.5, fontSize: '2rem' }}>
              {config.title}
            </Typography>
          )}
          {config.subtitle && (
            <Typography sx={{ fontSize: '1.4rem', mb: 2, opacity: 0.8 }}>
              {config.subtitle}
            </Typography>
          )}
          <Box sx={{
            display: 'flex',
            gap: 2,
            overflowX: isCardList ? { xs: 'visible', md: 'auto' } : 'auto',
            flexDirection: isCardList ? { xs: 'column', md: 'row' } : 'row',
            pb: 2,
            scrollSnapType: isCardList ? { xs: 'none', md: 'x mandatory' } : 'x mandatory',
          }}>
            {displayEvents.map((ev) => {
              const isTentpole = (ev.type || '').toLowerCase() === 'tentpole' && Array.isArray(ev.schedule);
              const today = new Date().toISOString().slice(0, 10);
              const pickedStopIdx = config.eventStops?.[ev.id];
              const actualStopIdx = isTentpole
                ? (pickedStopIdx != null ? pickedStopIdx : ev.schedule.findIndex((s, si) => s.date >= today || si === ev.schedule.length - 1))
                : null;
              const displayStop = isTentpole
                ? (actualStopIdx != null ? ev.schedule[actualStopIdx] : null)
                : null;
              const dateLabel = displayStop
                ? formatStopDateTime(displayStop.date, displayStop.startTime)
                : formatEventDate(ev.startDate);
              const locName = displayStop ? (locations?.find(l => l.id === displayStop.locationId)?.name || '') : '';

              const handleClick = () => {
                sessionStorage.setItem('eventDeepLinkReturn', window.location.pathname);
                navigate(`/events/${ev.id}/register`, { state: { stopIndex: actualStopIdx } });
              };

              return (
                <Box
                  key={ev.id}
                  onClick={handleClick}
                  sx={{
                    flexShrink: isCardList ? { xs: 1, md: 0 } : 0,
                    width: isCardList ? { xs: '100%', md: 300 } : 300,
                    cursor: 'pointer',
                    borderRadius: 2,
                    overflow: 'hidden',
                    border: '1px solid',
                    borderColor: 'grey.300',
                    scrollSnapAlign: 'start',
                    transition: 'transform 0.2s, box-shadow 0.2s',
                    '&:hover': { transform: 'scale(1.02)', boxShadow: 6 },
                  }}
                >
                  <Box sx={{ pt: '56.25%', bgcolor: 'grey.200', position: 'relative' }}>
                    {ev.imageUrl ? (
                      <img src={ev.imageUrl} alt={ev.title} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <Typography sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', color: 'grey.400', fontSize: '1.2rem' }}>
                        No Image
                      </Typography>
                    )}
                  </Box>
                  <Box sx={{ p: 2 }}>
                    <Typography sx={{ fontWeight: 600, fontSize: '1.4rem' }} noWrap>{ev.title}</Typography>
                    <Typography sx={{ color: 'grey.500', fontSize: '1.2rem' }}>
                      {[locName, dateLabel].filter(Boolean).join(' — ')}
                    </Typography>
                  </Box>
                </Box>
              );
            })}
          </Box>
        </Container>
      </Box>
    </motion.div>
  );
}

// ─── Event Capacity List ───

function EventCapacitySection({ config, navigate }) {
  const [events, setEvents] = useState(null);
  const [locations, setLocations] = useState(null);
  const [regCounts, setRegCounts] = useState({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [evts, locs] = await Promise.all([fetchEvents(), fetchEventLocations()]);
        if (!cancelled) { setEvents(evts); setLocations(locs); }
      } catch (err) { console.error('[EventCapacity] fetch error:', err); }
    })();
    return () => { cancelled = true; };
  }, []);

  // Support both new multi-event (eventIds) and legacy single-event (eventId)
  const eventIds = config.eventIds?.length ? config.eventIds : config.eventId ? [config.eventId] : [];

  useEffect(() => {
    if (!eventIds.length) return;
    let cancelled = false;
    eventIds.forEach(async (eid) => {
      try {
        const res = await fetch(EVENTS_API, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'getRegistrationCount', eventId: eid }),
        });
        const data = await res.json();
        if (!cancelled && data.success) setRegCounts(prev => ({ ...prev, [eid]: data }));
      } catch {}
    });
    return () => { cancelled = true; };
  }, [eventIds.join(',')]);

  const selectedEvents = useMemo(() =>
    eventIds.map(id => events?.find(e => e.id === id)).filter(Boolean),
    [events, eventIds.join(',')]
  );

  if (!selectedEvents.length) return null;

  const today = new Date().toISOString().slice(0, 10);

  // Build flat list of all stops across all selected events
  const allStops = selectedEvents.flatMap(ev => {
    const isTentpole = (ev.type || '').toLowerCase() === 'tentpole' && Array.isArray(ev.schedule);
    if (!isTentpole) return [{ event: ev, stop: { date: ev.startDate }, stopIndex: null }];
    const stopIdx = config.eventStops?.[ev.id];
    const stopsWithIdx = ev.schedule.map((stop, i) => ({ ...stop, originalIndex: i }));
    const stops = stopIdx != null
      ? [stopsWithIdx[stopIdx]].filter(Boolean)
      : stopsWithIdx.filter(s => s.date >= today);
    return stops.map(stop => ({ event: ev, stop, stopIndex: stop.originalIndex }));
  });

  if (!allStops.length) return null;

  return (
    <motion.div variants={childFadeUp}>
      <Box sx={{ py: 1, bgcolor: config.backgroundColor || 'white' }}>
        <Container maxWidth="sm">
          {config.title && (
            <Typography sx={{ fontWeight: 700, mb: 1, fontSize: '2rem', textAlign: 'center' }}>
              {config.title}
            </Typography>
          )}
          <Stack spacing={0.5}>
            {allStops.map(({ event: ev, stop, stopIndex }, i) => {
              const regCount = regCounts[ev.id];
              const locIdx = ev.locationIds?.indexOf(stop.locationId);
              const locName = locIdx >= 0 ? (ev.locationNames?.[locIdx] || '') : locations?.find(l => l.id === stop.locationId)?.name || '';
              const count = regCount?.byDate?.[stop.date] || 0;
              const capacity = regCount?.capacityByDate?.[stop.date];
              const isFull = capacity && count >= capacity;
              const remaining = capacity ? capacity - count : null;

              const spotsText = isFull
                ? 'Sold Out'
                : remaining !== null
                  ? `${remaining} spot${remaining !== 1 ? 's' : ''} left`
                  : count > 0 ? `${count} registered` : 'Open';

              const handleClick = () => {
                sessionStorage.setItem('eventDeepLinkReturn', window.location.pathname);
                navigate(`/events/${ev.id}/register`, { state: { stopIndex } });
              };

              return (
                <Typography
                  key={`${ev.id}-${stop.date || i}`}
                  component="div"
                  variant="body1"
                  onClick={isFull ? undefined : handleClick}
                  sx={{
                    textAlign: 'center',
                    color: isFull ? 'error.main' : 'text.primary',
                    cursor: isFull ? 'default' : 'pointer',
                    '&:hover': isFull ? {} : { textDecoration: 'underline' },
                  }}
                >
                  {locName && <>{locName} – </>}
                  <Box component="span" sx={{ fontWeight: 600 }}>{spotsText}</Box>
                </Typography>
              );
            })}
          </Stack>
        </Container>
      </Box>
    </motion.div>
  );
}

// ─── Image Grid Section ───

function ImageGridSection({ config, navigate }) {
  const items = config.items || [];
  if (!items.length) return null;
  const columns = config.columns || 3;

  return (
    <motion.div variants={childFadeUp}>
      <Box sx={{ py: 4, bgcolor: config.backgroundColor || 'white' }}>
        <Container maxWidth="lg">
          <Box sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr 1fr', md: `repeat(${columns}, 1fr)` },
            gap: `${config.gap || 16}px`,
          }}>
            {items.map((item, i) => (
              <Box
                key={item.id || i}
                onClick={() => item.pageSlug && navigate(item.pageSlug)}
                sx={{ cursor: item.pageSlug ? 'pointer' : 'default', borderRadius: 2, overflow: 'hidden' }}
              >
                <img src={item.imageUrl} alt={item.alt || ''} style={{ width: '100%', height: 'auto', display: 'block' }} />
              </Box>
            ))}
          </Box>
        </Container>
      </Box>
    </motion.div>
  );
}

// ─── Deck Viewer ───

const DECK_API = 'https://7v5tkrjm5liwpiu4bpqluyzzza0mdupf.lambda-url.us-east-1.on.aws';

function DeckViewerSection({ config }) {
  const [liveCards, setLiveCards] = useState(null);

  useEffect(() => {
    if (!config.deckId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(DECK_API, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'getPublicDeck', deckId: config.deckId }),
        });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && data.deck?.cards?.length) setLiveCards(data.deck.cards);
      } catch (err) {
        console.error('[DeckViewer] live fetch error:', err);
      }
    })();
    return () => { cancelled = true; };
  }, [config.deckId]);

  const cards = liveCards || config.cards || [];
  const columns = config.columns || 4;
  const notes = config.notes || {};
  const showNumber = config.showCardNumber;
  const cardById = useMemo(() => Object.fromEntries(cards.map((c, i) => [c.id || i, c])), [cards]);

  // Curated sections take precedence; else fall back to the old category grouping / flat list.
  const renderSections = useMemo(() => {
    if (Array.isArray(config.sections) && config.sections.length) {
      const assigned = new Set(config.sections.flatMap(s => s.cardIds || []));
      const out = config.sections.map(s => ({
        title: s.title, level: s.level || 1,
        cards: (s.cardIds || []).map(id => cardById[id]).filter(Boolean),
      }));
      const unsorted = cards.filter(c => !assigned.has(c.id));
      if (unsorted.length) out.push({ title: '', level: 1, cards: unsorted });
      return out;
    }
    if (config.groupByCategory) {
      const g = {};
      for (const c of cards) { const cat = c.category || 'Other'; (g[cat] = g[cat] || []).push(c); }
      return Object.entries(g).map(([title, cs]) => ({ title, level: 1, cards: cs }));
    }
    return [{ title: '', level: 1, cards }];
  }, [config.sections, config.groupByCategory, cards, cardById]);

  const cardNumberLabel = (c) => [c.setCode || c.setName, c.number].filter(Boolean).join(' ');
  const sizeMap = { small: 120, medium: 180, large: 260 };
  const maxW = sizeMap[config.cardSize] || sizeMap.medium;

  if (!cards.length) return null;

  return (
    <motion.div variants={childFadeUp}>
      <Box sx={{ py: 4, bgcolor: config.backgroundColor || 'white' }}>
        <Container maxWidth="lg">
          {(config.title || config.subtitle) && (
            <Box sx={{ textAlign: 'center', mb: 3 }}>
              {config.title && <Typography variant="h5" sx={{ fontWeight: 700 }}>{config.title}</Typography>}
              {config.subtitle && <Typography variant="body1" color="text.secondary" sx={{ mt: 0.5 }}>{config.subtitle}</Typography>}
            </Box>
          )}
          {renderSections.map((sec, si) => sec.cards.length ? (
            <Box key={si} sx={{ mb: 3, ml: sec.level === 2 ? { xs: 1, md: 3 } : 0 }}>
              {sec.title && (
                <Typography variant={sec.level === 2 ? 'subtitle1' : 'h6'} sx={{ fontWeight: 700, mb: 1.5, color: sec.level === 2 ? 'text.secondary' : 'text.primary' }}>
                  {sec.title}
                </Typography>
              )}
              <Box sx={{
                display: 'grid',
                gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: `repeat(${columns}, 1fr)` },
                gap: 1.5,
              }}>
                {sec.cards.map((card, i) => {
                  const note = notes[card.id];
                  const num = showNumber ? cardNumberLabel(card) : '';
                  return (
                    <Box key={card.id || i} sx={{ maxWidth: maxW, width: '100%' }}>
                      <Box sx={{ position: 'relative' }}>
                        {card.imageUrl || card.imageUrlSmall ? (
                          <img
                            src={card.imageUrlSmall || card.imageUrl}
                            alt={card.name}
                            style={{ width: '100%', height: 'auto', borderRadius: 8, display: 'block' }}
                          />
                        ) : (
                          <Box sx={{
                            width: '100%', paddingTop: '140%', borderRadius: 2, bgcolor: 'grey.200',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative',
                          }}>
                            <Typography variant="caption" sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)' }}>
                              {card.name}
                            </Typography>
                          </Box>
                        )}
                        {card.quantity > 1 && (
                          <Box sx={{
                            position: 'absolute', bottom: 6, right: 6,
                            bgcolor: 'rgba(0,0,0,0.7)', color: 'white',
                            borderRadius: 1, px: 0.8, py: 0.2,
                            fontWeight: 700, fontSize: '0.85rem', lineHeight: 1.4,
                          }}>
                            &times;{card.quantity}
                          </Box>
                        )}
                      </Box>
                      {(num || note) && (
                        <Box sx={{ mt: 0.5, textAlign: 'center' }}>
                          {num && <Typography variant="caption" sx={{ fontWeight: 700, display: 'block', color: 'text.secondary' }}>{num}</Typography>}
                          {note && <Typography variant="caption" sx={{ display: 'block', lineHeight: 1.35 }}>{note}</Typography>}
                        </Box>
                      )}
                    </Box>
                  );
                })}
              </Box>
            </Box>
          ) : null)}
        </Container>
      </Box>
    </motion.div>
  );
}

// ─── Video Submission (User-Generated Content upload) ───

const UGC_MAX_BYTES = 500 * 1024 * 1024; // 500 MB

function ugcToE164(p) {
  const raw = String(p || '').trim();
  const d = raw.replace(/\D/g, '');
  if (raw.startsWith('+')) return '+' + d;
  if (d.length === 10) return '+1' + d;
  if (d.length === 11 && d[0] === '1') return '+' + d;
  return '+1' + d;
}

// Best-effort: grab a poster frame from the chosen video (skipped silently if the
// browser can't decode it, e.g. some iPhone .mov). Returns base64 (no data-url prefix).
function ugcCapturePoster(file) {
  return new Promise((resolve) => {
    try {
      const url = URL.createObjectURL(file);
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.muted = true;
      video.playsInline = true;
      video.src = url;
      const done = (val) => { URL.revokeObjectURL(url); resolve(val); };
      const timer = setTimeout(() => done(null), 6000);
      video.onloadedmetadata = () => { try { video.currentTime = Math.min(1, (video.duration || 2) / 2); } catch { /* noop */ } };
      video.onseeked = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = video.videoWidth || 640;
          canvas.height = video.videoHeight || 360;
          canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
          clearTimeout(timer);
          done((canvas.toDataURL('image/jpeg', 0.7).split(',')[1]) || null);
        } catch { clearTimeout(timer); done(null); }
      };
      video.onerror = () => { clearTimeout(timer); done(null); };
    } catch { resolve(null); }
  });
}

// PUT the file straight to S3 with real upload progress (fetch has no progress events).
function ugcPutToS3(url, file, contentType, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    xhr.setRequestHeader('Content-Type', contentType);
    xhr.upload.onprogress = (e) => { if (e.lengthComputable && onProgress) onProgress(e.loaded / e.total); };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload failed (${xhr.status})`)));
    xhr.onerror = () => reject(new Error('Upload failed — check your connection'));
    xhr.send(file);
  });
}

function AssetUploadSection({ config }) {
  const accent = config.accentColor || '#e91e63';
  const [file, setFile] = useState(null);
  const [firstName, setFirstName] = useState('');
  const [phone, setPhone] = useState('');
  const [consent, setConsent] = useState(false);
  const [step, setStep] = useState('form'); // form | code | uploading | done
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  const phoneDigits = phone.replace(/\D/g, '');
  const phoneValid = phoneDigits.length === 10 || (phoneDigits.length === 11 && phoneDigits[0] === '1');
  const canSend = file && firstName.trim() && phoneValid && consent && !busy;

  const pickFile = (e) => {
    setError('');
    const f = e.target.files?.[0];
    if (!f) return;
    if (!(f.type || '').startsWith('video/') && !/\.(mp4|mov|webm|m4v|3gp)$/i.test(f.name)) {
      setError('Please choose a video file.'); return;
    }
    if (f.size > UGC_MAX_BYTES) {
      setError('That video is larger than 500 MB. Please choose a shorter clip.'); return;
    }
    setFile(f);
  };

  const post = async (body) => {
    const r = await fetch(ASSET_API_URL, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok || data.success === false) throw new Error(data.error || 'Something went wrong. Please try again.');
    return data;
  };

  const sendCode = async () => {
    if (!canSend) return;
    setBusy(true); setError('');
    try {
      const r = await fetch(OTP_VERIFY_URL, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sendOtp', to: ugcToE164(phone), channel: 'sms' }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok || data.success === false) throw new Error(data.error || data.message || 'Could not send code');
      setStep('code');
    } catch (e) {
      setError(e.message || 'Could not send the verification code.');
    } finally {
      setBusy(false);
    }
  };

  const verifyAndUpload = async () => {
    if (code.length !== 6 || busy) return;
    setBusy(true); setError('');
    try {
      // 1) Server-side OTP check + find/create customer -> session token
      const start = await post({ action: 'ugcStart', phone: ugcToE164(phone), firstName: firstName.trim(), code, consent: true });
      // 2) Presigned upload
      const contentType = file.type || 'video/mp4';
      const req = await post({ action: 'ugcRequestUpload', sessionToken: start.sessionToken, filename: file.name, contentType, sizeBytes: file.size });
      // 3) Direct-to-S3 PUT with progress
      setStep('uploading'); setProgress(0);
      await ugcPutToS3(req.uploadUrl, file, contentType, setProgress);
      // 4) Poster frame (best-effort) + finalize into "User-Generated Content"
      const thumbnailB64 = await ugcCapturePoster(file);
      await post({ action: 'ugcFinalize', uploadToken: req.uploadToken, thumbnailB64 });
      setStep('done');
    } catch (e) {
      setError(e.message || 'Submission failed. Please try again.');
      setStep('code');
    } finally {
      setBusy(false);
    }
  };

  return (
    <motion.div variants={childFadeUp}>
      <Box sx={{ py: 5, bgcolor: config.backgroundColor || '#ffffff' }}>
        <Container maxWidth="sm">
          <Box sx={{ textAlign: 'center', mb: 3 }}>
            {config.title && <Typography variant="h5" sx={{ fontWeight: 700 }}>{config.title}</Typography>}
            {config.subtitle && <Typography variant="body1" color="text.secondary" sx={{ mt: 1 }}>{config.subtitle}</Typography>}
          </Box>

          {step === 'done' ? (
            <Alert severity="success" sx={{ borderRadius: 2 }}>
              {config.successMessage || 'Thanks! Your video was submitted successfully.'}
            </Alert>
          ) : (
            <Box sx={{ p: { xs: 2, sm: 3 }, border: '1px solid', borderColor: 'divider', borderRadius: 3 }}>
              {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

              {(step === 'form') && (
                <Stack spacing={2}>
                  <input ref={fileInputRef} type="file" accept="video/*" onChange={pickFile} style={{ display: 'none' }} />
                  <Button
                    fullWidth variant={file ? 'outlined' : 'contained'} size="large"
                    onClick={() => fileInputRef.current?.click()}
                    sx={file ? {} : { bgcolor: accent, '&:hover': { bgcolor: accent, filter: 'brightness(0.92)' } }}
                  >
                    {file ? `✓ ${file.name.length > 28 ? file.name.slice(0, 28) + '…' : file.name}` : (config.buttonLabel || 'Choose video')}
                  </Button>
                  {file && (
                    <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center', mt: -1 }}>
                      {(file.size / (1024 * 1024)).toFixed(1)} MB — tap above to change
                    </Typography>
                  )}
                  <TextField label="Your name" size="small" fullWidth value={firstName} onChange={e => setFirstName(e.target.value)} />
                  <TextField label="Mobile number" type="tel" size="small" fullWidth value={phone} onChange={e => setPhone(e.target.value)} placeholder="(555) 555-5555" />
                  <FormControlLabel
                    control={<Checkbox checked={consent} onChange={e => setConsent(e.target.checked)} sx={{ '&.Mui-checked': { color: accent } }} />}
                    label={<Typography variant="caption" color="text.secondary">{config.consentText || 'I grant permission to use this video.'}</Typography>}
                    sx={{ alignItems: 'flex-start', m: 0 }}
                  />
                  <Button
                    fullWidth variant="contained" size="large" disabled={!canSend}
                    onClick={sendCode}
                    startIcon={busy ? <CircularProgress size={16} color="inherit" /> : null}
                    sx={{ bgcolor: accent, '&:hover': { bgcolor: accent, filter: 'brightness(0.92)' } }}
                  >
                    {busy ? 'Sending…' : (config.submitLabel || 'Verify & Submit')}
                  </Button>
                </Stack>
              )}

              {step === 'code' && (
                <Stack spacing={2} alignItems="center">
                  <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center' }}>
                    Enter the 6-digit code we texted to {phone}.
                  </Typography>
                  <OtpInput onCodeChange={setCode} />
                  <Button
                    fullWidth variant="contained" size="large" disabled={code.length !== 6 || busy}
                    onClick={verifyAndUpload}
                    startIcon={busy ? <CircularProgress size={16} color="inherit" /> : null}
                    sx={{ bgcolor: accent, '&:hover': { bgcolor: accent, filter: 'brightness(0.92)' } }}
                  >
                    {busy ? 'Verifying…' : 'Verify & Upload'}
                  </Button>
                  <Button size="small" color="inherit" onClick={() => { setStep('form'); setError(''); }}>Back</Button>
                </Stack>
              )}

              {step === 'uploading' && (
                <Stack spacing={2} sx={{ py: 2 }}>
                  <Typography variant="body2" sx={{ textAlign: 'center' }}>Uploading your video… {Math.round(progress * 100)}%</Typography>
                  <LinearProgress variant="determinate" value={Math.round(progress * 100)} sx={{ height: 8, borderRadius: 4, '& .MuiLinearProgress-bar': { bgcolor: accent } }} />
                  <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center' }}>Keep this page open until it finishes.</Typography>
                </Stack>
              )}
            </Box>
          )}
        </Container>
      </Box>
    </motion.div>
  );
}

// ─── Page Title ───

function PageTitleSection({ config }) {
  return (
    <motion.div variants={childFadeUp}>
      <Box sx={{ bgcolor: config.backgroundColor || 'white', pt: config.paddingTop || '48px', pb: config.paddingBottom || '32px' }}>
        <Container maxWidth="lg" sx={{ textAlign: config.alignment || 'center' }}>
          <Typography sx={{ fontWeight: 700, fontSize: config.titleSize || '3rem', color: config.titleColor || '#1a1a1a', mb: config.subtitle ? 1 : 0 }}>
            {config.title || ''}
          </Typography>
          {config.subtitle && (
            <Typography sx={{ fontSize: config.subtitleSize || '1.4rem', color: config.subtitleColor || '#666666' }}>
              {config.subtitle}
            </Typography>
          )}
          {config.showDivider && (
            <Box sx={{ mt: 2, mx: config.alignment === 'center' ? 'auto' : config.alignment === 'right' ? '0 0 0 auto' : 0, width: 120, borderBottom: '2px solid', borderColor: 'divider' }} />
          )}
        </Container>
      </Box>
    </motion.div>
  );
}

// ─── Section Router ───

function PageSection({ section, allProducts, navigate, onProductClick, localCart }) {
  const { type, config } = section;
  if (!config) return null;

  const content = (() => { switch (type) {
    case 'hero': return <HeroSection config={config} navigate={navigate} />;
    case 'product-carousel': return <ProductCarouselSection config={config} allProducts={allProducts} onProductClick={onProductClick} />;
    case 'product-grid': return <ProductGridSection config={config} allProducts={allProducts} onProductClick={onProductClick} />;
    case 'cta-buttons': return <CtaButtonsSection config={config} navigate={navigate} />;
    case 'page-carousel': return <PageCarouselSection config={config} navigate={navigate} />;
    case 'text': case 'text-block': return <TextSection config={config} />;
    case 'image': case 'image-block': return <ImageSection config={config} />;
    case 'offer-redemption': return <OfferRedemptionSection config={config} allProducts={allProducts} navigate={navigate} localCart={localCart} />;
    case 'event-registration': return <EventRegistrationSection config={config} navigate={navigate} />;
    case 'event-carousel': return <EventsSection config={config} navigate={navigate} />;
    case 'tournament-points-table': return <TournamentPointsTableSection config={config} />;
    case 'event-capacity': return <EventCapacitySection config={config} navigate={navigate} />;
    case 'image-grid': return <ImageGridSection config={config} navigate={navigate} />;
    case 'deck-viewer': return <DeckViewerSection config={config} />;
    case 'assetUpload': return <AssetUploadSection config={config} />;
    case 'page-title': return <PageTitleSection config={config} />;
    default:
      console.warn(`[CustomPage] Unknown section type: ${type}`);
      return null;
  } })();

  if (!content) return null;
  return <div id={section.id ? `section-${section.id}` : undefined}>{content}</div>;
}

// ─── Main Page Component ───

export default function CustomPage() {
  const params = useParams();
  const slug = params['*'] || params.slug;
  const navigate = useNavigate();
  const { allProducts } = useCatalog();
  const { actorRef, sendToCommerce } = React.useContext(LayoutContext);
  const localCart = useCart();
  const showCartDrawer = useSelector(actorRef, (s) => s?.context?.showCartDrawer);
  const [pageConfig, setPageConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [collapseTransition, setCollapseTransition] = useState(null);
  // Read collapse transition data synchronously (before first render) so we can skip entrance animations
  const collapseDataRef = useRef(() => {
    const raw = sessionStorage.getItem('customPage_collapseTransition');
    if (raw) {
      sessionStorage.removeItem('customPage_collapseTransition');
      try { return JSON.parse(raw); } catch (e) { /* ignore */ }
    }
    return null;
  });
  const [returningFromProduct] = useState(() => {
    const data = collapseDataRef.current;
    if (typeof data === 'function') {
      const result = data();
      collapseDataRef.current = result;
      return !!result;
    }
    return !!data;
  });

  useEffect(() => {
    setLoading(true);
    setNotFound(false);
    setPageConfig(null);
    getPageConfig(`/${slug}`).then(result => {
      if (result && result.redirect && result.targetSlug) {
        navigate(result.targetSlug, { replace: true });
        return;
      }
      if (result && result.notFound) {
        // Custom 404 page from the page builder
        if (result.status === 'published' && result.sections?.length > 0) {
          setPageConfig(result);
          setNotFound(true);
        } else {
          setNotFound(true);
        }
      } else if (result && result.status === 'published') {
        setPageConfig(result);
      } else {
        setNotFound(true);
      }
      setLoading(false);
    });
  }, [slug]);

  const handleProductClick = useCallback((productId) => {
    sessionStorage.setItem(`customPage_scroll_${slug}`, String(window.scrollY));
    navigate(`/product/${productId}`, { state: { returnTo: `/${slug}` } });
  }, [navigate, slug]);

  // Restore scroll position when returning from product detail, then start collapse animation
  useLayoutEffect(() => {
    if (!loading && pageConfig) {
      const saved = sessionStorage.getItem(`customPage_scroll_${slug}`);
      if (saved) {
        window.scrollTo({ top: parseInt(saved, 10), behavior: 'instant' });
        sessionStorage.removeItem(`customPage_scroll_${slug}`);
      }

      // After scroll + render, find the target card and start collapse animation
      const data = collapseDataRef.current;
      if (data) {
        collapseDataRef.current = null;
        // Start with image covering the hero area (where it was on the product detail page)
        const wideLayout = data.wideLayout;
        setCollapseTransition({
          imgSrc: data.imgSrc,
          productId: data.productId,
          wideLayout,
          // Start rect: product detail hero position
          startRect: wideLayout
            ? { top: 0, left: 0, width: window.innerWidth * 0.5, height: window.innerHeight }
            : { top: 0, left: 0, width: window.innerWidth, height: window.innerHeight * 0.35 },
          targetRect: null, // will be measured after render
        });

        // After the grid paints, measure the target card
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            const card = document.querySelector(`[data-product-id="${data.productId}"]`);
            if (card) {
              const imgEl = card.querySelector('img');
              const targetRect = imgEl ? imgEl.getBoundingClientRect() : card.getBoundingClientRect();
              setCollapseTransition(prev => prev ? { ...prev, targetRect } : null);
              // Clear after animation
              setTimeout(() => setCollapseTransition(null), 500);
            } else {
              // No card found, just clear the overlay
              setCollapseTransition(null);
            }
          });
        });
      }
    }
  }, [loading, pageConfig, slug]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (notFound && !pageConfig) {
    return <Navigate to="/" replace />;
  }

  const sections = pageConfig?.sections || [];
  const pageTitle = notFound ? 'Page Not Found' : (pageConfig?.title || pageConfig?.name || slug);

  return (
    <>
      <Helmet>
        <title>{pageTitle} | Surreal Creamery</title>
        {pageConfig?.description && <meta name="description" content={pageConfig.description} />}
      </Helmet>
      <motion.div initial={returningFromProduct ? "visible" : "hidden"} animate="visible" variants={stagger}>
        {sections.map((section, idx) => (
          <PageSection
            key={`${section.type}-${idx}`}
            section={section}
            allProducts={allProducts}
            navigate={navigate}
            onProductClick={handleProductClick}
            localCart={localCart}
          />
        ))}
        {sections.length === 0 && (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '40vh' }}>
            <Typography variant="h6" color="text.secondary">This page has no content yet.</Typography>
          </Box>
        )}
      </motion.div>

      {/* Collapse transition overlay — animates product image from detail hero to grid card */}
      <AnimatePresence>
        {collapseTransition && collapseTransition.imgSrc && (() => {
          const { startRect, targetRect, imgSrc, wideLayout } = collapseTransition;
          const target = targetRect || startRect;
          return (
            <motion.img
              key="collapse-overlay"
              src={imgSrc}
              initial={{
                top: startRect.top,
                left: startRect.left,
                width: startRect.width,
                height: startRect.height,
                borderRadius: 0,
              }}
              animate={{
                top: target.top,
                left: target.left,
                width: target.width,
                height: target.height,
                borderRadius: 12,
              }}
              exit={{ opacity: 0 }}
              transition={{
                duration: targetRect ? 0.4 : 0,
                ease: [0.22, 1, 0.36, 1],
              }}
              style={{
                position: 'fixed',
                zIndex: 9999,
                objectFit: 'cover',
                pointerEvents: 'none',
              }}
            />
          );
        })()}
      </AnimatePresence>

      {/* Cart Drawer — needed because Commerce.jsx (which renders its own) isn't mounted on custom pages */}
      <CartDrawer
        open={!!showCartDrawer}
        onClose={() => sendToCommerce({ type: 'CLOSE_CART' })}
        localCart={localCart}
      />
    </>
  );
}
