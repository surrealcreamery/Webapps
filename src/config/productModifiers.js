/**
 * Product Modifiers Configuration
 *
 * This mirrors Square's modifier structure for products that need customization.
 * Since Shopify doesn't support native modifiers, we define them here and pass
 * selections as line item properties (customAttributes) at checkout.
 *
 * Structure follows Square's pattern:
 * - ModifierCategories: Array of modifier groups
 * - Each category has: id, name, selectionType, required, modifiers[]
 * - Each modifier has: id, name, price (additional cost)
 */

// Modifier selection types (matches Square)
export const SELECTION_TYPES = {
  SINGLE: 'SINGLE',       // Radio buttons - pick one
  MULTIPLE: 'MULTIPLE',   // Checkboxes - pick multiple
};

/**
 * Product Modifier Definitions
 * Key: Shopify product handle
 * Value: Modifier configuration
 */
export const PRODUCT_MODIFIERS = {
  // ============================================
  // ICE CREAM / SOFT SERVE
  // ============================================
  'make-your-own-soft-serve': {
    productHandle: 'make-your-own-soft-serve',
    modifierCategories: [
      {
        id: 'soft-serve-flavor',
        name: 'Soft Serve Flavor',
        selectionType: SELECTION_TYPES.SINGLE,
        required: true,
        minSelections: 1,
        maxSelections: 1,
        modifiers: [
          { id: 'vanilla', name: 'Vanilla', price: 0, image: null },
          { id: 'chocolate', name: 'Chocolate', price: 0, image: null },
          { id: 'swirl', name: 'Vanilla/Chocolate Swirl', price: 0, image: null },
          { id: 'ube', name: 'Ube', price: 0.50, image: null },
          { id: 'matcha', name: 'Matcha', price: 0.50, image: null },
        ],
      },
      {
        id: 'container',
        name: 'Container',
        selectionType: SELECTION_TYPES.SINGLE,
        required: true,
        minSelections: 1,
        maxSelections: 1,
        modifiers: [
          { id: 'cup', name: 'Cup', price: 0, image: null },
          { id: 'waffle-cone', name: 'Waffle Cone', price: 1.00, image: null },
          { id: 'cake-cone', name: 'Cake Cone', price: 0, image: null },
        ],
      },
      {
        id: 'toppings',
        name: 'Toppings',
        description: 'Choose up to 3 toppings',
        selectionType: SELECTION_TYPES.MULTIPLE,
        required: false,
        minSelections: 0,
        maxSelections: 3,
        freeSelections: 2, // First 2 are free
        additionalPrice: 0.75, // Each additional topping after free ones
        modifiers: [
          { id: 'sprinkles', name: 'Rainbow Sprinkles', price: 0, image: null },
          { id: 'chocolate-sprinkles', name: 'Chocolate Sprinkles', price: 0, image: null },
          { id: 'oreo', name: 'Oreo Crumbles', price: 0, image: null },
          { id: 'mochi', name: 'Mochi', price: 0, image: null },
          { id: 'fruity-pebbles', name: 'Fruity Pebbles', price: 0, image: null },
          { id: 'graham-cracker', name: 'Graham Cracker', price: 0, image: null },
          { id: 'pocky', name: 'Pocky Sticks', price: 0, image: null },
          { id: 'gummy-bears', name: 'Gummy Bears', price: 0, image: null },
          { id: 'condensed-milk', name: 'Condensed Milk', price: 0, image: null },
        ],
      },
      {
        id: 'drizzle',
        name: 'Drizzle',
        selectionType: SELECTION_TYPES.SINGLE,
        required: false,
        minSelections: 0,
        maxSelections: 1,
        modifiers: [
          { id: 'none', name: 'No Drizzle', price: 0, image: null },
          { id: 'chocolate', name: 'Chocolate', price: 0.50, image: null },
          { id: 'caramel', name: 'Caramel', price: 0.50, image: null },
          { id: 'strawberry', name: 'Strawberry', price: 0.50, image: null },
          { id: 'ube', name: 'Ube', price: 0.75, image: null },
        ],
      },
    ],
  },

  // ============================================
  // MILKSHAKES
  // ============================================
  'make-your-own-milkshake': {
    productHandle: 'make-your-own-milkshake',
    modifierCategories: [
      {
        id: 'milkshake-base',
        name: 'Milkshake Base',
        selectionType: SELECTION_TYPES.SINGLE,
        required: true,
        minSelections: 1,
        maxSelections: 1,
        modifiers: [
          { id: 'vanilla', name: 'Vanilla', price: 0, image: null },
          { id: 'chocolate', name: 'Chocolate', price: 0, image: null },
          { id: 'strawberry', name: 'Strawberry', price: 0, image: null },
          { id: 'cookies-cream', name: 'Cookies & Cream', price: 0.50, image: null },
          { id: 'ube', name: 'Ube', price: 0.75, image: null },
          { id: 'matcha', name: 'Matcha', price: 0.75, image: null },
        ],
      },
      {
        id: 'milkshake-size',
        name: 'Size',
        selectionType: SELECTION_TYPES.SINGLE,
        required: true,
        minSelections: 1,
        maxSelections: 1,
        modifiers: [
          { id: 'regular', name: 'Regular (16oz)', price: 0, image: null },
          { id: 'large', name: 'Large (24oz)', price: 2.00, image: null },
        ],
      },
      {
        id: 'milkshake-toppings',
        name: 'Toppings',
        description: 'Add extra toppings',
        selectionType: SELECTION_TYPES.MULTIPLE,
        required: false,
        minSelections: 0,
        maxSelections: 5,
        modifiers: [
          { id: 'whipped-cream', name: 'Whipped Cream', price: 0, image: null },
          { id: 'cherry', name: 'Cherry', price: 0, image: null },
          { id: 'oreo', name: 'Oreo Crumbles', price: 0.50, image: null },
          { id: 'sprinkles', name: 'Rainbow Sprinkles', price: 0.25, image: null },
          { id: 'chocolate-chips', name: 'Chocolate Chips', price: 0.50, image: null },
        ],
      },
    ],
  },

  // Add more products as needed...
};

/**
 * Get modifier config for a product
 * @param {string} productHandle - Shopify product handle
 * @returns {object|null} - Modifier configuration or null if no modifiers
 */
export const getProductModifiers = (productHandle) => {
  return PRODUCT_MODIFIERS[productHandle] || null;
};

/**
 * Check if a product has modifiers
 * @param {string} productHandle - Shopify product handle
 * @returns {boolean}
 */
export const hasModifiers = (productHandle) => {
  return !!PRODUCT_MODIFIERS[productHandle];
};

/**
 * Calculate total modifier price
 * @param {object} modifierConfig - Product modifier configuration
 * @param {object} selections - Selected modifiers { categoryId: [modifierIds] }
 * @returns {number} - Total additional price from modifiers
 */
export const calculateModifierPrice = (modifierConfig, selections) => {
  if (!modifierConfig || !selections) return 0;

  let totalPrice = 0;

  modifierConfig.modifierCategories.forEach(category => {
    const selectedIds = selections[category.id] || [];

    if (category.freeSelections !== undefined) {
      // Handle categories with free selections (e.g., first 2 toppings free)
      selectedIds.forEach((modifierId, index) => {
        const modifier = category.modifiers.find(m => m.id === modifierId);
        if (modifier) {
          if (index >= category.freeSelections) {
            // Beyond free selections, charge additional price
            totalPrice += category.additionalPrice || modifier.price || 0;
          } else {
            // Within free selections, use modifier's own price (usually 0)
            totalPrice += modifier.price || 0;
          }
        }
      });
    } else {
      // Standard pricing - just add each modifier's price
      selectedIds.forEach(modifierId => {
        const modifier = category.modifiers.find(m => m.id === modifierId);
        if (modifier) {
          totalPrice += modifier.price || 0;
        }
      });
    }
  });

  return totalPrice;
};

/**
 * Validate modifier selections
 * @param {object} modifierConfig - Product modifier configuration
 * @param {object} selections - Selected modifiers { categoryId: [modifierIds] }
 * @returns {object} - { valid: boolean, errors: string[] }
 */
export const validateSelections = (modifierConfig, selections) => {
  if (!modifierConfig) return { valid: true, errors: [] };

  const errors = [];

  modifierConfig.modifierCategories.forEach(category => {
    const selectedIds = selections[category.id] || [];
    const count = selectedIds.length;

    // Check required
    if (category.required && count === 0) {
      errors.push(`Please select a ${category.name}`);
    }

    // Check min selections
    if (category.minSelections && count < category.minSelections) {
      errors.push(`Please select at least ${category.minSelections} ${category.name}`);
    }

    // Check max selections
    if (category.maxSelections && count > category.maxSelections) {
      errors.push(`You can only select up to ${category.maxSelections} ${category.name}`);
    }
  });

  return {
    valid: errors.length === 0,
    errors,
  };
};

/**
 * Convert selections to Shopify custom attributes
 * @param {object} modifierConfig - Product modifier configuration
 * @param {object} selections - Selected modifiers { categoryId: [modifierIds] }
 * @returns {Array} - Shopify custom attributes [{ key, value }]
 */
export const selectionsToCustomAttributes = (modifierConfig, selections) => {
  if (!modifierConfig || !selections) return [];

  const attributes = [];

  modifierConfig.modifierCategories.forEach(category => {
    const selectedIds = selections[category.id] || [];
    if (selectedIds.length === 0) return;

    // Get modifier names for display
    const selectedNames = selectedIds
      .map(id => category.modifiers.find(m => m.id === id)?.name)
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
 * Get default selections (pre-select first option for required SINGLE categories)
 * @param {object} modifierConfig - Product modifier configuration
 * @returns {object} - Default selections { categoryId: [modifierIds] }
 */
export const getDefaultSelections = (modifierConfig) => {
  if (!modifierConfig) return {};

  const defaults = {};

  modifierConfig.modifierCategories.forEach(category => {
    if (category.required && category.selectionType === SELECTION_TYPES.SINGLE) {
      // Pre-select first option for required single-select categories
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

export default PRODUCT_MODIFIERS;
