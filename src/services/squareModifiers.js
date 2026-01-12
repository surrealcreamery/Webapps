/**
 * Square Modifiers Service
 *
 * Fetches product modifiers from Square via AWS Lambda.
 * Includes caching to reduce API calls.
 */

// Lambda API endpoint
const SQUARE_MODIFIERS_API = 'https://2vrm44dxvudlprxwooup65hmna0xueao.lambda-url.us-east-1.on.aws';

// Cache modifiers to avoid repeated API calls
const modifierCache = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Fetch modifiers for a product by SKU
 * @param {string} sku - Product SKU
 * @returns {Promise<object>} - Modifier data
 */
export const fetchModifiersBySku = async (sku) => {
  if (!sku) {
    console.warn('fetchModifiersBySku called without SKU');
    return null;
  }

  // Check cache first
  const cached = modifierCache.get(sku);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    console.log(`[SquareModifiers] Cache hit for SKU: ${sku}`);
    return cached.data;
  }

  try {
    console.log(`[SquareModifiers] Fetching modifiers for SKU: ${sku}`);

    const response = await fetch(`${SQUARE_MODIFIERS_API}?sku=${encodeURIComponent(sku)}`);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error(`[SquareModifiers] API error:`, errorData);
      throw new Error(errorData.error || `HTTP ${response.status}`);
    }

    const data = await response.json();

    // Cache the result
    modifierCache.set(sku, {
      data,
      timestamp: Date.now(),
    });

    console.log(`[SquareModifiers] Fetched modifiers for ${sku}:`, data);
    return data;

  } catch (error) {
    console.error(`[SquareModifiers] Failed to fetch modifiers for SKU ${sku}:`, error);
    throw error;
  }
};

/**
 * Check if a product has modifiers (cached check)
 * @param {string} sku - Product SKU
 * @returns {Promise<boolean>}
 */
export const hasModifiers = async (sku) => {
  try {
    const data = await fetchModifiersBySku(sku);
    return data?.hasModifiers || false;
  } catch {
    return false;
  }
};

/**
 * Calculate total price of selected modifiers
 * @param {Array} modifierCategories - Modifier categories from API
 * @param {object} selections - Selected modifiers { categoryId: [modifierIds] }
 * @returns {number} - Total additional price
 */
export const calculateModifierPrice = (modifierCategories, selections) => {
  if (!modifierCategories || !selections) return 0;

  let total = 0;

  modifierCategories.forEach((category) => {
    const selectedIds = selections[category.id] || [];

    selectedIds.forEach((modifierId) => {
      const modifier = category.modifiers.find((m) => m.id === modifierId);
      if (modifier) {
        total += modifier.price || 0;
      }
    });
  });

  return total;
};

/**
 * Validate modifier selections
 * @param {Array} modifierCategories - Modifier categories from API
 * @param {object} selections - Selected modifiers { categoryId: [modifierIds] }
 * @returns {object} - { valid: boolean, errors: string[] }
 */
export const validateSelections = (modifierCategories, selections) => {
  if (!modifierCategories) return { valid: true, errors: [] };

  const errors = [];

  modifierCategories.forEach((category) => {
    const selectedIds = selections[category.id] || [];
    const count = selectedIds.length;

    // Check required
    if (category.required && count === 0) {
      errors.push(`Please select a ${category.name}`);
    }

    // Check min selections
    if (category.minSelections && count < category.minSelections) {
      errors.push(`Please select at least ${category.minSelections} for ${category.name}`);
    }

    // Check max selections
    if (category.maxSelections && count > category.maxSelections) {
      errors.push(`Maximum ${category.maxSelections} selections for ${category.name}`);
    }
  });

  return {
    valid: errors.length === 0,
    errors,
  };
};

/**
 * Convert selections to Shopify custom attributes
 * @param {Array} modifierCategories - Modifier categories from API
 * @param {object} selections - Selected modifiers { categoryId: [modifierIds] }
 * @returns {Array} - Shopify custom attributes [{ key, value }]
 */
export const selectionsToCustomAttributes = (modifierCategories, selections) => {
  if (!modifierCategories || !selections) return [];

  const attributes = [];

  modifierCategories.forEach((category) => {
    const selectedIds = selections[category.id] || [];
    if (selectedIds.length === 0) return;

    // Get modifier names for display
    const selectedNames = selectedIds
      .map((id) => category.modifiers.find((m) => m.id === id)?.name)
      .filter(Boolean);

    if (selectedNames.length > 0) {
      attributes.push({
        key: category.name,
        value: selectedNames.join(', '),
      });
    }
  });

  return attributes;
};

/**
 * Get default selections (first option for required SINGLE categories)
 * @param {Array} modifierCategories - Modifier categories from API
 * @returns {object} - Default selections { categoryId: [modifierIds] }
 */
export const getDefaultSelections = (modifierCategories) => {
  if (!modifierCategories) return {};

  const defaults = {};

  modifierCategories.forEach((category) => {
    if (category.required && category.selectionType === 'SINGLE') {
      const firstModifier = category.modifiers[0];
      if (firstModifier) {
        defaults[category.id] = [firstModifier.id];
      }
    } else {
      defaults[category.id] = [];
    }
  });

  return defaults;
};

/**
 * Clear the modifier cache (useful for admin refreshes)
 */
export const clearCache = () => {
  modifierCache.clear();
  console.log('[SquareModifiers] Cache cleared');
};

export default {
  fetchModifiersBySku,
  hasModifiers,
  calculateModifierPrice,
  validateSelections,
  selectionsToCustomAttributes,
  getDefaultSelections,
  clearCache,
};
