/**
 * Catalog Service - Fetches pre-generated catalog from CloudFront
 *
 * This service fetches the published catalog JSON from CloudFront CDN
 * for fast load times (~50ms edge-cached) instead of making Lambda calls.
 */

const CATALOG_URL = 'https://data.surrealcreamery.com/catalog.json';
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

let catalogCache = null;
let cacheTimestamp = 0;

/**
 * Fetch the published catalog from CloudFront
 * Uses in-memory caching with 5-minute expiration
 * @returns {Promise<Object|null>} The catalog object or null if fetch fails
 */
export const fetchPublishedCatalog = async () => {
  // Return cached data if still valid
  if (catalogCache && Date.now() - cacheTimestamp < CACHE_DURATION) {
    return catalogCache;
  }

  try {
    // Add cache-busting query param to ensure fresh data after publish
    const response = await fetch(`${CATALOG_URL}?t=${Date.now()}`);
    if (!response.ok) {
      console.warn('[CatalogService] Failed to fetch catalog:', response.status);
      return null;
    }

    const catalog = await response.json();

    // Validate catalog structure
    if (!catalog.publishedAt || !catalog.products) {
      console.warn('[CatalogService] Invalid catalog structure');
      return null;
    }

    // Update cache
    catalogCache = catalog;
    cacheTimestamp = Date.now();

    console.log('[CatalogService] Loaded catalog:', {
      publishedAt: catalog.publishedAt,
      products: catalog.products?.length,
      modifiers: catalog.modifiers?.length,
      categories: catalog.categories?.length,
    });

    return catalog;
  } catch (error) {
    console.error('[CatalogService] Fetch error:', error);
    return null;
  }
};

/**
 * Get all products from the published catalog
 * @returns {Promise<Array>} Array of products
 */
export const getProducts = async () => {
  const catalog = await fetchPublishedCatalog();
  return catalog?.products || [];
};

/**
 * Get all modifiers from the published catalog
 * @returns {Promise<Array>} Array of modifiers
 */
export const getModifiers = async () => {
  const catalog = await fetchPublishedCatalog();
  return catalog?.modifiers || [];
};

/**
 * Get all categories from the published catalog
 * @returns {Promise<Array>} Array of categories
 */
export const getCategories = async () => {
  const catalog = await fetchPublishedCatalog();
  return catalog?.categories || [];
};

/**
 * Get modifiers for a specific product by SKU
 * Matches product SKU or variant SKU
 * @param {string} sku - Product or variant SKU
 * @returns {Promise<Array>} Array of modifiers for the product
 */
export const getModifiersForProduct = async (sku) => {
  const catalog = await fetchPublishedCatalog();
  if (!catalog || !sku) return [];

  const skuUpper = sku.toUpperCase();

  // Find the product by product SKU or variant SKU (case-insensitive)
  const product = catalog.products?.find(p => {
    // Check product SKU
    if (p.sku?.toUpperCase() === skuUpper) return true;
    // Check variant SKUs
    if (p.variants?.some(v => v.sku?.toUpperCase() === skuUpper)) return true;
    return false;
  });

  if (!product?.modifierIds?.length) {
    console.log(`[CatalogService] No modifiers found for SKU: ${sku}`);
    return [];
  }

  console.log(`[CatalogService] Found ${product.modifierIds.length} modifiers for SKU: ${sku}`);

  // Return modifiers that match the product's modifierIds, in the product's order
  const modifierMap = new Map((catalog.modifiers || []).map(m => [m.modifierId, m]));
  return product.modifierIds.map(id => modifierMap.get(id)).filter(Boolean);
};

/**
 * Get a single product by SKU (matches product or variant SKU)
 * @param {string} sku - Product or variant SKU
 * @returns {Promise<Object|null>} Product object or null
 */
export const getProductBySku = async (sku) => {
  const catalog = await fetchPublishedCatalog();
  if (!catalog || !sku) return null;

  const skuUpper = sku.toUpperCase();

  return catalog.products?.find(p => {
    if (p.sku?.toUpperCase() === skuUpper) return true;
    if (p.variants?.some(v => v.sku?.toUpperCase() === skuUpper)) return true;
    return false;
  }) || null;
};

/**
 * Sort products by category's productOrder array
 * Matches by product name between catalog and Shopify products
 * @param {Array} products - Array of Shopify products to sort
 * @param {Array} productOrder - Array of SKUs in desired order
 * @param {Array} catalogProducts - Catalog products for SKU-to-name mapping
 * @returns {Array} Sorted products array
 */
export const sortProductsByOrder = (products, productOrder = [], catalogProducts = []) => {
  // Build a map from SKU to product name using catalog products
  const skuToName = new Map();
  catalogProducts.forEach(p => {
    if (p.sku && p.name) {
      skuToName.set(p.sku.toUpperCase(), p.name.toLowerCase());
    }
  });

  // Build order map using product names
  const nameOrderMap = new Map();
  productOrder.forEach((sku, idx) => {
    const name = skuToName.get(sku.toUpperCase());
    if (name) {
      nameOrderMap.set(name, idx);
    }
  });

  // Helper to find a product's position in the order
  const getOrderIndex = (product) => {
    if (product.name) {
      const idx = nameOrderMap.get(product.name.toLowerCase());
      if (idx !== undefined) return idx;
    }
    return Infinity;
  };

  return [...products].sort((a, b) => {
    const aIdx = getOrderIndex(a);
    const bIdx = getOrderIndex(b);
    if (aIdx !== Infinity && bIdx !== Infinity) return aIdx - bIdx;
    if (aIdx !== Infinity) return -1;
    if (bIdx !== Infinity) return 1;
    return (a.name || a.id || '').localeCompare(b.name || b.id || '');
  });
};

/**
 * Get products by category ID, sorted by category's productOrder
 * @param {string} categoryId - Category ID
 * @returns {Promise<Array>} Array of products in the category, sorted by productOrder
 */
export const getProductsByCategory = async (categoryId) => {
  const catalog = await fetchPublishedCatalog();
  if (!catalog) return [];

  // Get products in this category
  const products = catalog.products?.filter(
    p => p.categoryIds?.includes(categoryId)
  ) || [];

  // Find the category to get its productOrder
  const category = catalog.categories?.find(c => c.id === categoryId);
  const productOrder = category?.productOrder || [];

  // Sort by productOrder
  return sortProductsByOrder(products, productOrder);
};

/**
 * Clear the catalog cache (useful after publishing new catalog)
 */
export const clearCache = () => {
  catalogCache = null;
  cacheTimestamp = 0;
  console.log('[CatalogService] Cache cleared');
};

/**
 * Get catalog metadata (publish time, counts, etc.)
 * @returns {Promise<Object|null>} Catalog metadata
 */
export const getCatalogMetadata = async () => {
  const catalog = await fetchPublishedCatalog();
  if (!catalog) return null;

  return {
    publishedAt: catalog.publishedAt,
    version: catalog.version,
    productCount: catalog.products?.length || 0,
    modifierCount: catalog.modifiers?.length || 0,
    categoryCount: catalog.categories?.length || 0,
  };
};
