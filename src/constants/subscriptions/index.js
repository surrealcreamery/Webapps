import {
    CAMPAIGN_URL,
    PLANS_URL,
    LIST_BENEFITS_URL, // ADDED
    SUBSCRIBER_URL,
    OTP_VERIFY_URL,
    RETRIEVE_CUSTOMER_URL,
    SUBSCRIPTION_CHARGE_URL,
    SAVE_CARD_URL,
    SQUARE_APP_ID,
    SQUARE_LOCATION_ID
} from '@/constants/subscriptions/subscriptionsConstants';

// Re-export all constants for centralized API access
export {
    CAMPAIGN_URL,
    PLANS_URL,
    LIST_BENEFITS_URL, // ADDED
    SUBSCRIBER_URL,
    OTP_VERIFY_URL,
    RETRIEVE_CUSTOMER_URL,
    SUBSCRIPTION_CHARGE_URL,
    SAVE_CARD_URL,
    SQUARE_APP_ID,
    SQUARE_LOCATION_ID
};

export async function fetchCampaign(utmParams) {
    const requestId = `req_${Math.random().toString(36).substring(2, 7)}`;
    console.groupCollapsed(`%c[API] fetchCampaign | ID: ${requestId}`, 'color: #a78bfa; font-weight: bold;');
    console.log('Fetching with params:', utmParams || {});
    
    try {
        const response = await fetch(CAMPAIGN_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(utmParams || {}),
        });

        console.log(`Response Status: ${response.status} ${response.statusText}`);
        
        if (!response.ok) {
            console.error('Response was not OK. Status:', response.status);
            throw new Error(`Campaign fetch failed: ${response.statusText}`);
        }

        const rawText = await response.text();
        
        try {
            const data = JSON.parse(rawText);
            console.log('Successfully parsed JSON response:', data);
            console.groupEnd();
            return data[0] || {};
        } catch (jsonError) {
            console.error('CRITICAL: Failed to parse JSON response! The server may have sent an HTML error page instead of JSON.', jsonError);
            console.log('Raw text response from server:', rawText);
            console.groupEnd();
            throw new Error('Failed to parse campaign JSON.');
        }

    } catch (error) {
        console.error("A critical network or fetch error occurred in fetchCampaign:", error);
        console.groupEnd();
        throw error;
    }
}

export async function fetchPlans() {
    const requestId = `req_${Math.random().toString(36).substring(2, 7)}`;
    console.groupCollapsed(`%c[API] fetchPlans | ID: ${requestId}`, 'color: #a78bfa; font-weight: bold;');

    try {
        const response = await fetch(PLANS_URL);
        
        console.log(`Response Status: ${response.status} ${response.statusText}`);

        if (!response.ok) {
            console.error('Response was not OK. Status:', response.status);
            throw new Error(`Plans fetch failed: ${response.statusText}`);
        }

        const rawText = await response.text();

        try {
            const data = JSON.parse(rawText);
            console.log('Successfully parsed JSON response:', data);
            console.groupEnd();
            return data;
        } catch (jsonError) {
            console.error('CRITICAL: Failed to parse JSON response! The server may have sent an HTML error page instead of JSON.', jsonError);
            console.log('Raw text response from server:', rawText);
            console.groupEnd();
            throw new Error('Failed to parse plans JSON.');
        }

    } catch (error) {
        console.error("A critical network or fetch error occurred in fetchPlans:", error);
        console.groupEnd();
        throw error;
    }
}

// --- NEW FUNCTION ---
// This function was missing. It fetches the benefits data from the new URL.
export async function fetchBenefits() {
    const requestId = `req_${Math.random().toString(36).substring(2, 7)}`;
    console.groupCollapsed(`%c[API] fetchBenefits | ID: ${requestId}`, 'color: #34d399; font-weight: bold;');

    try {
        const response = await fetch(LIST_BENEFITS_URL);
        
        console.log(`Response Status: ${response.status} ${response.statusText}`);

        if (!response.ok) {
            console.error('Response was not OK. Status:', response.status);
            throw new Error(`Benefits fetch failed: ${response.statusText}`);
        }

        const rawText = await response.text();

        try {
            const data = JSON.parse(rawText);
            console.log('Successfully parsed JSON response:', data);
            console.groupEnd();
            return data;
        } catch (jsonError) {
            console.error('CRITICAL: Failed to parse JSON response!', jsonError);
            console.log('Raw text response from server:', rawText);
            console.groupEnd();
            throw new Error('Failed to parse benefits JSON.');
        }

    } catch (error) {
        console.error("A critical network or fetch error occurred in fetchBenefits:", error);
        console.groupEnd();
        throw error;
    }
}