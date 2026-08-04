// Consumer Loyalty Service — Surreal Rewards
// Uses session tokens for auth (same pattern as consumer-orders-api)

const LOYALTY_API_URL = import.meta.env.VITE_LOYALTY_API_URL || '';

async function callLoyaltyApi(action, params = {}) {
  if (!LOYALTY_API_URL) return null;
  const response = await fetch(LOYALTY_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...params }),
  });
  const data = await response.json();
  if (data.error) throw new Error(data.error);
  return data;
}

/**
 * Get consumer loyalty account, rewards catalog, and recent activity.
 * @param {string} sessionToken — OTP session token from checkout-api auth
 */
export async function getConsumerLoyalty(sessionToken) {
  return callLoyaltyApi('getConsumerLoyalty', { sessionToken });
}

/**
 * Redeem a reward (preset or flexible).
 * Returns { discountCode, discountCents, pointsSpent, newBalance }
 */
export async function consumerRedeem(sessionToken, { rewardId, pointsAmount } = {}) {
  return callLoyaltyApi('consumerRedeem', { sessionToken, rewardId, pointsAmount });
}

/**
 * Validate a LOYALTY-* discount code (called by checkout flow).
 */
export async function validateLoyaltyDiscount(discountCode) {
  return callLoyaltyApi('validateLoyaltyDiscount', { discountCode });
}
