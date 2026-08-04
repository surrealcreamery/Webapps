import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
import { useParams } from 'react-router-dom';
import { Box, Typography, IconButton } from '@mui/material';
import PauseIcon from '@mui/icons-material/Pause';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import ClassicTemplate from '../components/signage/ClassicTemplate';
import ShowcaseTemplate from '../components/signage/ShowcaseTemplate';
import FlavorProfileTemplate from '../components/signage/FlavorProfileTemplate';

const DATA_CDN = 'https://data.surrealcreamery.com';
const WS_URL = 'wss://gx86vaqflf.execute-api.us-east-1.amazonaws.com/production';
const REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes

const RESOLUTIONS = {
  '720p':  { width: 1280, height: 720 },
  '1080p': { width: 1920, height: 1080 },
  '4K':    { width: 3840, height: 2160 },
};

// Wraps content in a fixed-resolution container that scales to fill the viewport
function ResolutionScaler({ resolution, orientation, children }) {
  const ref = useRef(null);
  const [scale, setScale] = useState(1);
  const res = RESOLUTIONS[resolution] || RESOLUTIONS['1080p'];
  const isPortrait = orientation === 'portrait';
  const w = isPortrait ? res.height : res.width;
  const h = isPortrait ? res.width : res.height;

  useEffect(() => {
    const update = () => {
      const sx = window.innerWidth / w;
      const sy = window.innerHeight / h;
      setScale(Math.min(sx, sy));
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [w, h]);

  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div ref={ref} style={{ width: w, height: h, transform: `scale(${scale})`, transformOrigin: 'center center', overflow: 'hidden' }}>
        {children}
      </div>
    </div>
  );
}

export default function Signage() {
  const { configId } = useParams();
  const [config, setConfig] = useState(null);
  const [soldOut, setSoldOut] = useState({}); // { "SKU#VARIANT": true }
  const [error, setError] = useState(null);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [transitioning, setTransitioning] = useState(false);
  const [paused, setPaused] = useState(false);
  const wsRef = useRef(null);
  const wakeLockRef = useRef(null);
  const reconnectTimer = useRef(null);

  // Fetch signage config JSON
  const fetchConfig = useCallback(async () => {
    try {
      const res = await fetch(`${DATA_CDN}/signage/${configId}.json?t=${Date.now()}`);
      if (!res.ok) throw new Error(`Config not found (${res.status})`);
      const data = await res.json();
      setConfig(data);
      setError(null);

      // Build initial sold-out map from ALL products (across all slides)
      const newSoldOut = {};
      const allProducts = data.products || [];
      allProducts.forEach(p => {
        (p.variants || []).forEach(v => {
          if (v.inventory?.trackInventory && !v.inventory?.inStock) {
            newSoldOut[`${p.sku}#${v.sku}`] = true;
          }
        });
      });
      setSoldOut(newSoldOut);
    } catch (err) {
      console.error('[Signage] Fetch error:', err);
      setError(err.message);
    }
  }, [configId]);

  // Initial fetch + periodic refresh
  useEffect(() => {
    fetchConfig();
    const interval = setInterval(fetchConfig, REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchConfig]);

  // WebSocket for real-time inventory updates
  useEffect(() => {
    if (!config) return;

    const connect = () => {
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('[Signage] WebSocket connected');
        ws.send(JSON.stringify({ action: 'subscribe', topic: 'inventory' }));
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'inventory_update') {
            const { sku, variantSku, locationId: msgLoc, quantity, available } = msg;
            // Only care about our location
            if (msgLoc && config.locationId && msgLoc !== config.locationId) return;

            const key = `${sku}#${variantSku}`;
            setSoldOut(prev => {
              const isSoldOut = available === false || (quantity != null && quantity <= 0);
              if (isSoldOut && !prev[key]) return { ...prev, [key]: true };
              if (!isSoldOut && prev[key]) {
                const next = { ...prev };
                delete next[key];
                return next;
              }
              return prev;
            });
          }
        } catch (err) {
          console.warn('[Signage] WS message parse error:', err);
        }
      };

      ws.onclose = () => {
        console.log('[Signage] WebSocket closed, reconnecting in 5s');
        reconnectTimer.current = setTimeout(connect, 5000);
      };

      ws.onerror = (err) => {
        console.error('[Signage] WebSocket error:', err);
        ws.close();
      };
    };

    connect();
    return () => {
      clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [config?.locationId]);

  // Wake lock to prevent screen sleep
  useEffect(() => {
    let mounted = true;
    const requestWakeLock = async () => {
      if (!('wakeLock' in navigator)) return;
      try {
        if (wakeLockRef.current) await wakeLockRef.current.release();
        wakeLockRef.current = await navigator.wakeLock.request('screen');
        wakeLockRef.current.addEventListener('release', () => {
          console.log('[Signage] Wake lock released');
        });
      } catch (err) {
        console.warn('[Signage] Wake lock failed:', err.message);
      }
    };
    requestWakeLock();
    const handleVisibility = () => {
      if (mounted && document.visibilityState === 'visible') requestWakeLock();
    };
    document.addEventListener('visibilitychange', handleVisibility);
    const interval = setInterval(() => {
      if (mounted && (!wakeLockRef.current || wakeLockRef.current.released)) requestWakeLock();
    }, 30000);
    return () => {
      mounted = false;
      wakeLockRef.current?.release().catch(() => {});
      wakeLockRef.current = null;
      document.removeEventListener('visibilitychange', handleVisibility);
      clearInterval(interval);
    };
  }, []);

  // Detect multi-slide mode
  const isMultiSlide = useMemo(() => {
    if (!config) return false;
    const { slideProducts, displaySettings } = config;
    // Need slides array AND at least 2 slide product arrays with content
    return slideProducts?.length >= 2
      && slideProducts[0]?.length > 0
      && slideProducts[1]?.length > 0
      && displaySettings?.slides?.length >= 2;
  }, [config]);

  const slideCount = isMultiSlide ? config.slideProducts.length : 1;
  const transitionTime = config?.displaySettings?.transitionTime ?? 10;
  const transitionType = config?.displaySettings?.transitionType || 'fade';

  // Auto-cycle slides
  useEffect(() => {
    if (!isMultiSlide || slideCount < 2 || paused) return;
    const timers = [];
    const interval = setInterval(() => {
      // Phase 1: fade out current slide
      setTransitioning(true);
      const fadeOutMs = transitionType === 'fade' ? 600 : 500;
      timers.push(setTimeout(() => {
        // Phase 2: swap slide content while invisible
        setCurrentSlide(prev => (prev + 1) % slideCount);
        // Phase 3: small delay for React to render, then fade in
        timers.push(setTimeout(() => setTransitioning(false), 100));
      }, fadeOutMs));
    }, transitionTime * 1000);
    return () => { clearInterval(interval); timers.forEach(clearTimeout); };
  }, [isMultiSlide, slideCount, transitionTime, transitionType, paused]);

  if (error && !config) {
    return (
      <Box component="main" sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', bgcolor: '#111' }} role="alert">
        <Helmet><title>Menu Display | Surreal Creamery</title></Helmet>
        <Typography variant="h1" component="h1" sx={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>Menu Display</Typography>
        <Typography variant="h5" color="error">{error}</Typography>
      </Box>
    );
  }

  if (!config) {
    return (
      <Box component="main" sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', bgcolor: '#111' }} role="status" aria-live="polite" aria-busy="true">
        <Helmet><title>Menu Display | Surreal Creamery</title></Helmet>
        <Typography variant="h1" component="h1" sx={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>Menu Display</Typography>
        <Typography variant="h6" sx={{ color: '#a0a0a0' }}>Loading...</Typography>
      </Box>
    );
  }

  const { displaySettings = {} } = config;
  const template = displaySettings.template || 'classic';
  const resolution = displaySettings.resolution || '1080p';
  const orientation = displaySettings.orientation || 'landscape';

  // Single-slide (legacy) mode
  if (!isMultiSlide) {
    const products = config.products || [];
    const templateProps = { displaySettings, products, soldOut };
    return (
      <Box component="main" aria-label="Menu Display">
        <Helmet><title>Menu Display | Surreal Creamery</title></Helmet>
        <Typography variant="h1" component="h1" sx={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>Menu Display</Typography>
        <ResolutionScaler resolution={resolution} orientation={orientation}>
          {template === 'flavor-profile'
            ? <FlavorProfileTemplate {...templateProps} />
            : template === 'showcase'
            ? <ShowcaseTemplate {...templateProps} />
            : <ClassicTemplate {...templateProps} />}
        </ResolutionScaler>
      </Box>
    );
  }

  // Multi-slide mode: build per-slide displaySettings by merging slide overrides
  const slideOverrides = displaySettings.slides[currentSlide] || {};
  const slideDisplaySettings = {
    ...displaySettings,
    columns: slideOverrides.columns ?? displaySettings.columns,
    rows: slideOverrides.rows ?? displaySettings.rows,
    gridTopOffset: slideOverrides.gridTopOffset ?? displaySettings.gridTopOffset,
    cardOutline: slideOverrides.cardOutline ?? displaySettings.cardOutline ?? true,
    headerFontSize: slideOverrides.headerFontSize ?? displaySettings.headerFontSize,
    subtitleFontSize: slideOverrides.subtitleFontSize ?? displaySettings.subtitleFontSize,
    templateSettings: {
      ...(displaySettings.templateSettings || {}),
      headerImage: slideOverrides.headerImage || (currentSlide === 0 ? displaySettings.templateSettings?.headerImage : '') || '',
      backgroundImage: slideOverrides.backgroundImage || (currentSlide === 0 ? displaySettings.templateSettings?.backgroundImage : '') || '',
      headerText: slideOverrides.headerText || (currentSlide === 0 ? displaySettings.templateSettings?.headerText : '') || '',
      subtitleText: slideOverrides.subtitleText || (currentSlide === 0 ? displaySettings.templateSettings?.subtitleText : '') || '',
    },
  };

  const slideProducts = config.slideProducts[currentSlide] || [];
  const templateProps = { displaySettings: slideDisplaySettings, products: slideProducts, soldOut };

  const TemplateComponent = template === 'flavor-profile' ? FlavorProfileTemplate : template === 'showcase' ? ShowcaseTemplate : ClassicTemplate;

  // Transition styles
  const isFade = transitionType === 'fade';
  const containerStyle = {
    position: 'relative',
    width: '100%',
    height: '100%',
    overflow: 'hidden',
  };
  const slideStyle = {
    position: 'absolute',
    inset: 0,
    transition: isFade
      ? 'opacity 0.6s ease-in-out'
      : 'transform 0.5s ease-in-out',
    opacity: isFade ? (transitioning ? 0 : 1) : 1,
    transform: !isFade ? (transitioning ? 'translateX(-100%)' : 'translateX(0)') : undefined,
  };

  return (
    <Box component="main" aria-label="Menu Display">
      <Helmet><title>Menu Display | Surreal Creamery</title></Helmet>
      <Typography variant="h1" component="h1" sx={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>Menu Display</Typography>
      <ResolutionScaler resolution={resolution} orientation={orientation}>
        <div style={containerStyle} aria-live="polite">
          <div style={slideStyle}>
            <TemplateComponent {...templateProps} />
          </div>
        </div>
      </ResolutionScaler>
      {isMultiSlide && slideCount >= 2 && (
        <IconButton
          onClick={() => setPaused(p => !p)}
          aria-label={paused ? 'Resume auto-scroll' : 'Pause auto-scroll'}
          sx={{
            position: 'fixed',
            bottom: 16,
            right: 16,
            bgcolor: 'rgba(0,0,0,0.6)',
            color: '#fff',
            '&:hover': { bgcolor: 'rgba(0,0,0,0.8)' },
            zIndex: 10,
          }}
        >
          {paused ? <PlayArrowIcon /> : <PauseIcon />}
        </IconButton>
      )}
    </Box>
  );
}
