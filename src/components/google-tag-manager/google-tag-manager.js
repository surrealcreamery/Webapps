/**
 * GA4 Client-Side Integration
 *
 * Setup:
 * 1. Import and call initGA4('G-XXXXXXXX') in router.jsx
 * 2. Server-side CAPI (Measurement Protocol) handles enriched events separately
 *
 * Events tracked:
 * - page_view: Page navigation
 * - view_item: Product detail view
 * - add_to_cart: Item added to cart
 * - remove_from_cart: Item removed from cart
 * - view_cart: Cart opened
 * - begin_checkout: Checkout started
 */

let GA4_ID = null;

/**
 * Initialize GA4 — gtag.js is loaded from index.html, this just stores the ID.
 * Call this so the tracking functions below know GA4 is active.
 */
export function initGA4(ga4Id) {
  if (ga4Id) GA4_ID = ga4Id;
}

// Backwards compat
export function initGTM(gtmId, ga4Id = null) {
  initGA4(ga4Id);
}

/**
 * Send event via gtag
 */
const isDebug = typeof location !== 'undefined' &&
  (location.hostname.indexOf('beta') === 0 || location.search.indexOf('ga_debug') > -1);

function pushEvent(event) {
  if (typeof window === 'undefined' || !window.gtag || !event.event) return;

  const debugParam = isDebug ? { debug_mode: true } : {};
  const { event: eventName, ecommerce, ...otherParams } = event;
  if (ecommerce) {
    window.gtag('event', eventName, { ...ecommerce, ...debugParam });
  } else {
    window.gtag('event', eventName, { ...otherParams, ...debugParam });
  }
}

/**
 * Clear ecommerce object before pushing new ecommerce event
 * Recommended by Google to prevent data leakage between events
 */
function clearEcommerce() {
  pushEvent({ ecommerce: null });
}

/**
 * Track page view
 */
export function trackPageView(pagePath, pageTitle) {
  pushEvent({
    event: 'page_view',
    page_path: pagePath,
    page_title: pageTitle
  });
}

/**
 * Track product view (when product modal opens)
 */
export function trackViewItem(product, variant = null) {
  if (!product) return;

  clearEcommerce();
  
  const item = {
    item_id: variant?.id || product.variantId || product.shopifyId || product.id,
    item_name: product.name,
    price: parseFloat(variant?.price || product.price?.replace('$', '') || 0),
    item_category: product.category || product.type || 'unknown',
    item_variant: variant?.title || product.variantTitle || null,
    quantity: 1
  };

  pushEvent({
    event: 'view_item',
    ecommerce: {
      currency: 'USD',
      value: item.price,
      items: [item]
    }
  });
}

/**
 * Track add to cart
 */
export function trackAddToCart(product, variant, quantity = 1) {
  if (!product) return;

  clearEcommerce();

  const price = parseFloat(variant?.price || product.price?.replace('$', '') || 0);
  
  const item = {
    item_id: variant?.id || product.variantId || product.id,
    item_name: product.name,
    price: price,
    item_category: product.category || product.type || 'unknown',
    item_variant: variant?.title || product.variantTitle || null,
    quantity: quantity
  };

  pushEvent({
    event: 'add_to_cart',
    ecommerce: {
      currency: 'USD',
      value: price * quantity,
      items: [item]
    }
  });
}

/**
 * Track remove from cart
 */
export function trackRemoveFromCart(lineItem) {
  if (!lineItem) return;

  clearEcommerce();

  const price = parseFloat(lineItem.variant?.price?.amount || lineItem.variant?.price || 0);
  
  const item = {
    item_id: lineItem.variant?.id || lineItem.id,
    item_name: lineItem.title,
    price: price,
    item_variant: lineItem.variant?.title || null,
    quantity: lineItem.quantity
  };

  pushEvent({
    event: 'remove_from_cart',
    ecommerce: {
      currency: 'USD',
      value: price * lineItem.quantity,
      items: [item]
    }
  });
}

/**
 * Track cart view (when cart drawer opens)
 */
export function trackViewCart(lineItems, subtotal) {
  if (!lineItems || lineItems.length === 0) return;

  clearEcommerce();

  const items = lineItems.map(item => ({
    item_id: item.variant?.id || item.id,
    item_name: item.title,
    price: parseFloat(item.variant?.price?.amount || item.variant?.price || 0),
    item_variant: item.variant?.title || null,
    quantity: item.quantity
  }));

  pushEvent({
    event: 'view_cart',
    ecommerce: {
      currency: 'USD',
      value: parseFloat(subtotal || 0),
      items: items
    }
  });
}

/**
 * Track begin checkout
 */
export function trackBeginCheckout(lineItems, subtotal) {
  if (!lineItems || lineItems.length === 0) return;

  clearEcommerce();

  const items = lineItems.map(item => ({
    item_id: item.variant?.id || item.id,
    item_name: item.title,
    price: parseFloat(item.variant?.price?.amount || item.variant?.price || 0),
    item_variant: item.variant?.title || null,
    quantity: item.quantity
  }));

  pushEvent({
    event: 'begin_checkout',
    ecommerce: {
      currency: 'USD',
      value: parseFloat(subtotal || 0),
      items: items
    }
  });
}

/**
 * Track product click (from recommendations or listings)
 */
export function trackSelectItem(product, listName = 'Product List') {
  if (!product) return;

  clearEcommerce();

  const item = {
    item_id: product.variantId || product.shopifyId || product.id,
    item_name: product.name,
    price: parseFloat(product.price?.replace('$', '') || 0),
    item_category: product.category || product.type || 'unknown',
    item_list_name: listName
  };

  pushEvent({
    event: 'select_item',
    ecommerce: {
      items: [item]
    }
  });
}

/**
 * Track product impressions (when products are displayed)
 */
export function trackViewItemList(products, listName = 'Product List') {
  if (!products || products.length === 0) return;

  clearEcommerce();

  const items = products.map((product, index) => ({
    item_id: product.variantId || product.shopifyId || product.id,
    item_name: product.name,
    price: parseFloat(product.price?.replace('$', '') || 0),
    item_category: product.category || product.type || 'unknown',
    item_list_name: listName,
    index: index
  }));

  pushEvent({
    event: 'view_item_list',
    ecommerce: {
      items: items
    }
  });
}

// Export all functions
export default {
  initGTM,
  trackPageView,
  trackViewItem,
  trackAddToCart,
  trackRemoveFromCart,
  trackViewCart,
  trackBeginCheckout,
  trackSelectItem,
  trackViewItemList
};
