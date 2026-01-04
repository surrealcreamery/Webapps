/**
 * Google Tag Manager & GA4 Integration
 * 
 * Setup:
 * 1. Import and call initGTM('GTM-XXXXXXX', 'G-XXXXXXXX') in router.jsx
 * 2. Tracking functions work automatically with both GTM and GA4
 * 
 * Events tracked:
 * - page_view: Page navigation
 * - view_item: Product detail view
 * - add_to_cart: Item added to cart
 * - remove_from_cart: Item removed from cart
 * - view_cart: Cart opened
 * - begin_checkout: Checkout started
 */

let GTM_ID = null;
let GA4_ID = null;

/**
 * Initialize Google Tag Manager and GA4
 * @param {string} gtmId - Your GTM Container ID (e.g., 'GTM-XXXXXXX')
 * @param {string} ga4Id - Your GA4 Measurement ID (e.g., 'G-XXXXXXXX')
 */
export function initGTM(gtmId, ga4Id = null) {
  if (typeof window === 'undefined') return;
  
  // Initialize dataLayer first (used by both GTM and GA4)
  window.dataLayer = window.dataLayer || [];
  
  // Initialize GTM
  if (gtmId) {
    GTM_ID = gtmId;
    
    const gtmScript = document.createElement('script');
    gtmScript.innerHTML = `
      (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
      new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
      j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
      'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
      })(window,document,'script','dataLayer','${GTM_ID}');
    `;
    document.head.insertBefore(gtmScript, document.head.firstChild);

    // Add noscript fallback
    const noscript = document.createElement('noscript');
    const iframe = document.createElement('iframe');
    iframe.src = `https://www.googletagmanager.com/ns.html?id=${GTM_ID}`;
    iframe.height = '0';
    iframe.width = '0';
    iframe.style.display = 'none';
    iframe.style.visibility = 'hidden';
    noscript.appendChild(iframe);
    document.body.insertBefore(noscript, document.body.firstChild);

    console.log('✅ GTM initialized:', GTM_ID);
  }
  
  // Initialize GA4
  if (ga4Id) {
    GA4_ID = ga4Id;
    
    // Load gtag.js
    const ga4Script = document.createElement('script');
    ga4Script.async = true;
    ga4Script.src = `https://www.googletagmanager.com/gtag/js?id=${GA4_ID}`;
    document.head.appendChild(ga4Script);
    
    // Initialize gtag
    window.gtag = function() {
      window.dataLayer.push(arguments);
    };
    window.gtag('js', new Date());
    window.gtag('config', GA4_ID, {
      send_page_view: false // We'll send page views manually for more control
    });

    console.log('✅ GA4 initialized:', GA4_ID);
  }
}

/**
 * Push event to dataLayer (for GTM) and gtag (for GA4)
 */
function pushEvent(event) {
  if (typeof window === 'undefined') return;
  
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push(event);
  
  // Also send to GA4 via gtag if available
  if (window.gtag && event.event) {
    const { event: eventName, ecommerce, ...otherParams } = event;
    if (ecommerce) {
      // GA4 ecommerce events
      window.gtag('event', eventName, ecommerce);
    } else {
      // Non-ecommerce events
      window.gtag('event', eventName, otherParams);
    }
  }
  
  console.log('📊 Analytics Event:', event);
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
