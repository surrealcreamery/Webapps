/**
 * SegmentContext — Real-time behavioral segmentation for the consumer storefront.
 *
 * Scores users against segment definitions (fetched from analytics-api) as they browse.
 * Provides segment-aware cross-sell recommendations with async Claude generation.
 * Persists segment state to localStorage for warm-start on return visits.
 */

import React, { createContext, useContext, useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { useCatalog } from '@/contexts/commerce/CatalogContext';
import { useWebSocket } from '@/contexts/commerce/WebSocketContext';
import { fetchActiveSegments, fetchSegmentCrossSells, reportUnknownSegment, fetchVisitorSegment, persistVisitorSegment } from '@/services/segmentService';
import { getVisitorId, getEnvironment } from '@/services/eventTracker';
import { getLocationFromIP } from '@/components/commerce/geolocation';

const SegmentContext = createContext({});

const STORAGE_KEY = 'surrealSegment';
const STALENESS_DAYS = 30;
const SCORE_DEBOUNCE_MS = 500;
const UNKNOWN_THRESHOLD_VIEWS = 5;

/** Read persisted segment from localStorage */
function loadPersistedSegment() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    // Check staleness
    if (data.updatedAt) {
      const age = Date.now() - new Date(data.updatedAt).getTime();
      if (age > STALENESS_DAYS * 86400 * 1000) {
        localStorage.removeItem(STORAGE_KEY);
        return null;
      }
    }
    return data;
  } catch {
    return null;
  }
}

/** Persist segment state via requestIdleCallback (or setTimeout fallback) */
function persistSegment(data) {
  const write = () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        ...data,
        updatedAt: new Date().toISOString(),
      }));
    } catch { /* quota exceeded — non-critical */ }
  };
  if (typeof requestIdleCallback === 'function') {
    requestIdleCallback(write);
  } else {
    setTimeout(write, 0);
  }
}

export const SegmentProvider = ({ children }) => {
  const { allProducts, catalog } = useCatalog();
  const { onMessage: onWsMessage } = useWebSocket();
  const [segments, setSegments] = useState([]);

  // Fetch segment definitions from analytics-api (once, on mount)
  useEffect(() => {
    fetchActiveSegments().then(segs => {
      if (segs.length > 0) setSegments(segs);
    });
  }, []);

  // Signals: accumulated user behavior within this session
  const signalsRef = useRef({
    categoryViews: {},   // { slug: count }
    tagExposure: {},     // { tag: count }
    productViews: 0,
    addToCartCount: 0,
    variantSelects: 0,
  });

  // Persistent visitor ID (never expires, stored in localStorage)
  const visitorId = useMemo(() => getVisitorId(), []);

  // Keep refs to catalog + allProducts so recordProductView always has the latest
  const catalogRef = useRef(catalog);
  useEffect(() => { catalogRef.current = catalog; }, [catalog]);
  const allProductsRef = useRef(allProducts);
  useEffect(() => { allProductsRef.current = allProducts; }, [allProducts]);

  // Persisted state from previous visit
  const persistedRef = useRef(loadPersistedSegment());
  const [previousSegment, setPreviousSegment] = useState(
    persistedRef.current ? { segmentId: persistedRef.current.segmentId, name: persistedRef.current.name } : null
  );

  // Counter for throttling server-side persist (every 5th score update or on segment change)
  const persistCountRef = useRef(0);

  // Cache geo data for passing with segment persist calls
  const cachedGeoRef = useRef(null);
  useEffect(() => {
    getLocationFromIP().then(loc => { cachedGeoRef.current = loc; });
  }, []);

  // Server-side warm-start: fetch VISITOR_SEGMENT if localStorage had nothing
  useEffect(() => {
    if (persistedRef.current || !visitorId) return;
    fetchVisitorSegment(visitorId).then(seg => {
      if (!seg) return;
      // Apply server segment as warm-start (only if no local data appeared in the meantime)
      if (!loadPersistedSegment()) {
        const warmData = {
          segmentId: seg.segmentId,
          name: seg.name,
          score: seg.score || 0,
          signals: seg.signals || {},
        };
        persistedRef.current = warmData;
        setPreviousSegment({ segmentId: seg.segmentId, name: seg.name });
        setCurrentSegment({ segmentId: seg.segmentId, name: seg.name, score: seg.score || 0 });
        // Merge signals from server
        if (seg.signals) {
          const cur = signalsRef.current;
          for (const [k, v] of Object.entries(seg.signals.categoryViews || {})) {
            cur.categoryViews[k] = (cur.categoryViews[k] || 0) + Math.ceil(v * 0.5);
          }
          for (const [k, v] of Object.entries(seg.signals.tagExposure || {})) {
            cur.tagExposure[k] = (cur.tagExposure[k] || 0) + Math.ceil(v * 0.5);
          }
        }
        persistSegment(warmData);
      }
    });
  }, [visitorId]);

  // Warm-start: merge previous signals if available (localStorage fast path)
  useEffect(() => {
    if (persistedRef.current?.signals) {
      const prev = persistedRef.current.signals;
      const cur = signalsRef.current;
      // Merge category views (half-weighted from previous session)
      for (const [k, v] of Object.entries(prev.categoryViews || {})) {
        cur.categoryViews[k] = (cur.categoryViews[k] || 0) + Math.ceil(v * 0.5);
      }
      for (const [k, v] of Object.entries(prev.tagExposure || {})) {
        cur.tagExposure[k] = (cur.tagExposure[k] || 0) + Math.ceil(v * 0.5);
      }
    }
  }, []);

  // Current scoring state
  const [currentSegment, setCurrentSegment] = useState(
    persistedRef.current ? { segmentId: persistedRef.current.segmentId, name: persistedRef.current.name, score: persistedRef.current.score || 0 } : null
  );
  const [allScores, setAllScores] = useState([]);
  const [isUnknown, setIsUnknown] = useState(false);
  const [segmentChanged, setSegmentChanged] = useState(false);

  // Cross-sell cache: Map<productSku, Product[]>
  const crossSellCacheRef = useRef(new Map());
  const [crossSellVersion, setCrossSellVersion] = useState(0);

  // Debounce timer for scoring
  const scoreTimerRef = useRef(null);
  // Track if unknown report already sent this session
  const unknownReportedRef = useRef(false);

  /** Compute scores against all segment definitions */
  const computeScores = useCallback(async () => {
    if (segments.length === 0) return;

    const signals = signalsRef.current;
    const scored = segments.filter(seg => seg.rules).map(seg => {
      const { rules } = seg;
      let score = 0;

      // Count matching views — only products whose categories/tags match this segment
      let matchingCategoryViews = 0;
      // Category weights
      if (rules.categoryWeights) {
        for (const [cat, weight] of Object.entries(rules.categoryWeights)) {
          const views = signals.categoryViews[cat] || 0;
          score += views * weight;
          matchingCategoryViews += views;
        }
      }

      // Tag weights
      if (rules.tagWeights) {
        for (const [tag, weight] of Object.entries(rules.tagWeights)) {
          score += (signals.tagExposure[tag] || 0) * weight;
        }
      }

      // Behavior weights — browseDepth only counts products matching this segment's categories
      // (prevents a segment from winning on raw view count regardless of what was viewed)
      if (rules.behaviorWeights) {
        if (rules.behaviorWeights.browseDepth) {
          score += matchingCategoryViews * rules.behaviorWeights.browseDepth;
        }
        if (rules.behaviorWeights.addToCart) {
          score += signals.addToCartCount * rules.behaviorWeights.addToCart;
        }
        if (rules.behaviorWeights.variantExplorer) {
          score += signals.variantSelects * rules.behaviorWeights.variantExplorer;
        }
      }

      return { segmentId: seg.segmentId, name: seg.name, score, minScore: rules.minScore || 0 };
    });

    // Sort by score descending, then by priority
    scored.sort((a, b) => b.score - a.score || (segments.find(s => s.segmentId === b.segmentId)?.priority || 0) - (segments.find(s => s.segmentId === a.segmentId)?.priority || 0));
    setAllScores(scored);

    // Determine winner and all qualifying segments
    const qualifying = scored.filter(s => s.score >= s.minScore);
    const winner = qualifying[0];
    if (winner) {
      const prev = currentSegment;
      const changed = prev && prev.segmentId !== winner.segmentId;
      setCurrentSegment({ segmentId: winner.segmentId, name: winner.name, score: winner.score });
      setIsUnknown(false);
      if (changed) {
        setPreviousSegment({ segmentId: prev.segmentId, name: prev.name });
        setSegmentChanged(true);
        // Clear cross-sell cache when segment changes
        crossSellCacheRef.current.clear();
        setCrossSellVersion(v => v + 1);
      }
      persistSegment({
        segmentId: winner.segmentId,
        name: winner.name,
        score: winner.score,
        signals: signalsRef.current,
        sessionCount: (persistedRef.current?.sessionCount || 0) + 1,
      });
      // Server-side persist: on first qualification, segment change, or every 3rd score update
      persistCountRef.current += 1;
      if (persistCountRef.current === 1 || changed || persistCountRef.current % 3 === 0) {
        const qualifyingSegments = qualifying.map(s => ({ segmentId: s.segmentId, name: s.name, score: s.score }));
        const result = await persistVisitorSegment(visitorId, winner.segmentId, winner.name, winner.score, signalsRef.current, null, getEnvironment(), qualifyingSegments, cachedGeoRef.current);
        if (result?.ok && typeof fbq === 'function') {
          const geo = cachedGeoRef.current;
          const storeLocation = localStorage.getItem('selectedLocation') || null;
          for (const seg of qualifyingSegments) {
            const eventKey = `aq_${seg.segmentId}`;
            if (!sessionStorage.getItem(eventKey)) {
              fbq('trackCustom', 'AudienceQualified', {
                segment_id: seg.segmentId,
                segment_name: seg.name,
                profile_id: result.behavioralProfileId || 'unclassified',
                city: geo?.city || undefined,
                region: geo?.regionCode || undefined,
                postal: geo?.postal || undefined,
                store_location: storeLocation || undefined,
              });
              sessionStorage.setItem(eventKey, '1');
            }
          }
        }
      }
    } else if (signals.productViews >= UNKNOWN_THRESHOLD_VIEWS && !unknownReportedRef.current) {
      setIsUnknown(true);
      unknownReportedRef.current = true;
      // Report to Lambda for admin review
      const sessionData = sessionStorage.getItem('evt_session');
      const sessionId = sessionData ? JSON.parse(sessionData).id : 'unknown';
      reportUnknownSegment(sessionId, { ...signals }, scored, visitorId);
    }
  }, [segments, currentSegment, visitorId]);

  /** Debounced scoring trigger */
  const triggerScore = useCallback(() => {
    if (scoreTimerRef.current) clearTimeout(scoreTimerRef.current);
    scoreTimerRef.current = setTimeout(computeScores, SCORE_DEBOUNCE_MS);
  }, [computeScores]);

  // Signal recorders
  const recordProductView = useCallback((product) => {
    if (!product) return;
    const signals = signalsRef.current;
    signals.productViews += 1;

    // Look up enriched product from allProducts if fields are missing
    // (containers from buildSubcategoriesFromCatalog may omit categoryIds/tags)
    let enriched = product;
    if (!product.categoryIds?.length && !product.tags?.length) {
      const all = allProductsRef.current || [];
      const match = all.find(p => p.id === product.id || p.sku === product.sku || p.name === product.name);
      if (match) enriched = match;
    }

    // Accumulate tag exposure
    for (const tag of (enriched.tags || [])) {
      signals.tagExposure[tag] = (signals.tagExposure[tag] || 0) + 1;
    }
    // Accumulate category views (resolve catId → slug via catalog)
    const cats = catalogRef.current?.categories;
    for (const catId of (enriched.categoryIds || [])) {
      const cat = cats?.find(c => c.id === catId);
      if (cat?.slug) {
        signals.categoryViews[cat.slug] = (signals.categoryViews[cat.slug] || 0) + 1;
      }
    }
    triggerScore();
  }, [triggerScore]);

  const recordCategoryView = useCallback((categorySlug) => {
    if (!categorySlug) return;
    signalsRef.current.categoryViews[categorySlug] = (signalsRef.current.categoryViews[categorySlug] || 0) + 1;
    triggerScore();
  }, [triggerScore]);

  const recordAddToCart = useCallback((product) => {
    signalsRef.current.addToCartCount += 1;
    // Extra weight: also count tags/categories from cart adds
    if (product) {
      for (const tag of (product.tags || [])) {
        signalsRef.current.tagExposure[tag] = (signalsRef.current.tagExposure[tag] || 0) + 2; // double weight for cart
      }
    }
    triggerScore();
  }, [triggerScore]);

  const recordVariantSelect = useCallback(() => {
    signalsRef.current.variantSelects += 1;
    triggerScore();
  }, [triggerScore]);

  /** Get segment-aware cross-sells for a product (cached or async fetch) */
  const getSegmentCrossSells = useCallback((productSku) => {
    if (!currentSegment || !productSku) return [];

    const cacheKey = `${productSku}#${currentSegment.segmentId}`;
    const cached = crossSellCacheRef.current.get(cacheKey);
    if (cached) return cached;

    // Mark as fetching to prevent duplicate requests
    crossSellCacheRef.current.set(cacheKey, []);

    // Build lightweight catalog context for Claude
    const catalogContext = (allProducts || []).map(p => ({
      sku: p.sku,
      name: p.name,
      category: p.categoryIds?.[0] || '',
      tags: p.tags || [],
      price: p.variants?.[0]?.price || 0,
    }));

    // Fire async fetch — result appears on next render via version bump
    fetchSegmentCrossSells(productSku, currentSegment.segmentId, catalogContext).then(recs => {
      if (recs.length > 0) {
        // Resolve recs to full product objects
        const productMap = new Map((allProducts || []).map(p => [p.sku, p]));
        const resolved = recs
          .map(r => {
            const prod = productMap.get(r.sku);
            return prod ? { ...prod, segmentReason: r.reason, segmentScore: r.score } : null;
          })
          .filter(Boolean);
        crossSellCacheRef.current.set(cacheKey, resolved);
        setCrossSellVersion(v => v + 1);
      }
    });

    return [];
  }, [currentSegment, allProducts]);

  // Listen for server-pushed segment changes (e.g. server-side rescore on identify)
  // and cross-sell refresh signals. Bust caches and update local state to keep UI in sync.
  useEffect(() => {
    if (!onWsMessage) return undefined;
    return onWsMessage((type, data) => {
      if (type === 'segment_changed') {
        const primary = data?.primary || (Array.isArray(data?.qualifyingSegments) ? data.qualifyingSegments[0] : null);
        if (primary?.segmentId) {
          setCurrentSegment(prev => {
            if (prev?.segmentId === primary.segmentId) return prev;
            if (prev) setPreviousSegment({ segmentId: prev.segmentId, name: prev.name });
            setSegmentChanged(true);
            crossSellCacheRef.current.clear();
            setCrossSellVersion(v => v + 1);
            return { segmentId: primary.segmentId, name: primary.name, score: primary.score || 0 };
          });
        }
        // Apply consolidated signals from cross-session identity resolution
        if (data?.consolidatedSignals) {
          const cur = signalsRef.current;
          Object.assign(cur.categoryViews, data.consolidatedSignals.categoryViews || {});
          Object.assign(cur.tagExposure, data.consolidatedSignals.tagExposure || {});
        }
      } else if (type === 'crosssell_updated') {
        // Server signals fresh cross-sells are available — drop cache so next render refetches
        crossSellCacheRef.current.clear();
        setCrossSellVersion(v => v + 1);
      }
    });
  }, [onWsMessage]);

  const value = useMemo(() => ({
    currentSegment,
    allScores,
    isUnknown,
    getSegmentCrossSells,
    previousSegment,
    segmentChanged,
    recordProductView,
    recordCategoryView,
    recordAddToCart,
    recordVariantSelect,
  }), [currentSegment, allScores, isUnknown, getSegmentCrossSells, previousSegment, segmentChanged,
       recordProductView, recordCategoryView, recordAddToCart, recordVariantSelect, crossSellVersion]);

  return (
    <SegmentContext.Provider value={value}>
      {children}
    </SegmentContext.Provider>
  );
};

export const useSegment = () => useContext(SegmentContext);
