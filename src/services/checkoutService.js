const CATALOG_API_URL = 'https://ou6oqgnnqjo542342x64srup4q0ofoua.lambda-url.us-east-1.on.aws';

/**
 * Create a web checkout via Lambda → Shopify Draft Order
 * @param {Object} params
 * @param {Array} params.cartItems - Local cart items
 * @param {string} params.pickupLocation - Selected location slug
 * @param {string} params.cartSessionId - Cart session UUID for idempotency
 * @returns {Promise<Object>} { checkoutUrl, draftOrderId, validatedTotal, appliedDiscounts, priceAdjustments }
 */
export async function createWebCheckout({ cartItems, pickupLocation, cartSessionId }) {
    const res = await fetch(CATALOG_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            action: 'createWebCheckout',
            cartItems: cartItems.map(item => ({
                productId: item.productId,
                variantId: item.variantId,
                sku: item.sku,
                variantSku: item.variantSku,
                name: item.name,
                variantName: item.variantName,
                clientPrice: item.unitPrice,
                quantity: item.quantity,
                modifiers: item.modifiers || [],
                isFreeGift: item.isFreeGift || false,
                discountId: item.discountId || null,
                image: item.image,
            })),
            pickupLocation,
            cartSessionId,
        }),
    });

    const data = await res.json();
    const result = typeof data.body === 'string' ? JSON.parse(data.body) : data;

    if (result.error) {
        throw new Error(result.error);
    }

    return result;
}

/**
 * Calculate Square order (tax preview, no payment)
 */
export async function calculateSquareOrder(params) {
    const res = await fetch(CATALOG_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'calculateSquareOrder', ...params }),
    });
    const data = await res.json();
    const result = typeof data.body === 'string' ? JSON.parse(data.body) : data;
    if (result.error) throw new Error(result.error);
    return result;
}

/**
 * Create Square checkout (order + payment)
 */
export async function createSquareCheckout(params) {
    const res = await fetch(CATALOG_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'createSquareCheckout', ...params }),
    });
    const data = await res.json();
    const result = typeof data.body === 'string' ? JSON.parse(data.body) : data;
    if (result.error) throw new Error(result.error);
    return result;
}

/**
 * Send OTP for checkout verification
 */
export async function sendCheckoutOtp({ to, channel }) {
    const res = await fetch(CATALOG_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sendCheckoutOtp', to, channel }),
    });
    const data = await res.json();
    const result = typeof data.body === 'string' ? JSON.parse(data.body) : data;
    if (result.error) throw new Error(result.error);
    return result;
}

/**
 * Verify OTP and get/create customer account
 */
export async function verifyCheckoutOtp({ to, code, channel }) {
    const res = await fetch(CATALOG_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verifyCheckoutOtp', to, code, channel }),
    });
    const data = await res.json();
    const result = typeof data.body === 'string' ? JSON.parse(data.body) : data;
    if (result.error) throw new Error(result.error);
    return result;
}
