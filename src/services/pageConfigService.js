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

export default {
  getPageConfig,
  getProductsByIds,
};
