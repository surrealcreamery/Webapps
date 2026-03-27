import {
    SUBSCRIPTION_API_URL,
    SQUARE_APP_ID,
    SQUARE_LOCATION_ID
} from '@/constants/subscriptions/subscriptionsConstants';

// Re-export constants
export {
    SUBSCRIPTION_API_URL,
    SQUARE_APP_ID,
    SQUARE_LOCATION_ID
};

// Legacy re-exports for backwards compatibility
export { SUBSCRIPTION_API_URL as CAMPAIGN_URL } from '@/constants/subscriptions/subscriptionsConstants';
export { SUBSCRIPTION_API_URL as PLANS_URL } from '@/constants/subscriptions/subscriptionsConstants';
export { SUBSCRIPTION_API_URL as LIST_BENEFITS_URL } from '@/constants/subscriptions/subscriptionsConstants';
export { SUBSCRIPTION_API_URL as SUBSCRIBER_URL } from '@/constants/subscriptions/subscriptionsConstants';
export { SUBSCRIPTION_API_URL as OTP_VERIFY_URL } from '@/constants/subscriptions/subscriptionsConstants';
export { SUBSCRIPTION_API_URL as RETRIEVE_CUSTOMER_URL } from '@/constants/subscriptions/subscriptionsConstants';
export { SUBSCRIPTION_API_URL as SUBSCRIPTION_CHARGE_URL } from '@/constants/subscriptions/subscriptionsConstants';
export { SUBSCRIPTION_API_URL as SAVE_CARD_URL } from '@/constants/subscriptions/subscriptionsConstants';

/**
 * Helper to POST to the subscription Lambda with an action
 */
async function subscriptionApi(action, params = {}) {
    const response = await fetch(SUBSCRIPTION_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...params }),
    });

    if (!response.ok) {
        throw new Error(`Subscription API error: ${response.status}`);
    }

    const rawText = await response.text();
    try {
        return JSON.parse(rawText);
    } catch {
        return rawText;
    }
}

export async function fetchCampaign(utmParams) {
    const data = await subscriptionApi('fetchCampaign', utmParams || {});
    return (Array.isArray(data) ? data[0] : data) || {};
}

export async function fetchPlans() {
    return await subscriptionApi('getPlans');
}

export async function fetchBenefits() {
    return await subscriptionApi('getBenefits');
}
