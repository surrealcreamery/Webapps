// Subscription API (Lambda) - replaces all Make.com webhook URLs
export const SUBSCRIPTION_API_URL            = 'https://cnnpmufvrvqh2ixhhzmlc53iky0ztboz.lambda-url.us-east-1.on.aws';

// Legacy exports (all point to Lambda now, kept for backwards compatibility)
export const CAMPAIGN_URL                    = SUBSCRIPTION_API_URL;
export const PLANS_URL                       = SUBSCRIPTION_API_URL;
export const SUBSCRIBER_URL                  = SUBSCRIPTION_API_URL;
export const OTP_VERIFY_URL                  = SUBSCRIPTION_API_URL;
export const RETRIEVE_CUSTOMER_URL           = SUBSCRIPTION_API_URL;
export const SUBSCRIPTION_CHARGE_URL         = SUBSCRIPTION_API_URL;
export const SAVE_CARD_URL                   = SUBSCRIPTION_API_URL;
export const LIST_CUSTOMER_SUBSCRIPTIONS_URL = SUBSCRIPTION_API_URL;
export const UPDATE_PROFILE_URL              = SUBSCRIPTION_API_URL;
export const CANCEL_SUBSCRIPTION_URL         = SUBSCRIPTION_API_URL;
export const RETRIEVE_SUBSCRIPTION_URL       = SUBSCRIPTION_API_URL;
export const LIST_CUSTOMER_CARDS_URL         = SUBSCRIPTION_API_URL;
export const UPDATE_SUBSCRIPTION_PAYMENT_URL = SUBSCRIPTION_API_URL;
export const LIST_ENTITLEMENTS_URL           = SUBSCRIPTION_API_URL;
export const LIST_BENEFITS_URL               = SUBSCRIPTION_API_URL;


// Square Credentials
export const SQUARE_APP_ID = 'sq0idp-GXvPNzqyJswx5f-vNEtlWg';
export const SQUARE_LOCATION_ID = 'L0YEMRGMF5ZXK';

// Local Storage Keys
export const AUTH_STORAGE_KEY   = 'unified-auth-session'; // The new, single key for authentication state.
export const WIZARD_STORAGE_KEY = 'subscription-wizard-state-advanced'; // Stores the full, temporary state of the wizard flow.
export const REDEEM_AUTH_KEY    = 'redeemAuth'; // Will be deprecated or used for non-auth page state.