/**
 * Unified Analytics Service — PostHog + GA4 + Custom Event Tracker
 *
 * PostHog handles: session replay, autocapture (clicks, pageviews, scroll depth,
 * device info, time on page), and the manual ecommerce events below.
 * GA4 functions from google-tag-manager.js are fired alongside PostHog where applicable.
 *
 * PostHog API key is fetched from DynamoDB config (Settings → API Keys → PostHog).
 */
import posthog from 'posthog-js';
import {
  trackViewItem,
  trackAddToCart as ga4AddToCart,
  trackRemoveFromCart as ga4RemoveFromCart,
  trackViewCart as ga4ViewCart,
  trackBeginCheckout as ga4BeginCheckout,
  trackSelectItem as ga4SelectItem,
  trackPurchase as ga4Purchase,
  trackEventRegistration as ga4EventRegistration,
} from '@/components/google-tag-manager/google-tag-manager';
import { init as initTracker, track, flush, setTrackerCartId, setCustomerId as setTrackerCustomerId, getVisitorId, getEnvironment } from './eventTracker';
import { persistVisitorSegment } from './segmentService';

const CHECKOUT_API_URL = 'https://viif6favb73jr3pm2ph6qcten40ethnp.lambda-url.us-east-1.on.aws';

let posthogReady = false;

export function initAnalytics() {
  if (typeof window === 'undefined') return;
  initTracker();

  // The events flow navigates via raw history.pushState and signals each change with 'events:nav'
  // (React Router's useLocation doesn't see bare pushState). Fire a PageView on each so game-specific
  // URLs (/events/pokemon/…) register with the pixels + CAPI regardless of how they're reached.
  window.addEventListener('events:nav', () => trackSpaPageView(window.location.pathname));

  // Auto-identify visitor from email subscriber ID (sid= and sn= in URL)
  const urlParams = new URLSearchParams(window.location.search);
  const sidParam = urlParams.get('sid');
  if (sidParam) {
    const snParam = urlParams.get('sn');
    identifyUser(sidParam, { ...(snParam ? { name: snParam } : {}) });
  }

  fetch(CHECKOUT_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'getCheckoutConfig' }),
  })
    .then(res => res.json())
    .then(data => {
      const result = typeof data.body === 'string' ? JSON.parse(data.body) : data;
      const key = result.posthogApiKey;
      if (!key) return;
      posthog.init(key, {
        api_host: result.posthogHost || 'https://us.i.posthog.com',
        autocapture: true,
        capture_pageview: true,
        capture_pageleave: true,
        scroll_depth: true,
        session_recording: { maskAllInputs: true },
      });
      posthogReady = true;
    })
    .catch(() => {});
}

function ph(method, ...args) {
  if (posthogReady) posthog[method](...args);
}

// ── Identity ──

export function identifyUser(customerId, traits = {}) {
  ph('identify', customerId, traits);
  setTrackerCustomerId(customerId);
  track('identify', { customer_id: customerId, ...traits });
  // Link visitorId → customerId on server for cross-session identity resolution
  const vid = getVisitorId();
  if (vid && customerId) {
    const customerName = traits.name || [traits.firstName, traits.lastName].filter(Boolean).join(' ') || null;
    const customerEmail = traits.email || (customerId.includes('@') ? customerId : null);
    persistVisitorSegment(vid, null, null, null, null, customerId, getEnvironment(), null, null, customerName, customerEmail);
  }
}

export function setCartId(cartId) {
  if (cartId) ph('register', { cart_id: cartId });
  setTrackerCartId(cartId);
}

// ── SPA page views ──
// The base Meta/TikTok pixels only fire PageView on hard load, and React Router's page-view effect
// only catches router-driven navigation. This app (esp. the events flow) also navigates via raw
// history.pushState, which both miss. Call this on every client-side URL change so a PageView reaches
// the Meta pixel + Meta CAPI (via the 'page_view' event) and TikTok. Deduped by path so overlapping
// triggers (popstate + events:nav for the same URL) fire at most once.
let lastPageViewPath = null;
export function trackSpaPageView(path) {
  if (typeof window === 'undefined') return;
  const p = path || window.location.pathname;
  if (!p || p === lastPageViewPath) return;
  lastPageViewPath = p;
  track('page_view', { path: p });                                  // first-party → Meta CAPI PageView
  if (typeof fbq === 'function') fbq('track', 'PageView');           // Meta browser pixel
  if (typeof window.ttq?.page === 'function') window.ttq.page();     // TikTok browser pixel
}

// ── Navigation & Site Chrome ──

export function trackMenuOpened() {
  track('menu_opened');
}

export function trackMenuClosed() {
  track('menu_closed');
}

export function trackNavItemClicked(label, path) {
  track('nav_item_clicked', { label, path });
}

export function trackLogoClicked() {
  track('logo_clicked');
}

export function trackLocationSelectorOpened() {
  track('location_selector_opened');
}

export function trackLocationChanged(locationId, locationName) {
  track('location_changed', { location_id: locationId, location_name: locationName });
}

export function trackCartButtonClicked(itemCount) {
  track('cart_button_clicked', { item_count: itemCount });
}

export function trackAccountButtonClicked() {
  track('account_button_clicked');
}

export function trackFooterLinkClicked(linkType) {
  track('footer_link_clicked', { link_type: linkType });
}

export function trackSocialLinkClicked(platform) {
  track('social_link_clicked', { platform });
}

export function trackBackButtonClicked(fromPath) {
  track('back_button_clicked', { from_path: fromPath });
}

export function trackLocationCallClicked(locationName) {
  track('location_call_clicked', { location_name: locationName });
}

export function trackLocationDirectionsClicked(locationName) {
  track('location_directions_clicked', { location_name: locationName });
}

export function trackLocationSelectorClosed() {
  track('location_selector_closed');
}

export function trackStoreLocatorSelected(locationId, locationName) {
  track('store_locator_selected', { location_id: locationId, location_name: locationName });
}

export function trackStoreLocatorClosed() {
  track('store_locator_closed');
}

export function trackTerminalCheckoutCancelled() {
  track('terminal_checkout_cancelled');
}

export function trackExternalLinkClicked(url, label) {
  track('external_link_clicked', { url, label });
}

export function trackEventCardClicked(eventId, eventTitle) {
  track('event_card_clicked', { event_id: eventId, event_title: eventTitle });
}

export function trackRedeemButtonClicked() {
  track('redeem_button_clicked');
}

export function trackFooterModalClosed(modalType) {
  track('footer_modal_closed', { modal_type: modalType });
}

export function trackProductAlertDismissed(productId, errorMessage) {
  track('product_alert_dismissed', { product_id: productId, error: errorMessage });
}

// ── Browse / Product funnel ──

export function trackCategoryViewed(categoryId, categoryName) {
  ph('capture', 'category_viewed', { category_id: categoryId, category_name: categoryName });
  track('category_viewed', { category_id: categoryId, category_name: categoryName });
}

export function trackProductClicked(product, position) {
  if (!product) return;
  ph('capture', 'product_clicked', {
    product_id: product.id || product.sku,
    name: product.name,
    category: product.category || product.type,
    price: parseFloat(product.price || 0),
    position,
  });
  ga4SelectItem(product);
  track('product_clicked', { product_id: product.id || product.sku, name: product.name, position });
}

export function trackProductViewed(product, variant) {
  if (!product) return;
  ph('capture', 'product_viewed', {
    product_id: product.id || product.sku,
    name: product.name,
    variant_id: variant?.sku || null,
    price: parseFloat(variant?.price || product.price || 0),
    has_modifiers: !!(product.modifiers?.length),
  });
  trackViewItem(product, variant);
  track('product_viewed', { product_id: product.id || product.sku, name: product.name, variant_id: variant?.sku || null, price: parseFloat(variant?.price || product.price || 0) });
}

export function trackProductModalClosed(productId, dwellMs) {
  track('product_modal_closed', { product_id: productId, dwell_ms: dwellMs });
}

export function trackProductImageNavigated(productId, direction, imageIndex) {
  track('product_image_navigated', { product_id: productId, direction, image_index: imageIndex });
}

export function trackVariantSelected(product, variant) {
  if (!variant) return;
  ph('capture', 'variant_selected', {
    product_id: product?.id || product?.sku,
    variant_id: variant.sku,
    variant_name: variant.name || variant.title,
    price: parseFloat(variant.price || 0),
  });
  track('variant_selected', { product_id: product?.id || product?.sku, variant_id: variant.sku, price: parseFloat(variant.price || 0) });
}

export function trackQuantityChanged(productId, quantity) {
  track('quantity_changed', { product_id: productId, quantity });
}

export function trackModifierSelected(productId, modifierCategory, optionName, price) {
  track('modifier_selected', { product_id: productId, modifier_category: modifierCategory, option_name: optionName, price });
}

export function trackModifiersCompleted(productId, selectionsCount) {
  track('modifiers_completed', { product_id: productId, selections_count: selectionsCount });
}

// ── Cart ──

export function trackAddedToCart(product, variant, quantity, modifiers = [], source = 'browse') {
  if (!product) return;
  ph('capture', 'added_to_cart', {
    product_id: product.id || product.sku,
    variant_id: variant?.sku,
    name: product.name,
    price: parseFloat(variant?.price || product.price || 0),
    quantity,
    modifiers: modifiers.map(m => m.key || m.name || m).filter(Boolean),
    source,
  });
  ga4AddToCart(product, variant, quantity);
  track('added_to_cart', { product_id: product.id || product.sku, variant_id: variant?.sku, name: product.name, price: parseFloat(variant?.price || product.price || 0), quantity, source });
}

export function trackCartViewed(items, subtotal) {
  ph('capture', 'cart_viewed', {
    item_count: items?.length || 0,
    subtotal: parseFloat(subtotal || 0),
  });
  ga4ViewCart(items, subtotal);
  track('cart_viewed', { item_count: items?.length || 0, subtotal: parseFloat(subtotal || 0) });
}

export function trackCartClosed(itemCount) {
  track('cart_closed', { item_count: itemCount });
}

export function trackCartQuantityChanged(productId, variantId, oldQty, newQty) {
  track('cart_quantity_changed', { product_id: productId, variant_id: variantId, old_qty: oldQty, new_qty: newQty });
}

export function trackRemovedFromCart(item) {
  if (!item) return;
  ph('capture', 'removed_from_cart', {
    product_id: item.sku || item.id,
    variant_id: item.variantSku,
    name: item.name,
  });
  ga4RemoveFromCart(item);
  track('removed_from_cart', { product_id: item.sku || item.id, variant_id: item.variantSku });
}

export function trackPromoCodeApplied(code, discountAmount) {
  track('promo_code_applied', { code, discount_amount: discountAmount });
}

export function trackPromoCodeRemoved(code) {
  track('promo_code_removed', { code });
}

export function trackPromoCodeError(code, error) {
  track('promo_code_error', { code, error });
}

export function trackBlindBoxAdded(quantity, rewardType) {
  track('blind_box_added', { quantity, reward_type: rewardType });
}

export function trackRewardSelected(rewardId, productId) {
  track('reward_selected', { reward_id: rewardId, product_id: productId });
}

// ── Cross-sell & Recommendations ──

export function trackCrossSellShown(productIds, triggerProductId) {
  track('cross_sell_shown', { products: productIds, trigger_product_id: triggerProductId });
}

export function trackCrossSellProductClicked(productId, position, triggerProductId) {
  track('cross_sell_product_clicked', { product_id: productId, position, trigger_product_id: triggerProductId });
}

export function trackCrossSellAddedToCart(productId, variantId, price, triggerProductId) {
  track('cross_sell_added_to_cart', { product_id: productId, variant_id: variantId, price, trigger_product_id: triggerProductId });
}

// ── Delivery Check ──

export function trackDeliveryCheckStarted(productId) {
  track('delivery_check_started', { product_id: productId });
}

export function trackDeliveryAddressEntered(method) {
  track('delivery_address_entered', { method });
}

export function trackDeliveryAddressValidated(available, distanceMiles, fee, estimatedMinutes) {
  track('delivery_address_validated', { available, distance_miles: distanceMiles, fee, estimated_minutes: estimatedMinutes });
}

export function trackDeliveryAddressFailed(error, distanceMiles) {
  track('delivery_address_failed', { error, distance_miles: distanceMiles });
}

export function trackDeliveryConfirmed(fee, locationId) {
  track('delivery_confirmed', { fee, location_id: locationId });
}

export function trackDeliverySwitchedToPickup(productId) {
  track('delivery_switched_to_pickup', { product_id: productId });
}

// ── Checkout ──

export function trackCheckoutStarted(items, subtotal, fulfillmentMethod) {
  ph('capture', 'checkout_started', {
    item_count: items?.length || 0,
    subtotal: parseFloat(subtotal || 0),
    fulfillment_method: fulfillmentMethod,
  });
  ga4BeginCheckout(items, subtotal);
  track('checkout_started', { item_count: items?.length || 0, subtotal: parseFloat(subtotal || 0), fulfillment_method: fulfillmentMethod });
}

export function trackCheckoutContactEntered(hasEmail, hasPhone) {
  track('checkout_contact_entered', { has_email: hasEmail, has_phone: hasPhone });
}

export function trackCheckoutPickupLocationSelected(locationId, locationName) {
  track('checkout_pickup_location_selected', { location_id: locationId, location_name: locationName });
}

export function trackCheckoutShippingAddressEntered() {
  track('checkout_shipping_address_entered');
}

export function trackCheckoutShippingRateSelected(carrier, rateName, price) {
  track('checkout_shipping_rate_selected', { carrier, rate_name: rateName, price });
}

export function trackCheckoutPromoApplied(code, discountAmount) {
  track('checkout_promo_applied', { code, discount_amount: discountAmount });
}

export function trackCheckoutPromoError(code, error) {
  track('checkout_promo_error', { code, error });
}

export function trackTipSelected(percentage, amount) {
  track('tip_selected', { percentage, amount });
}

export function trackCustomTipEntered(amount) {
  track('custom_tip_entered', { amount });
}

export function trackPaymentMethodSelected(method) {
  track('payment_method_selected', { method });
}

export function trackFulfillmentSelected(method, locationSlug) {
  ph('capture', 'fulfillment_selected', { method, location_slug: locationSlug });
  track('fulfillment_selected', { method, location_slug: locationSlug });
}

export function trackPaymentAttempted(paymentMethod, totalCents) {
  ph('capture', 'payment_attempted', {
    payment_method: paymentMethod,
    total_cents: totalCents,
  });
  track('payment_attempted', { payment_method: paymentMethod, total_cents: totalCents });
}

export function trackPaymentFailed(paymentMethod, error) {
  track('payment_failed', { payment_method: paymentMethod, error });
}

export function trackOrderCompleted(result, { subtotal, tax, tip, total, itemCount, paymentMethod, cartItems } = {}) {
  const orderId = result?.orderId || result?.receiptNumber;
  // Checkout API returns amounts in cents — convert to dollars for GA4/Meta
  const centsToD = (v) => { const n = typeof v === 'number' ? v : parseFloat(v || 0); return n > 0 && Number.isInteger(n) ? n / 100 : n; };
  const totalDollars = centsToD(total);
  const taxDollars = centsToD(tax);

  ph('capture', 'order_completed', {
    order_id: orderId,
    subtotal,
    tax,
    tip,
    total,
    item_count: itemCount,
    payment_method: paymentMethod,
  });
  track('order_completed', { order_id: orderId, total, item_count: itemCount, payment_method: paymentMethod });

  // GA4 purchase event
  const ga4Items = (cartItems || []).map(item => ({
    item_id: item.variantSku || item.sku || item.id,
    item_name: item.name || item.title,
    price: parseFloat(item.unitPrice || item.price || item.variant?.price?.amount || item.variant?.price || 0),
    quantity: item.quantity || 1,
    item_variant: item.variantName || item.variantTitle || item.variant?.title || undefined,
  }));
  ga4Purchase(orderId, totalDollars, ga4Items, { tax: taxDollars });

  // Meta Pixel — Purchase
  if (typeof fbq === 'function') {
    fbq('track', 'Purchase', {
      value: totalDollars,
      currency: 'USD',
      content_type: 'product',
      num_items: itemCount || ga4Items.length,
    }, { eventID: orderId });
  }
}

export function trackOrderConfirmationViewed(orderId) {
  track('order_confirmation_viewed', { order_id: orderId });
}

export function trackOrderSummaryToggled(expanded) {
  track('order_summary_toggled', { expanded });
}

// ── Auth ──

export function trackOtpRequested(method) {
  track('otp_requested', { method });
}

export function trackOtpEntered(valid) {
  track('otp_entered', { valid });
}

export function trackLoginSuccessful(customerId) {
  track('login_successful', { customer_id: customerId });
}

export function trackLogout() {
  track('logout');
}

// ── Subscriptions ──

export function trackSubscriptionPlanViewed(planId, planName, price) {
  track('subscription_plan_viewed', { plan_id: planId, plan_name: planName, price });
}

export function trackSubscriptionPlanSelected(planId) {
  track('subscription_plan_selected', { plan_id: planId });
}

export function trackSubscriptionModelSelected(modelType) {
  track('subscription_model_selected', { model_type: modelType });
}

export function trackSubscriptionFrequencySelected(frequencyDays) {
  track('subscription_frequency_selected', { frequency_days: frequencyDays });
}

export function trackSubscriptionLocationSelected(locationId) {
  track('subscription_location_selected', { location_id: locationId });
}

export function trackSubscriptionModifierSelected(optionId, step) {
  track('subscription_modifier_selected', { option_id: optionId, step });
}

export function trackSubscriptionPaymentAttempted(planId, total) {
  track('subscription_payment_attempted', { plan_id: planId, total });
}

export function trackSubscriptionCompleted(orderId, planId, total, { planName } = {}) {
  const totalDollars = parseFloat(total || 0);
  track('subscription_completed', { order_id: orderId, plan_id: planId, total });

  // GA4 purchase event
  ga4Purchase(orderId, totalDollars, [{
    item_id: planId || 'subscription',
    item_name: planName || `Subscription ${planId || ''}`.trim(),
    price: totalDollars,
    quantity: 1,
    item_category: 'subscription',
  }]);

  // Meta Pixel — Purchase
  if (typeof fbq === 'function') {
    fbq('track', 'Purchase', {
      value: totalDollars,
      currency: 'USD',
      content_type: 'subscription',
      content_ids: planId ? [planId] : undefined,
    }, { eventID: orderId || planId });
  }
}

export function trackRedemptionCodeEntered() {
  track('redemption_code_entered');
}

export function trackRedemptionClaimed(rewardId) {
  track('redemption_claimed', { reward_id: rewardId });
}

// ── Events / Fundraisers ──

export function trackEventViewed(eventId, eventName) {
  track('event_viewed', { event_id: eventId, event_name: eventName });
}

export function trackEventDetailsExpanded(eventId) {
  track('event_details_expanded', { event_id: eventId });
}

export function trackEventDateSelected(eventId, date) {
  track('event_date_selected', { event_id: eventId, date });
}

export function trackEventTimeSelected(eventId, time) {
  track('event_time_selected', { event_id: eventId, time });
}

export function trackEventRegistrationConfirmed(eventId, date, time, guests) {
  track('event_registration_confirmed', { event_id: eventId, date, time, guests });
}

export function trackEventsLoginClicked() {
  track('events_login_clicked');
}

export function trackEventsDashboardViewed() {
  track('events_dashboard_viewed');
}

export function trackEventLocationSelected(eventId, locationId, { autoSkipped = false } = {}) {
  track('event_location_selected', { event_id: eventId, location_id: locationId, auto_skipped: autoSkipped });
}

export function trackEventContactFormViewed(eventId, { autoFilled = false } = {}) {
  track('event_contact_form_viewed', { event_id: eventId, auto_filled: autoFilled });
}

export function trackEventContactFormSubmitted(eventId) {
  track('event_contact_form_submitted', { event_id: eventId });
}

export function trackEventOtpSent(eventId, channel) {
  track('event_otp_sent', { event_id: eventId, channel });
}

export function trackEventOtpVerified(eventId) {
  track('event_otp_verified', { event_id: eventId });
}

export function trackEventOtpSkipped(eventId) {
  track('event_otp_skipped', { event_id: eventId });
}

export function trackEventRegistrationCreated(eventId, { outcome, date, time, eventName, registrationId, paymentAmountCents, paymentMethod } = {}) {
  track('event_registration_created', { event_id: eventId, outcome, date, time });

  if (outcome === 'success') {
    const isPaid = paymentMethod && paymentAmountCents > 0;
    const valueDollars = isPaid ? paymentAmountCents / 100 : 0;

    // Meta Pixel — CompleteRegistration (eventID for server-side CAPI deduplication)
    if (typeof fbq === 'function') {
      fbq('track', 'CompleteRegistration', {
        content_name: eventName || eventId,
        content_type: 'event_registration',
        status: 'registered',
        ...(isPaid ? { value: valueDollars, currency: 'USD' } : {}),
      }, { eventID: registrationId || eventId });
    }

    if (isPaid) {
      // Meta Pixel — Purchase for paid registrations (revenue attribution)
      if (typeof fbq === 'function') {
        fbq('track', 'Purchase', {
          value: valueDollars,
          currency: 'USD',
          content_type: 'event_registration',
          content_name: eventName || eventId,
          content_ids: [eventId],
        }, { eventID: `purchase_${registrationId || eventId}` });
      }

      // GA4 — purchase event with revenue
      ga4Purchase(registrationId || eventId, valueDollars, [{
        item_id: `event-${eventId}`,
        item_name: eventName || 'Event Registration',
        price: valueDollars,
        quantity: 1,
        item_category: 'event_registration',
      }]);
    } else {
      // GA4 — generate_lead for free registrations
      ga4EventRegistration(eventId, eventName || eventId);
    }
  }
}

export function trackEventFlowStarted(eventId, { source = 'manual', autoRegister = false } = {}) {
  track('event_flow_started', { event_id: eventId, source, auto_register: autoRegister });
}

export function trackEventRegistrationFailed(eventId, { contactInfo, date, time, locationId, reason } = {}) {
  track('event_registration_failed', {
    event_id: eventId,
    first_name: contactInfo?.firstName,
    last_name: contactInfo?.lastName,
    email: contactInfo?.email,
    mobile_number: contactInfo?.mobileNumber,
    organization_name: contactInfo?.organizationName,
    date,
    time,
    location_id: locationId,
    reason,
    label: `${contactInfo?.firstName} ${contactInfo?.lastName} | ${contactInfo?.email} | ${contactInfo?.mobileNumber}`,
  });
  flush(true); // Force immediate sendBeacon — don't wait for batch timer
}

// ── Catering ──

export function trackCateringLogin() {
  track('catering_login');
}

export function trackCateringCategorySelected(categoryId) {
  track('catering_category_selected', { category_id: categoryId });
}

export function trackCateringItemViewed(itemId, name, price) {
  track('catering_item_viewed', { item_id: itemId, name, price });
}

export function trackCateringItemAdded(itemId, quantity) {
  track('catering_item_added', { item_id: itemId, quantity });
}

export function trackCateringCartViewed(itemCount, subtotal) {
  track('catering_cart_viewed', { item_count: itemCount, subtotal });
}

export function trackCateringItemRemoved(itemId) {
  track('catering_item_removed', { item_id: itemId });
}

export function trackCateringCheckoutStarted(itemCount, subtotal) {
  track('catering_checkout_started', { item_count: itemCount, subtotal });
}

export function trackCateringOrderSubmitted(orderId, total) {
  const totalDollars = parseFloat(total || 0);
  track('catering_order_submitted', { order_id: orderId, total });

  // GA4 purchase event
  ga4Purchase(orderId, totalDollars, [{
    item_id: 'catering-order',
    item_name: 'Catering Order',
    price: totalDollars,
    quantity: 1,
    item_category: 'catering',
  }]);

  // Meta Pixel — Purchase
  if (typeof fbq === 'function') {
    fbq('track', 'Purchase', {
      value: totalDollars,
      currency: 'USD',
      content_type: 'product',
    }, { eventID: orderId });
  }
}

// ── Errors ──

export function trackValidationError(field, error) {
  track('validation_error', { field, error });
}

export function trackApiError(endpoint, status, error) {
  track('api_error', { endpoint, status, error });
}

export function trackPaymentError(gateway, error) {
  track('payment_error', { gateway, error });
}
