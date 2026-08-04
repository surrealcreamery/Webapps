// src/services/pageConfigService.js
// Service for fetching page configurations for the public-facing website

const CATALOG_API_URL = 'https://ou6oqgnnqjo542342x64srup4q0ofoua.lambda-url.us-east-1.on.aws';

/**
 * Get page configuration by slug from the API
 * The API returns a default homepage if no custom config exists
 */
export const getPageConfig = async (slug = '/') => {
  try {
    // Fetch from API (no auth required for public page configs)
    const response = await fetch(CATALOG_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'getPageConfig', slug }),
    });

    if (response.ok) {
      const data = await response.json();
      if (data.success && data.redirect && data.targetSlug) {
        console.log('[PageConfig] Redirect:', slug, '->', data.targetSlug);
        return { redirect: true, targetSlug: data.targetSlug };
      }
      if (data.success && data.notFound && data.page) {
        console.log('[PageConfig] Not found, serving custom 404 page');
        return { notFound: true, ...data.page };
      }
      if (data.success && data.page) {
        console.log('[PageConfig] Loaded from API:', slug, data.page.sections?.length, 'sections');
        return data.page;
      }
    }

    console.log('[PageConfig] No page found for slug:', slug);
    return null;
  } catch (error) {
    console.error('[PageConfig] API error:', error);
    return null;
  }
};

/**
 * Get products by IDs for manual selection
 */
export const getProductsByIds = (allProducts, productIds) => {
  if (!productIds || productIds.length === 0) return [];
  return productIds
    .map(id => allProducts.find(p => p.id === id || p.sku === id))
    .filter(Boolean);
};

/**
 * Validate a discount/promo code
 */
export const validateDiscountCode = async (code) => {
  try {
    const response = await fetch(CATALOG_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'validateDiscountCode', code }),
    });

    if (response.ok) {
      return await response.json();
    }
    return { success: false, valid: false, reason: 'Failed to validate code' };
  } catch (error) {
    console.error('[PageConfig] validateDiscountCode error:', error);
    return { success: false, valid: false, reason: 'Network error' };
  }
};

/**
 * Get published pages (lightweight list for page carousels)
 */
export const getPublishedPages = async () => {
  try {
    const response = await fetch(CATALOG_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'getPublishedPages' }),
    });

    if (response.ok) {
      const data = await response.json();
      if (data.success && data.pages) return data.pages;
    }
    return [];
  } catch (error) {
    console.error('[PageConfig] getPublishedPages error:', error);
    return [];
  }
};

/**
 * Fetch public events data and normalize
 */
export const fetchEvents = async () => {
  const cacheBuster = `?t=${Date.now()}`;
  const res = await fetch(`https://data.surrealcreamery.com/events.json${cacheBuster}`);
  if (!res.ok) throw new Error('Failed to fetch events');
  const data = await res.json();
  const dayNameToNumber = { Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6 };
  return data.map(event => ({
    id: event['Event ID'],
    title: event['Event Name'],
    imageUrl: event['Image URL'] || null,
    description: event['Description'],
    type: event['Event Type'] || 'Event',
    Role: event['Role'],
    locationIds: event['Location ID'] || [],
    locationNames: event['Location Names'] || [],
    startDate: event['Start Date'],
    endDate: event['End Date'],
    daysOfWeek: (event['Days of Week'] || []).map(d => dayNameToNumber[d]),
    eventTimes: event['Event Times'] || [],
    schedule: event['Schedule'] || null,
  }));
};

/**
 * Fetch public event locations data
 */
export const fetchEventLocations = async () => {
  const cacheBuster = `?t=${Date.now()}`;
  const res = await fetch(`https://data.surrealcreamery.com/eventLocations.json${cacheBuster}`);
  if (!res.ok) return [];
  const data = await res.json();
  return data.map(loc => ({
    id: loc['Location ID'],
    name: loc['Location Name'],
    address: loc['Location Address'],
  }));
};

export default {
  getPageConfig,
  getProductsByIds,
  validateDiscountCode,
  getPublishedPages,
  fetchEvents,
  fetchEventLocations,
};
