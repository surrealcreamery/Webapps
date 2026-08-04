// Static files for public event listing
export const LIST_EVENTS_URL                                   = 'https://data.surrealcreamery.com/events.json';
export const LIST_LOCATIONS_URL                                = 'https://data.surrealcreamery.com/locations.json';

// Lambda API URLs (replaced make.com endpoints)
export const EVENTS_API_URL                                    = 'https://svlh6ckfdkcgh4fbvub2nyz2r40mcvdq.lambda-url.us-east-1.on.aws';
export const TWILIO_API_URL                                    = 'https://7rnb6v5zciq4rdjnlhly2v6kj40luwjc.lambda-url.us-east-1.on.aws';

// Legacy exports pointing to Lambda (for compatibility)
export const LIST_REGISTERED_EVENTS_FOR_USER_URL               = EVENTS_API_URL;  // action: getRegisteredEvents
export const LIST_AND_UPDATE_TRANSACTION_DETAILS_AND_TALLY_URL = EVENTS_API_URL;  // action: getTransactionDetails
export const CREATE_EVENT_REGISTRATION_URL                     = EVENTS_API_URL;  // action: createEventRegistration
export const CREATE_ORGANIZATION_URL                           = EVENTS_API_URL;  // action: createOrganization
export const CHECK_GUEST_STATUS_URL                            = EVENTS_API_URL;  // action: checkGuestStatus
export const UPDATE_PAYEE_URL                                  = EVENTS_API_URL;  // action: updatePayee

// Twilio OTP verification via Lambda
export const OTP_VERIFY_URL                                    = TWILIO_API_URL;  // action: sendOtp / verifyOtp
export const AUTHENTICATE_GUEST_URL                            = TWILIO_API_URL;  // action: sendOtp / verifyOtp

// Consumer account APIs (orders + loyalty + subscriptions, authenticated via OTP session token)
export const CONSUMER_ORDERS_URL = 'https://qeg2uc6ykdeexcnc64nn66ph7m0hrtep.lambda-url.us-east-1.on.aws';
export const LOYALTY_API_URL     = import.meta.env.VITE_LOYALTY_API_URL || '';
export const SUBSCRIPTION_API_URL = 'https://cnnpmufvrvqh2ixhhzmlc53iky0ztboz.lambda-url.us-east-1.on.aws';
