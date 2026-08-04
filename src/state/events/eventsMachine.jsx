import { setup, assign, fromPromise, createMachine } from 'xstate';
import { EVENTS_API_URL, OTP_VERIFY_URL, CHECK_GUEST_STATUS_URL, AUTHENTICATE_GUEST_URL, CREATE_EVENT_REGISTRATION_URL, LIST_REGISTERED_EVENTS_FOR_USER_URL, LIST_AND_UPDATE_TRANSACTION_DETAILS_AND_TALLY_URL, CREATE_ORGANIZATION_URL, UPDATE_PAYEE_URL, CONSUMER_ORDERS_URL, LOYALTY_API_URL, SUBSCRIPTION_API_URL } from '@/constants/events/eventsConstants';
import { format } from 'date-fns';
import {
    trackEventViewed, trackEventLocationSelected, trackEventDateSelected,
    trackEventTimeSelected, trackEventContactFormViewed, trackEventContactFormSubmitted,
    trackEventOtpSent, trackEventOtpVerified, trackEventOtpSkipped,
    trackEventRegistrationCreated, trackEventFlowStarted,
    trackEventRegistrationFailed,
    identifyUser,
} from '@/services/analytics';

// Helper function to format phone numbers to E.164
const formatPhoneNumberE164 = (mobileNumber) => {
    const digits = mobileNumber.replace(/\D/g, '');
    if (digits.length === 10) return `+1${digits}`;
    if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
    return mobileNumber;
};

// ✅ NEW: Helper function to convert day names to day numbers
const dayNameToNumber = (dayName) => {
    const days = {
        'Sunday': 0,
        'Monday': 1,
        'Tuesday': 2,
        'Wednesday': 3,
        'Thursday': 4,
        'Friday': 5,
        'Saturday': 6
    };
    return days[dayName];
};

// ✅ NEW: Helper to get all valid day numbers from daysOfWeek array
const getDayNumbers = (daysOfWeek) => {
    if (!daysOfWeek || !Array.isArray(daysOfWeek)) return [];

    return daysOfWeek.map(day => {
        // If already a number, return it
        if (typeof day === 'number') return day;
        // If a string, convert it
        return dayNameToNumber(day);
    }).filter(num => num !== undefined);
};

// ✅ NEW: Helper to parse eventTimes (handles both string and array formats)
const parseEventTimes = (eventTimes) => {
    if (!eventTimes) return [];
    if (Array.isArray(eventTimes)) return eventTimes;
    // String format: "19:00 - 20:00" or "19:00 - 20:00, 21:00 - 22:00"
    return eventTimes.split(',').map(t => t.trim()).filter(Boolean);
};

// ✅ NEW: Helper function to calculate first valid date for an event
const calculateFirstValidDate = (currentEvent) => {
    console.log('🔍 calculateFirstValidDate called with event:', currentEvent);
    
    if (!currentEvent) {
        console.error('❌ calculateFirstValidDate: No event provided');
        return null;
    }
    
    // ✅ Handle both field name formats: "Start Date" vs "startDate"
    const startDateRaw = currentEvent['Start Date'] || currentEvent.startDate;
    const endDateRaw = currentEvent['End Date'] || currentEvent.endDate;
    const daysOfWeek = currentEvent['Days of Week'] || currentEvent.daysOfWeek;

    // Validate required date fields before parsing
    if (!startDateRaw || !endDateRaw || typeof startDateRaw !== 'string' || typeof endDateRaw !== 'string') {
        console.warn('calculateFirstValidDate: missing or invalid date fields', { startDateRaw, endDateRaw });
        return null;
    }

    // Parse dates in local timezone to avoid UTC day shifting
    const [startYear, startMonth, startDay] = startDateRaw.split('-').map(Number);
    const [endYear, endMonth, endDay] = endDateRaw.split('-').map(Number);

    if (isNaN(startYear) || isNaN(startMonth) || isNaN(startDay) || isNaN(endYear) || isNaN(endMonth) || isNaN(endDay)) {
        console.warn('calculateFirstValidDate: could not parse date components', { startDateRaw, endDateRaw });
        return null;
    }

    const startDateLocal = new Date(startYear, startMonth - 1, startDay);
    const endDateLocal = new Date(endYear, endMonth - 1, endDay);

    // Convert day names to numbers
    const dayNumbers = getDayNumbers(daysOfWeek);

    if (dayNumbers.length === 0) {
        console.warn('calculateFirstValidDate: no valid days of week', daysOfWeek);
        return null;
    }

    const targetDayOfWeek = dayNumbers[0]; // Get first valid day number

    let current = new Date(startDateLocal);
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Start of today
    
    let iterationCount = 0;
    while (current <= endDateLocal) {
        const currentDayOfWeek = current.getDay();
        iterationCount++;
        
        if (iterationCount <= 10) { // Only log first 10 iterations
            console.log(`   Day ${iterationCount}: ${current.toDateString()} (day ${currentDayOfWeek}) - Match target ${targetDayOfWeek}? ${currentDayOfWeek === targetDayOfWeek}, >= today? ${current >= today}`);
        }
        
        if (currentDayOfWeek === targetDayOfWeek && current >= today) {
            // Return YYYY-MM-DD string to avoid UTC timezone shifts
            const y = current.getFullYear();
            const m = String(current.getMonth() + 1).padStart(2, '0');
            const d = String(current.getDate()).padStart(2, '0');
            const result = `${y}-${m}-${d}`;
            console.log('   ✅ Found valid date:', result);
            return result;
        }
        current.setDate(current.getDate() + 1);
        
        if (iterationCount > 365) {
            console.error('   ❌ Iteration limit reached (365 days) - stopping to prevent infinite loop');
            break;
        }
    }
    
    console.error('   ❌ No valid future date found in range!');
    console.error('   Total iterations:', iterationCount);
    return null;
};

// Derive registration role from event type (Fundraiser/Rolling Fundraiser → Host, Event → Participant)
const roleFromEventType = (eventType) => {
    const t = (eventType || 'Event').toLowerCase();
    return (t === 'fundraiser' || t === 'rolling fundraiser') ? 'Host' : 'Participant';
};

// Helper function to validate the contact form
const validateContactForm = (contactInfo, currentEvent, selectedLocation) => {
    const errors = {};
    if (!contactInfo.firstName) errors.firstName = 'First name is required';
    if (!contactInfo.lastName) errors.lastName = 'Last name is required';

    // Organization name is required for all fundraiser events
    const eventType = (currentEvent?.type || currentEvent?.Type || '').toLowerCase();
    const isFundraiser = eventType === 'fundraiser' || eventType === 'rolling fundraiser';
    if (isFundraiser && !contactInfo.organizationName) {
        errors.organizationName = 'Organization name is required';
    }

    // Space rental requires reservation type and party size
    const isSpaceRental = eventType === 'space rental';
    if (isSpaceRental) {
        if (!contactInfo.reservationType) errors.reservationType = 'Reservation type is required';
        if (!contactInfo.partySize || contactInfo.partySize < 1) {
            errors.partySize = 'Party size is required';
        } else if (selectedLocation?.maxEventSize && Number(contactInfo.partySize) > selectedLocation.maxEventSize) {
            errors.partySize = `Party size cannot exceed ${selectedLocation.maxEventSize} for this location`;
        }
    }

    if (!contactInfo.email) errors.email = 'Email is required';
    if (!contactInfo.mobileNumber) errors.mobileNumber = 'Mobile number is required';

    // Per-event parental consent — must be checked before registering when enabled.
    // Gate on consentText too, matching the checkbox's render condition, so an event with
    // consent required but no statement text can't deadlock the form.
    if (currentEvent?.requireConsent && currentEvent?.consentText && !contactInfo.consentAccepted) {
        errors.consentAccepted = 'You must agree to continue';
    }
    return errors;
};

const initialContext = {
    fundraiserEvents: [],
    selectedEventId: null,
    locations: [],
    selectedLocationId: null,
    selectedDate: null,
    selectedTime: null,
    contactInfo: {
        firstName: '',
        lastName: '',
        organizationName: '',
        reservationType: '',
        partySize: '',
        email: '',
        mobileNumber: '',
        smsOptIn: true,
        consentAccepted: false,
    },
    formErrors: {},
    error: null,
    loginIdentifier: '',
    registeredEvents: [],
    isAuthenticated: false,
    viewingEventId: null,
    guestId: null,
    otpChannel: null,
    potentialAccounts: [],
    selectedAccountId: null,
    matchType: null,
    matchedAccounts: [],
    emailMatched: false,
    phoneMatched: false,
    orgMatchFound: false,
    selectedPartialMatch: null,
    profileMismatch: null,
    sid: null,
    lastFetchTimestamp: null,
    newlyRegisteredEvent: null,
    sessionToken: null,
    customerId: null,
    orders: null,
    loyalty: null,
    subscriptions: null,
    deepLinkStopIndex: null,
    duplicateNotice: false,
    autoRegister: false,
    lastSessionCreatedAt: null,
    paymentMethod: null,
    paymentNonce: null,
    stripeToken: null,
    encryptedCard: null,
    loyaltyBalance: null,
    paymentError: null,
};

export const eventsMachine = setup({
  actors: {
    checkGuestStatus: fromPromise(async ({ input }) => {
        const response = await fetch(CHECK_GUEST_STATUS_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'checkGuestStatus', ...input })
        });
        if (!response.ok) throw new Error('Failed to check guest status.');
        return await response.json();
    }),
    authenticateGuest: fromPromise(async ({ input }) => {
        const { otp, identifier, email } = input;
        let to = identifier;
        let channel = 'email';
        const isPhoneNumber = /^\+?[0-9\s-()]+$/.test(identifier);
        if (isPhoneNumber) {
            channel = 'sms';
            to = formatPhoneNumberE164(identifier);
        }
        const payload = {
            action: 'verifyOtp',
            to,
            channel,
            code: otp,
            email,
        };
        const response = await fetch(AUTHENTICATE_GUEST_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: 'Guest authentication failed.' }));
            throw new Error(errorData.message);
        }
        return await response.json();
    }),
    createOrganization: fromPromise(async ({ input }) => {
        const response = await fetch(CREATE_ORGANIZATION_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'createOrganization', ...input })
        });
        if (!response.ok) throw new Error('Failed to create organization.');
        return await response.json();
    }),
    checkDuplicateRegistration: fromPromise(async ({ input }) => {
        const response = await fetch(CREATE_EVENT_REGISTRATION_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'checkDuplicateRegistration', guestId: input.guestId, eventId: input.eventId, date: input.date })
        });
        if (!response.ok) throw new Error('Failed to check registration status.');
        const data = await response.json();
        return { isDuplicate: !!data.isDuplicate };
    }),
    createEventRegistration: fromPromise(async ({ input }) => {
        const response = await fetch(CREATE_EVENT_REGISTRATION_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'createEventRegistration', ...input })
        });

        if (!response.ok) {
            if (response.status === 400) {
                const errorData = await response.json().catch(() => ({}));
                if (errorData.status === 'duplicate record') {
                    return { outcome: 'DUPLICATE' };
                }
            }
            throw new Error('Failed to create final event registration.');
        }

        try {
            const data = await response.json();
            // Handle payment errors from the API
            if (data.status === 'error') {
                throw new Error(data.message || 'Payment failed');
            }
            return { outcome: 'SUCCESS', registrationId: data.registrationId || null, paymentAmountCents: data.paymentAmountCents || 0 };
        } catch (error) {
            if (error.message && error.message !== 'Unexpected end of JSON input') {
                throw error;
            }
            console.warn('API returned 200 OK but with a non-JSON or empty body. Assuming success.');
            return { outcome: 'SUCCESS' };
        }
    }),
    updatePayee: fromPromise(async ({ input }) => {
        const response = await fetch(UPDATE_PAYEE_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'updatePayee', ...input })
        });
        if (!response.ok) throw new Error('Failed to update payee information.');
        return await response.json();
    }),
    sendOtp: fromPromise(async ({ input }) => {
        const { identifier, email } = input;
        let to = identifier;
        let channel = 'email';
        const isPhoneNumber = /^\+?[0-9\s-()]+$/.test(identifier);
        if (isPhoneNumber) {
            channel = 'sms';
            to = formatPhoneNumberE164(identifier);
        }
        const payload = { action: 'sendOtp', to, channel };
        if (email) payload.email = email;
        const response = await fetch(OTP_VERIFY_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: 'Failed to send OTP' }));
            throw new Error(errorData.message);
        }
        return await response.json();
    }),
    verifyOtp: fromPromise(async ({ input }) => {
        const { identifier, otp } = input;
        let to = identifier;
        let channel = 'email';
        const isPhoneNumber = /^\+?[0-9\s-()]+$/.test(identifier);
        if (isPhoneNumber) {
            channel = 'sms';
            to = formatPhoneNumberE164(identifier);
        }

        // Step 1: Verify OTP with Twilio
        const otpResponse = await fetch(OTP_VERIFY_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'verifyOtp', to, channel, code: otp })
        });
        if (!otpResponse.ok) {
            const errorData = await otpResponse.json().catch(() => ({ message: 'Verification failed' }));
            throw new Error(errorData.message || 'Invalid verification code.');
        }
        const otpResult = await otpResponse.json();

        // Check if OTP was approved
        if (!otpResult.valid && otpResult.status !== 'approved') {
            throw new Error(otpResult.message || 'Invalid or expired verification code.');
        }

        // Step 2: Look up guest by email or phone
        const lookupPayload = {
            action: 'checkGuestStatus',
            ...(channel === 'email' ? { email: to } : { mobileNumber: to })
        };

        const guestResponse = await fetch(CHECK_GUEST_STATUS_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(lookupPayload)
        });

        if (!guestResponse.ok) {
            // OTP verified but couldn't look up guest - return empty to show "no account found"
            console.warn('Guest lookup failed after OTP verification');
            return [];
        }

        const guestResult = await guestResponse.json();
        console.log('Guest lookup result:', guestResult);

        // checkGuestStatus now returns: { matchType, accounts, emailMatched, phoneMatched, orgMatchFound }
        if (guestResult?.matchType === 'none' || !guestResult?.accounts?.length) {
            return []; // No account found
        }

        // Return the accounts array (each has Guest ID, First Name, etc.)
        return guestResult.accounts;
    }),
    updateCustomerProfile: fromPromise(async ({ input }) => {
        const response = await fetch(EVENTS_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'updateCustomerProfile', ...input })
        });
        if (!response.ok) throw new Error('Failed to update profile.');
        return await response.json();
    }),
    fetchRegisteredEvents: fromPromise(async ({ input }) => {
        console.log("📋 USER DASHBOARD: Fetching registered events with payload:", input);
        console.log("   - guestId:", input.guestId);
        console.log("   - sid:", input.sid);

        const response = await fetch(LIST_REGISTERED_EVENTS_FOR_USER_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'getRegisteredEvents', guestId: input.guestId, sid: input.sid })
        });
        if (!response.ok) throw new Error("Could not fetch user's registered events.");
        const rawEvents = await response.json();

        console.log("📋 USER DASHBOARD: Received registered events:", rawEvents);
        console.log("   - Event count:", Array.isArray(rawEvents) ? rawEvents.length : 'Not an array');

        return rawEvents;
    }),
    createAccountSession: fromPromise(async ({ input }) => {
        const response = await fetch(EVENTS_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'createAccountSession', guestId: input.guestId }),
        });
        if (!response.ok) return { sessionToken: null, customerId: null };
        return await response.json();
    }),
    fetchAccountData: fromPromise(async ({ input }) => {
        const { guestId, sid, sessionToken, email, phone } = input;

        // Fetch events (always)
        const eventsPromise = fetch(LIST_REGISTERED_EVENTS_FOR_USER_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'getRegisteredEvents', guestId, sid, phone }),
        }).then(r => r.ok ? r.json() : []).catch(() => []);

        // Fetch orders (only if sessionToken)
        const ordersPromise = sessionToken && CONSUMER_ORDERS_URL
            ? fetch(CONSUMER_ORDERS_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'getCustomerOrders', sessionToken, phone }),
            }).then(async r => {
                const json = await r.json();
                const result = typeof json.body === 'string' ? JSON.parse(json.body) : json;
                return result.orders || [];
            }).catch(() => null)
            : Promise.resolve(null);

        // Fetch loyalty (only if sessionToken)
        const loyaltyPromise = sessionToken && LOYALTY_API_URL
            ? fetch(LOYALTY_API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'getConsumerLoyalty', sessionToken }),
            }).then(r => r.ok ? r.json() : null).catch(() => null)
            : Promise.resolve(null);

        // Fetch subscriptions (if email or phone available)
        const subscriptionsPromise = (email || phone) && SUBSCRIPTION_API_URL
            ? fetch(SUBSCRIPTION_API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'listCustomerSubscriptions', email, phone }),
            }).then(r => r.ok ? r.json() : null).catch(() => null)
            : Promise.resolve(null);

        const [rawEvents, orders, loyalty, subscriptions] = await Promise.all([eventsPromise, ordersPromise, loyaltyPromise, subscriptionsPromise]);
        return { rawEvents, orders, loyalty, subscriptions };
    }),
    fetchTransactionDetails: fromPromise(async ({ input }) => {
        console.log("3. FETCH ACTOR INPUT:", input);
        const response = await fetch(LIST_AND_UPDATE_TRANSACTION_DETAILS_AND_TALLY_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'getTransactionDetails', ...input })
        });
        if (!response.ok) throw new Error("Could not fetch transaction details.");

        const data = await response.json();
        console.log("4. RAW API RESPONSE:", data);

        const rawEventData = data[0];
        if (!rawEventData) throw new Error("Transaction details data not found in API response.");

        let processedTransactions = [];
        if (rawEventData['Transaction Details']) {
            try {
                const parsedTxns = JSON.parse(rawEventData['Transaction Details']);
                processedTransactions = parsedTxns.map((txn, index) => {
                    const total = txn.total_money?.amount || 0;
                    const tax = txn.total_tax_money?.amount || 0;
                    const tip = txn.total_tip_money?.amount || 0;
                    const discount = txn.total_discount_money?.amount || 0;
                    return {
                        id: `txn_${index}`,
                        timestamp: txn.created_at || new Date().toISOString(),
                        amount: (total - tax - tip - discount) / 100
                    };
                });
            } catch (e) {
                console.error("Failed to parse transaction details JSON string:", e);
            }
        }

        const normalizedEvent = {
            ...rawEventData,
            'Transaction Details': processedTransactions,
        };
        console.log("5. NORMALIZED ACTOR OUTPUT:", normalizedEvent);
        return normalizedEvent;
    }),
  },
  actions: {
    captureFailedRegistration: ({ context, event }) => {
      trackEventRegistrationFailed(context.selectedEventId, {
        contactInfo: context.contactInfo,
        date: context.selectedDate,
        time: context.selectedTime,
        locationId: context.selectedLocationId,
        reason: (event.error?.message || event.data?.message || 'API error'),
      });
    },
    assignError: assign({
        error: ({ event }) => {
            // XState v5: error is in event.error, not event.data
            const err = event.error || event.data;
            if (typeof err === 'string') return err;
            return err?.message || 'An unknown error occurred.';
        },
    }),
    softReset: assign({
        selectedEventId: null,
        selectedLocationId: null,
        selectedDate: null,
        selectedTime: null,
        contactInfo: initialContext.contactInfo,
        formErrors: {},
        viewingEventId: null,
        error: null,
        deepLinkStopIndex: null,
        duplicateNotice: false,
        autoRegister: false,
        paymentMethod: null,
        paymentNonce: null,
        stripeToken: null,
        encryptedCard: null,
        paymentError: null,
    }),
    hardReset: assign({
        ...initialContext,
        locations: ({ context }) => context.locations,
        fundraiserEvents: ({ context }) => context.fundraiserEvents,
        sessionToken: null,
        customerId: null,
        orders: null,
        loyalty: null,
        subscriptions: null,
    }),
  }
}).createMachine({
  id: 'fundraiser',
  context: initialContext,
  initial: 'booting',

  on: {
    RESET: {
      target: '.directory',
      actions: 'softReset',
    },
    DISMISS_DUPLICATE_NOTICE: {
        actions: assign({ duplicateNotice: false }),
    },
    'DATA.LOADED': {
        actions: [
            assign({
                fundraiserEvents: ({ event }) => event.events,
                locations: ({ event }) => event.locations,
            }),
            ({ event, context }) => {
                console.log('=== STATE MACHINE: DATA.LOADED received ===');
                console.log('Events count:', event.events?.length);
                console.log('Current selectedEventId:', context.selectedEventId);
                console.log('===========================================');
            }
        ]
    },
  },

  states: {
    booting: {
        on: {
            'DATA.LOADED': {
                target: 'routing',
                actions: assign({
                    fundraiserEvents: ({ event }) => event.events,
                    locations: ({ event }) => event.locations,
                })
            },
            'DATA.FAILED': {
                target: 'failure',
                actions: 'assignError'
            }
        }
    },

    routing: {
        always: [
            { target: 'wizardFlow', guard: ({ context }) => !!context.selectedEventId },
            { target: 'userDashboard', guard: ({ context }) => context.isAuthenticated },
            { target: 'directory' }
        ]
    },
    directory: {
        on: {
            LOGIN_START: 'loginFlow',
            GO_TO_DASHBOARD: {
                target: 'userDashboard',
                actions: assign({
                    duplicateNotice: ({ event }) => !!event.duplicate,
                }),
            },
            CHOOSE_FUNDRAISER: {
              target: 'wizardFlow',
              actions: assign({
                selectedEventId: ({ event }) => event.eventId,
                deepLinkStopIndex: ({ event }) => event.stopIndex != null ? event.stopIndex : null,
                autoRegister: ({ event }) => !!event.register,
              })
            },
        }
    },
    userDashboard: {
        initial: 'ensureSession',
        states: {
            ensureSession: {
                always: [
                    {
                        target: 'checkingCache',
                        guard: ({ context }) => !!context.sessionToken || !context.guestId,
                    },
                    {
                        // Throttle: skip session creation if one was attempted in the last 60s
                        target: 'checkingCache',
                        guard: ({ context }) => !!context.lastSessionCreatedAt && (Date.now() - context.lastSessionCreatedAt) < 60_000,
                    },
                    { target: 'creatingSessionInline' }
                ]
            },
            creatingSessionInline: {
                invoke: {
                    src: 'createAccountSession',
                    input: ({ context }) => ({ guestId: context.guestId }),
                    onDone: {
                        target: 'checkingCache',
                        actions: assign({
                            sessionToken: ({ event }) => event.output.sessionToken || null,
                            customerId: ({ event }) => event.output.customerId || null,
                            lastSessionCreatedAt: () => Date.now(),
                        })
                    },
                    onError: {
                        target: 'checkingCache',
                        actions: assign({ lastSessionCreatedAt: () => Date.now() }),
                    }
                }
            },
            checkingCache: {
                always: [
                    // If we have a newly registered event, go straight to idle (data already added)
                    {
                        target: 'idle',
                        guard: ({ context }) => !!context.newlyRegisteredEvent,
                        actions: [
                            assign({ newlyRegisteredEvent: null }),
                            () => console.log('📋 Skipping fetch - using newly registered event data')
                        ]
                    },
                    // If we fetched within the last 2 minutes, skip fetching
                    {
                        target: 'idle',
                        guard: ({ context }) => {
                            if (!context.lastFetchTimestamp) return false;
                            const twoMinutesAgo = Date.now() - (2 * 60 * 1000);
                            const isCacheValid = context.lastFetchTimestamp > twoMinutesAgo;
                            console.log('📋 Cache check:', {
                                lastFetch: new Date(context.lastFetchTimestamp).toISOString(),
                                isCacheValid,
                                hasEvents: context.registeredEvents?.hostedEvents?.length > 0 || context.registeredEvents?.participantEvents?.length > 0
                            });
                            return isCacheValid;
                        },
                        actions: () => console.log('📋 Skipping fetch - cache is still valid (< 2 min old)')
                    },
                    // Otherwise, fetch fresh data
                    { target: 'loadingEvents' }
                ]
            },
            loadingEvents: {
                invoke: {
                    src: 'fetchAccountData',
                    input: ({ context }) => ({
                        guestId: context.guestId,
                        sid: context.sid,
                        sessionToken: context.sessionToken,
                        email: context.contactInfo?.email,
                        phone: context.contactInfo?.mobileNumber || context.loginIdentifier,
                    }),
                    onDone: {
                        target: 'idle',
                        actions: [
                            assign({
                                registeredEvents: ({ event }) => {
                                    let output = event.output.rawEvents;
                                    if (Array.isArray(output) && output.length > 0) output = output[0];
                                    if (output && typeof output === 'object' &&
                                        (output.hostedEvents || output.participantEvents)) {
                                        return output;
                                    }
                                    return Array.isArray(output) ? output : [];
                                },
                                orders: ({ event }) => event.output.orders,
                                loyalty: ({ event }) => event.output.loyalty,
                                subscriptions: ({ event }) => event.output.subscriptions,
                                lastFetchTimestamp: () => Date.now(),
                                selectedEventId: null,
                            }),
                        ]
                    },
                    onError: {
                        target: 'idle',
                        actions: 'assignError',
                    }
                }
            },
            idle: {
                on: {
                    REDEEM_REWARD: {
                        target: 'redeemingReward',
                    }
                }
            },
            redeemingReward: {
                invoke: {
                    src: fromPromise(async ({ input }) => {
                        if (!LOYALTY_API_URL || !input.sessionToken) throw new Error('No loyalty session');
                        const response = await fetch(LOYALTY_API_URL, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ action: 'consumerRedeem', sessionToken: input.sessionToken, rewardId: input.rewardId }),
                        });
                        const data = await response.json();
                        if (data.error) throw new Error(data.error);
                        return data;
                    }),
                    input: ({ context, event }) => ({
                        sessionToken: context.sessionToken,
                        rewardId: event.rewardId,
                    }),
                    onDone: {
                        target: 'refreshingLoyalty',
                        actions: ({ event }) => {
                            if (event.output?.discountCode) {
                                const cents = event.output.discountCents || 0;
                                alert(`Reward redeemed! Your discount code is: ${event.output.discountCode}\nApply it at checkout for $${(cents / 100).toFixed(2)} off.`);
                            }
                        }
                    },
                    onError: {
                        target: 'idle',
                        actions: ({ event }) => alert(event.error?.message || 'Redemption failed'),
                    }
                }
            },
            refreshingLoyalty: {
                invoke: {
                    src: fromPromise(async ({ input }) => {
                        if (!LOYALTY_API_URL || !input.sessionToken) return null;
                        const response = await fetch(LOYALTY_API_URL, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ action: 'getConsumerLoyalty', sessionToken: input.sessionToken }),
                        });
                        return response.ok ? response.json() : null;
                    }),
                    input: ({ context }) => ({ sessionToken: context.sessionToken }),
                    onDone: {
                        target: 'idle',
                        actions: assign({ loyalty: ({ event }) => event.output }),
                    },
                    onError: { target: 'idle' },
                }
            },
        },
        on: {
            SCHEDULE_NEW: 'directory',
            LOGOUT: {
                target: 'directory',
                actions: 'hardReset'
            },
            VIEW_TRANSACTIONS: {
                target: 'transactionDetails',
                actions: assign({
                    viewingEventId: ({ event }) => {
                        console.log("2. VIEW_TRANSACTIONS event received, setting viewingEventId to:", event.eventId);
                        return event.eventId;
                    }
                })
            },
            VIEW_MARKETING_MATERIALS: {
                target: 'marketingMaterials',
                actions: assign({ viewingEventId: ({ event }) => event.eventId })
            }
        }
    },
    transactionDetails: {
        initial: 'loading',
        states: {
            loading: {
                invoke: {
                    src: 'fetchTransactionDetails',
                    input: ({ context }) => ({
                        registeredEventId: context.viewingEventId,
                        guestId: context.guestId,
                        sid: context.sid
                    }),
                    onDone: {
                        target: 'idle',
                        actions: assign({
                            registeredEvents: ({ context, event }) => {
                                console.log(`6. UPDATING REGISTERED EVENTS. Replacing event ${context.viewingEventId}`);
                                
                                const currentEvents = context.registeredEvents;
                                
                                // ✅ Handle new format (object with hostedEvents/participantEvents)
                                if (currentEvents && typeof currentEvents === 'object' && !Array.isArray(currentEvents)) {
                                    const updatedHostedEvents = (currentEvents.hostedEvents || []).map(re =>
                                        re['Registered Event ID'] === context.viewingEventId ? event.output : re
                                    );
                                    const updatedParticipantEvents = (currentEvents.participantEvents || []).map(re =>
                                        re['Registered Event ID'] === context.viewingEventId ? event.output : re
                                    );
                                    
                                    console.log("7. NEW REGISTERED EVENTS after update:", {
                                        hostedEvents: updatedHostedEvents,
                                        participantEvents: updatedParticipantEvents
                                    });
                                    
                                    return {
                                        hostedEvents: updatedHostedEvents,
                                        participantEvents: updatedParticipantEvents
                                    };
                                }
                                
                                // Fallback for old format (array)
                                const updatedList = (currentEvents || []).map(re =>
                                    re['Registered Event ID'] === context.viewingEventId ? event.output : re
                                );
                                console.log("7. NEW REGISTERED EVENTS list after update:", updatedList);
                                return updatedList;
                            }
                        })
                    },
                    onError: {
                        target: 'idle',
                        actions: 'assignError'
                    }
                }
            },
            idle: {
                on: {
                    BACK_TO_DASHBOARD: '#fundraiser.userDashboard',
                    VIEW_PAYOUTS: '#fundraiser.payoutDetails'
                }
            }
        }
    },
    marketingMaterials: {
        on: {
            BACK_TO_DASHBOARD: 'userDashboard'
        }
    },
    payoutDetails: {
        initial: 'idle',
        states: {
            idle: {
                on: {
                    EDIT_PAYEE: 'editingPayee'
                }
            },
            editingPayee: {
                on: {
                    SUBMIT_PAYEE: 'submittingPayee',
                    CANCEL_EDIT_PAYEE: 'idle'
                }
            },
            submittingPayee: {
                invoke: {
                    src: 'updatePayee',
                    input: ({ context, event }) => ({
                        registeredEventId: context.viewingEventId,
                        payeeData: event.data,
                        guestId: context.guestId,
                        sid: context.sid
                    }),
                    onDone: {
                        target: 'idle',
                        actions: assign({
                            registeredEvents: ({ context, event }) => {
                                const updatedPayeeData = event.output[0];
                                const newPayeeInfo = {
                                    name: updatedPayeeData['Payee Information'],
                                    address: updatedPayeeData['Payee Mailing Address']
                                };
                                
                                const currentEvents = context.registeredEvents;
                                
                                // ✅ Handle new format (object with hostedEvents/participantEvents)
                                if (currentEvents && typeof currentEvents === 'object' && !Array.isArray(currentEvents)) {
                                    const updatedHostedEvents = (currentEvents.hostedEvents || []).map(re =>
                                        re['Registered Event ID'] === context.viewingEventId
                                            ? { ...re, payeeInfo: newPayeeInfo }
                                            : re
                                    );
                                    const updatedParticipantEvents = (currentEvents.participantEvents || []).map(re =>
                                        re['Registered Event ID'] === context.viewingEventId
                                            ? { ...re, payeeInfo: newPayeeInfo }
                                            : re
                                    );
                                    
                                    return {
                                        hostedEvents: updatedHostedEvents,
                                        participantEvents: updatedParticipantEvents
                                    };
                                }
                                
                                // Fallback for old format (array)
                                return (currentEvents || []).map(re =>
                                    re['Registered Event ID'] === context.viewingEventId
                                        ? { ...re, payeeInfo: newPayeeInfo }
                                        : re
                                );
                            }
                        })
                    },
                    onError: {
                        target: 'editingPayee',
                        actions: 'assignError'
                    }
                }
            }
        },
        on: {
            BACK_TO_TRANSACTIONS: 'transactionDetails',
            BACK_TO_DASHBOARD: 'userDashboard'
        }
    },
    wizardFlow: {
        initial: 'eventLanding',
        states: {
            eventLanding: {
                always: [
                    // Deep-link or auto-register: skip landing page and go straight to validating
                    {
                        target: 'validating',
                        guard: ({ context }) => context.deepLinkStopIndex != null || context.autoRegister,
                        actions: ({ context }) => trackEventFlowStarted(context.selectedEventId, { source: 'deep_link', autoRegister: context.autoRegister }),
                    },
                ],
                on: {
                    SELECT_LOCATION: {
                        target: 'validating',
                        actions: [
                            assign({ selectedLocationId: ({ event }) => {
                                console.log('🎯 SELECT_LOCATION: Setting selectedLocationId to:', event.value);
                                return event.value;
                            }}),
                            ({ context, event }) => {
                                console.log('🎯 SELECT_LOCATION action completed for:', event.value);
                                trackEventFlowStarted(context.selectedEventId, { source: 'manual' });
                                trackEventLocationSelected(context.selectedEventId, event.value);
                            }
                        ]
                    },
                    SELECT_STOP: {
                        target: 'selectingContact',
                        actions: [
                            assign({
                                selectedLocationId: ({ event }) => event.stop.locationId,
                                selectedDate: ({ event }) => event.stop.date,
                                selectedTime: ({ event }) => event.stop.startTime && event.stop.endTime
                                    ? `${event.stop.startTime} - ${event.stop.endTime}`
                                    : null,
                            }),
                            ({ context, event }) => {
                                trackEventFlowStarted(context.selectedEventId, { source: 'manual' });
                                trackEventLocationSelected(context.selectedEventId, event.stop.locationId);
                                trackEventDateSelected(context.selectedEventId, event.stop.date);
                                if (event.stop.startTime) trackEventTimeSelected(context.selectedEventId, event.stop.startTime);
                            }
                        ]
                    },
                    PROCEED_TO_SCHEDULING: {
                        target: 'validating',
                        actions: ({ context }) => trackEventFlowStarted(context.selectedEventId, { source: 'manual' }),
                    },
                    BACK: '#fundraiser.directory'
                }
            },
            
            validating: {
                always: [
                    { target: '#fundraiser.directory', guard: ({ context }) => !context.selectedEventId },

                    // Tentpole deep-link or single-stop → skip stop picker, go straight to contact
                    // Only auto-selects if the resolved stop is in the future
                    {
                        target: 'selectingContact',
                        guard: ({ context }) => {
                            const currentEvent = context.fundraiserEvents.find(e => e.id === context.selectedEventId);
                            if (!currentEvent || (currentEvent.type || '').toLowerCase() !== 'tentpole' || !Array.isArray(currentEvent.schedule)) return false;
                            const schedule = currentEvent.schedule;
                            const today = new Date().toISOString().slice(0, 10);
                            const isFuture = (stop) => !stop.date || stop.date >= today;

                            // Deep-link stopIndex is set, valid, AND the stop is in the future
                            if (context.deepLinkStopIndex != null && schedule[context.deepLinkStopIndex] && isFuture(schedule[context.deepLinkStopIndex])) return true;
                            // Exactly one future stop → auto-select it
                            const futureStops = schedule.filter(isFuture);
                            if (futureStops.length === 1) return true;
                            return false;
                        },
                        actions: [
                            assign({
                                selectedLocationId: ({ context }) => {
                                    const currentEvent = context.fundraiserEvents.find(e => e.id === context.selectedEventId);
                                    const today = new Date().toISOString().slice(0, 10);
                                    const isFuture = (stop) => !stop.date || stop.date >= today;
                                    // Use deepLinkStopIndex if it points to a future stop, else first future stop
                                    if (context.deepLinkStopIndex != null && currentEvent.schedule[context.deepLinkStopIndex] && isFuture(currentEvent.schedule[context.deepLinkStopIndex])) {
                                        return currentEvent.schedule[context.deepLinkStopIndex].locationId;
                                    }
                                    return currentEvent.schedule.find(isFuture)?.locationId;
                                },
                                selectedDate: ({ context }) => {
                                    const currentEvent = context.fundraiserEvents.find(e => e.id === context.selectedEventId);
                                    const today = new Date().toISOString().slice(0, 10);
                                    const isFuture = (stop) => !stop.date || stop.date >= today;
                                    if (context.deepLinkStopIndex != null && currentEvent.schedule[context.deepLinkStopIndex] && isFuture(currentEvent.schedule[context.deepLinkStopIndex])) {
                                        return currentEvent.schedule[context.deepLinkStopIndex].date;
                                    }
                                    return currentEvent.schedule.find(isFuture)?.date;
                                },
                                selectedTime: ({ context }) => {
                                    const currentEvent = context.fundraiserEvents.find(e => e.id === context.selectedEventId);
                                    const today = new Date().toISOString().slice(0, 10);
                                    const isFuture = (stop) => !stop.date || stop.date >= today;
                                    let stop;
                                    if (context.deepLinkStopIndex != null && currentEvent.schedule[context.deepLinkStopIndex] && isFuture(currentEvent.schedule[context.deepLinkStopIndex])) {
                                        stop = currentEvent.schedule[context.deepLinkStopIndex];
                                    } else {
                                        stop = currentEvent.schedule.find(isFuture);
                                    }
                                    return stop?.startTime && stop?.endTime ? `${stop.startTime} - ${stop.endTime}` : null;
                                },
                                deepLinkStopIndex: () => null,
                                autoRegister: () => false,
                            }),
                            ({ context }) => {
                                trackEventLocationSelected(context.selectedEventId, null, { autoSkipped: true });
                                trackEventDateSelected(context.selectedEventId, 'auto');
                                trackEventTimeSelected(context.selectedEventId, 'auto');
                            },
                        ]
                    },

                    // Tentpole events → stop picker (each stop has its own date/time/location)
                    {
                        target: 'selectingStop',
                        guard: ({ context }) => {
                            const currentEvent = context.fundraiserEvents.find(e => e.id === context.selectedEventId);
                            return currentEvent && (currentEvent.type || '').toLowerCase() === 'tentpole' && Array.isArray(currentEvent.schedule);
                        }
                    },

                    // ✅ NEW: Skip all the way to contact if single location, single day, and single time
                    {
                        target: 'selectingContact',
                        guard: ({ context }) => {
                            const currentEvent = context.fundraiserEvents.find(e => e.id === context.selectedEventId);
                            if (!currentEvent) return false;

                            // ✅ Handle both field name formats
                            const locationIds = currentEvent['Location ID'] || currentEvent.locationIds;
                            const eventTimes = parseEventTimes(currentEvent['Event Times'] || currentEvent.eventTimes);
                            const daysOfWeek = currentEvent['Days of Week'] || currentEvent.daysOfWeek;

                            const hasSingleLocation = locationIds && locationIds.length === 1;
                            const hasSingleTime = eventTimes.length === 1;
                            const hasSingleDay = daysOfWeek && daysOfWeek.length === 1;

                            console.log('🔍 Checking if can skip to contact form:', {
                                hasSingleLocation,
                                hasSingleTime,
                                hasSingleDay,
                                result: hasSingleLocation && hasSingleDay && hasSingleTime
                            });

                            return hasSingleLocation && hasSingleDay && hasSingleTime;
                        },
                        actions: [
                            assign({
                                selectedLocationId: ({ context }) => {
                                    const currentEvent = context.fundraiserEvents.find(e => e.id === context.selectedEventId);
                                    const locationIds = currentEvent['Location ID'] || currentEvent.locationIds;
                                    return locationIds[0];
                                },
                                selectedTime: ({ context }) => {
                                    const currentEvent = context.fundraiserEvents.find(e => e.id === context.selectedEventId);
                                    const eventTimes = parseEventTimes(currentEvent['Event Times'] || currentEvent.eventTimes);
                                    return eventTimes[0];
                                },
                                selectedDate: ({ context }) => {
                                    const currentEvent = context.fundraiserEvents.find(e => e.id === context.selectedEventId);
                                    return calculateFirstValidDate(currentEvent);
                                },
                                autoRegister: () => false,
                            }),
                            ({ context }) => {
                                trackEventLocationSelected(context.selectedEventId, null, { autoSkipped: true });
                                trackEventDateSelected(context.selectedEventId, 'auto');
                                trackEventTimeSelected(context.selectedEventId, 'auto');
                            },
                        ]
                    },

                    // ✅ NEW: If location already selected (from clicking a location card), go to date selection
                    {
                        target: 'selectingDate',
                        guard: ({ context }) => {
                            const hasLocationSelected = !!context.selectedLocationId;
                            console.log('🔍 Checking if location already selected:', hasLocationSelected);
                            return hasLocationSelected;
                        }
                    },
                    
                    // ✅ NEW: Skip to time selection if single location and single day (but multiple times)
                    {
                        target: 'selectingTime',
                        guard: ({ context }) => {
                            const currentEvent = context.fundraiserEvents.find(e => e.id === context.selectedEventId);
                            if (!currentEvent) return false;

                            // ✅ Handle both field name formats
                            const locationIds = currentEvent['Location ID'] || currentEvent.locationIds;
                            const eventTimes = parseEventTimes(currentEvent['Event Times'] || currentEvent.eventTimes);
                            const daysOfWeek = currentEvent['Days of Week'] || currentEvent.daysOfWeek;

                            const hasSingleLocation = locationIds && locationIds.length === 1;
                            const hasSingleDay = daysOfWeek && daysOfWeek.length === 1;
                            const hasMultipleTimes = eventTimes.length > 1;

                            return hasSingleLocation && hasSingleDay && hasMultipleTimes;
                        },
                        actions: [
                            assign({
                                selectedLocationId: ({ context }) => {
                                    const currentEvent = context.fundraiserEvents.find(e => e.id === context.selectedEventId);
                                    const locationIds = currentEvent['Location ID'] || currentEvent.locationIds;
                                    return locationIds[0];
                                },
                                selectedDate: ({ context }) => {
                                    const currentEvent = context.fundraiserEvents.find(e => e.id === context.selectedEventId);
                                    return calculateFirstValidDate(currentEvent);
                                }
                            }),
                            ({ context }) => {
                                trackEventLocationSelected(context.selectedEventId, null, { autoSkipped: true });
                                trackEventDateSelected(context.selectedEventId, 'auto');
                            },
                        ]
                    },
                    
                    // ✅ EXISTING: Skip location selection if only one location (but still show date picker)
                    {
                        target: 'selectingDate',
                        guard: ({ context }) => {
                            const currentEvent = context.fundraiserEvents.find(e => e.id === context.selectedEventId);
                            const locationIds = currentEvent?.['Location ID'] || currentEvent?.locationIds;
                            return currentEvent && locationIds && locationIds.length === 1;
                        },
                        actions: [
                            assign({
                                selectedLocationId: ({ context }) => {
                                    const currentEvent = context.fundraiserEvents.find(e => e.id === context.selectedEventId);
                                    const locationIds = currentEvent['Location ID'] || currentEvent.locationIds;
                                    return locationIds[0];
                                }
                            }),
                            ({ context }) => trackEventLocationSelected(context.selectedEventId, null, { autoSkipped: true }),
                        ]
                    },

                    { target: 'selectingLocation' }
                ]
            },
            selectingLocation: {
                on: {
                    SELECT_LOCATION: {
                        target: 'selectingDate',
                        actions: [
                            assign({ selectedLocationId: ({ event }) => event.value }),
                            ({ context, event }) => trackEventLocationSelected(context.selectedEventId, event.value),
                        ]
                    }
                }
            },
            selectingStop: {
                on: {
                    SELECT_STOP: {
                        target: 'selectingContact',
                        actions: assign({
                            selectedLocationId: ({ event }) => event.stop.locationId,
                            selectedDate: ({ event }) => event.stop.date,
                            selectedTime: ({ event }) => event.stop.startTime && event.stop.endTime
                                ? `${event.stop.startTime} - ${event.stop.endTime}`
                                : null,
                        })
                    },
                    BACK: {
                        target: 'eventLanding',
                        actions: assign({
                            selectedLocationId: null,
                            selectedDate: null,
                            selectedTime: null,
                        })
                    }
                }
            },
            selectingDate: {
                on: {
                    SELECT_DATE: {
                        actions: [
                            assign({
                                selectedDate: ({ event }) => {
                                    const d = event.value;
                                    if (d instanceof Date) {
                                        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                                    }
                                    return d;
                                },
                                error: null
                            }),
                            ({ context, event }) => trackEventDateSelected(context.selectedEventId, event.value),
                        ]
                    },
                    PROCEED_TO_CONTACT: [
                        {
                            target: 'selectingContact',
                            guard: ({ context }) => {
                                const currentEvent = context.fundraiserEvents.find(e => e.id === context.selectedEventId);
                                const eventTimes = parseEventTimes(currentEvent?.['Event Times'] || currentEvent?.eventTimes);
                                return eventTimes.length <= 1;
                            },
                            actions: [
                                assign({
                                    selectedTime: ({ context }) => {
                                        const currentEvent = context.fundraiserEvents.find(e => e.id === context.selectedEventId);
                                        const eventTimes = parseEventTimes(currentEvent['Event Times'] || currentEvent.eventTimes);
                                        return eventTimes[0] || null;
                                    }
                                }),
                                ({ context }) => trackEventTimeSelected(context.selectedEventId, 'auto'),
                            ]
                        },
                        {
                            target: 'selectingTime'
                        }
                    ],
                    BACK: {
                        target: 'eventLanding',
                        actions: assign({ 
                            selectedLocationId: null,
                            selectedDate: null 
                        })
                    }
                },
            },
            selectingTime: {
                on: {
                    SELECT_TIME: {
                        actions: [
                            assign({ selectedTime: ({ event }) => event.value }),
                            ({ context, event }) => trackEventTimeSelected(context.selectedEventId, event.value),
                        ]
                    },
                    PROCEED_TO_CONTACT: 'selectingContact',
                    BACK: {
                        target: 'selectingDate',
                        actions: assign({ selectedTime: null })
                    }
                }
            },
            selectingContact: {
                entry: [
                    assign({
                        contactInfo: ({ context }) => {
                            if (context.isAuthenticated && context.potentialAccounts?.length > 0) {
                                const userAccount = context.potentialAccounts.find(acc => acc['Guest ID'] === context.guestId);
                                if (userAccount) {
                                    return {
                                        ...context.contactInfo,
                                        firstName: userAccount['First Name'] || '',
                                        lastName: userAccount['Last Name'] || '',
                                        email: userAccount['Email'] || '',
                                        mobileNumber: userAccount['Mobile Number'] || '',
                                        organizationName: userAccount['Organization Name'] || '',
                                    };
                                }
                            }
                            return context.contactInfo;
                        }
                    }),
                    ({ context }) => trackEventContactFormViewed(context.selectedEventId, { autoFilled: context.isAuthenticated }),
                ],
                on: {
                    UPDATE_FIELD: {
                        actions: assign({
                            contactInfo: ({ context, event }) => ({ ...context.contactInfo, [event.field]: event.value }),
                            formErrors: ({ context, event }) => {
                                const newErrors = { ...context.formErrors };
                                delete newErrors[event.field];
                                return newErrors;
                            }
                        })
                    },
                    SUBMIT: [
                        // Valid contact → go to verification/auth (payment comes after)
                        {
                            target: 'submitting',
                            guard: ({ context }) => {
                                const currentEvent = context.fundraiserEvents.find(e => e.id === context.selectedEventId);
                                const selectedLocation = context.locations?.find(l => l.id === context.selectedLocationId);
                                const errors = validateContactForm(context.contactInfo, currentEvent, selectedLocation);
                                return Object.keys(errors).length === 0;
                            },
                            actions: [
                                assign({ formErrors: {} }),
                                ({ context }) => trackEventContactFormSubmitted(context.selectedEventId),
                            ]
                        },
                        {
                            actions: assign({
                                formErrors: ({ context }) => {
                                    const currentEvent = context.fundraiserEvents.find(e => e.id === context.selectedEventId);
                                    const selectedLocation = context.locations?.find(l => l.id === context.selectedLocationId);
                                    return validateContactForm(context.contactInfo, currentEvent, selectedLocation);
                                }
                            })
                        }
                    ],
                    // ✅ SMART BACK BUTTON: Go to the last screen the user actually saw
                    BACK: [
                        // Tentpole events with multiple future stops: user saw stop picker → go back there
                        {
                            target: 'selectingStop',
                            guard: ({ context }) => {
                                const currentEvent = context.fundraiserEvents.find(e => e.id === context.selectedEventId);
                                if (!currentEvent || (currentEvent.type || '').toLowerCase() !== 'tentpole' || !Array.isArray(currentEvent.schedule)) return false;
                                const today = new Date().toISOString().slice(0, 10);
                                const futureStops = currentEvent.schedule.filter(s => !s.date || s.date >= today);
                                return futureStops.length > 1; // Only if user would have seen stop picker (multiple stops)
                            },
                            actions: assign({
                                selectedLocationId: null,
                                selectedDate: null,
                                selectedTime: null,
                            })
                        },
                        // If user saw time selection (came from selectingTime), go back there
                        {
                            target: 'selectingTime',
                            guard: ({ context }) => {
                                const currentEvent = context.fundraiserEvents.find(e => e.id === context.selectedEventId);
                                const eventTimes = parseEventTimes(currentEvent?.['Event Times'] || currentEvent?.eventTimes);
                                // User saw time selection if there were multiple times
                                return eventTimes.length > 1;
                            }
                        },
                        // If user saw date selection (came from selectingDate), go back there
                        {
                            target: 'selectingDate',
                            guard: ({ context }) => {
                                const currentEvent = context.fundraiserEvents.find(e => e.id === context.selectedEventId);
                                const eventTimes = parseEventTimes(currentEvent?.['Event Times'] || currentEvent?.eventTimes);
                                // User saw date selection if NOT (single day AND single time)
                                const hasSingleDay = currentEvent?.daysOfWeek?.length === 1;
                                const hasSingleTime = eventTimes.length === 1;
                                return !(hasSingleDay && hasSingleTime);
                            }
                        },
                        // Otherwise, go back to event landing page (everything was skipped)
                        {
                            target: 'eventLanding',
                            actions: assign({
                                // Clear auto-assigned values so user can start fresh
                                selectedLocationId: null,
                                selectedDate: null,
                                selectedTime: null
                            })
                        }
                    ]
                },
            },
            selectingPayment: {
                on: {
                    SELECT_PAYMENT_METHOD: {
                        actions: assign({
                            paymentMethod: ({ event }) => event.method,
                            paymentNonce: ({ event }) => event.cardData?.paymentNonce || null,
                            stripeToken: ({ event }) => event.cardData?.stripeToken || null,
                            encryptedCard: ({ event }) => event.cardData?.encryptedCard || null,
                            paymentError: null,
                        })
                    },
                    SUBMIT_PAYMENT: [
                        {
                            target: 'submitting.creatingRegistration',
                            guard: ({ context }) => !!context.paymentMethod,
                            actions: assign({ paymentError: null }),
                        },
                        {
                            actions: assign({ paymentError: 'Please select a payment method' }),
                        }
                    ],
                    BACK: {
                        target: 'selectingContact',
                        actions: assign({ paymentMethod: null, paymentNonce: null, stripeToken: null, encryptedCard: null, paymentError: null }),
                    }
                }
            },
            submitting: {
                initial: 'decidingAuthPath',
                states: {
                    decidingAuthPath: {
                        always: [
                            {
                                target: 'checkingDuplicate',
                                guard: ({ context }) => {
                                    if (!context.isAuthenticated) return false;
                                    const loggedInAccount = context.potentialAccounts.find(acc => acc['Guest ID'] === context.guestId);
                                    if (!loggedInAccount) return false;

                                    const { firstName, lastName, organizationName, email, mobileNumber } = context.contactInfo;
                                    const phoneField = loggedInAccount['Mobile Number'] || loggedInAccount['Phone'] || '';

                                    return (
                                        firstName === (loggedInAccount['First Name'] || '') &&
                                        lastName === (loggedInAccount['Last Name'] || '') &&
                                        organizationName === (loggedInAccount['Organization Name'] || '') &&
                                        email === (loggedInAccount['Email'] || '') &&
                                        mobileNumber === phoneField
                                    );
                                },
                                actions: ({ context }) => trackEventOtpSkipped(context.selectedEventId),
                            },
                            { target: 'checkingGuestStatus' }
                        ]
                    },
                    checkingGuestStatus: {
                        invoke: {
                            src: 'checkGuestStatus',
                            input: ({ context }) => ({
                                eventId: context.selectedEventId,
                                date: context.selectedDate,
                                time: context.selectedTime,
                                ...context.contactInfo,
                                guestId: context.guestId,
                                sid: context.sid
                            }),
                            onDone: [
                                {
                                    // Scenario 1: No match — new user, skip auth
                                    target: 'creatingOrganization',
                                    guard: ({ event }) => event.output?.matchType === 'none',
                                    actions: ({ event }) => {
                                        console.log('✅ checkGuestStatus: No matches found — new user');
                                    }
                                },
                                {
                                    // Scenarios 2-5: At least one match — require auth
                                    target: 'awaitingGuestAuthentication',
                                    actions: [
                                        assign({
                                            matchType: ({ event }) => event.output.matchType,
                                            matchedAccounts: ({ event }) => event.output.accounts,
                                            emailMatched: ({ event }) => event.output.emailMatched,
                                            phoneMatched: ({ event }) => event.output.phoneMatched,
                                            orgMatchFound: ({ event }) => event.output.orgMatchFound,
                                            selectedPartialMatch: null,
                                        }),
                                        ({ event }) => {
                                            console.log('✅ checkGuestStatus: Match found!');
                                            console.log('   matchType:', event.output.matchType);
                                            console.log('   accounts:', event.output.accounts?.length);
                                            console.log('   orgMatchFound:', event.output.orgMatchFound);
                                        }
                                    ]
                                }
                            ],
                            onError: {
                              target: '#fundraiser.wizardFlow.selectingContact',
                              actions: ['captureFailedRegistration', 'assignError'],
                            }
                        }
                    },
                    resolvingAccountMatch: {
                        on: {
                            SELECT_ACCOUNT_OPTION: {
                                actions: assign({
                                    selectedPartialMatch: ({ event }) => event.selection
                                })
                            },
                            CONFIRM_ACCOUNT_OPTION: [
                                {
                                    target: 'creatingOrganization',
                                    guard: ({ context }) => context.selectedPartialMatch?.isNew === true
                                },
                                {
                                    target: 'checkingDuplicate',
                                    guard: ({ context }) => !!context.selectedPartialMatch && !context.selectedPartialMatch.isNew,
                                    actions: assign({
                                        guestId: ({ context }) => context.selectedPartialMatch['Guest ID'],
                                        customerId: ({ context }) => context.selectedPartialMatch['Customer ID'] || context.customerId || null,
                                        contactInfo: ({ context }) => ({
                                            ...context.contactInfo,
                                            firstName: context.selectedPartialMatch['First Name'] || context.contactInfo.firstName,
                                            lastName: context.selectedPartialMatch['Last Name'] || context.contactInfo.lastName,
                                            email: context.selectedPartialMatch['Email'] || context.contactInfo.email,
                                            mobileNumber: context.selectedPartialMatch['Mobile Number'] || context.contactInfo.mobileNumber,
                                            organizationName: context.selectedPartialMatch['Organization Name'] || context.contactInfo.organizationName,
                                        }),
                                    })
                                }
                            ],
                            BACK: '#fundraiser.wizardFlow.selectingContact'
                        }
                    },
                    confirmingProfileUpdate: {
                        on: {
                            CONFIRM_PROFILE_UPDATE: {
                                target: 'updatingProfile',
                            },
                            SKIP_PROFILE_UPDATE: {
                                target: 'checkingDuplicate',
                                actions: assign({
                                    contactInfo: ({ context }) => ({
                                        ...context.contactInfo,
                                        firstName: context.profileMismatch.onFile.firstName,
                                        lastName: context.profileMismatch.onFile.lastName,
                                        organizationName: context.profileMismatch.onFile.organizationName || context.contactInfo.organizationName,
                                    }),
                                    profileMismatch: null,
                                })
                            }
                        }
                    },
                    updatingProfile: {
                        invoke: {
                            src: 'updateCustomerProfile',
                            input: ({ context }) => ({
                                customerId: context.profileMismatch.customerId,
                                guestId: context.profileMismatch.guestId,
                                firstName: context.profileMismatch.submitted.firstName,
                                lastName: context.profileMismatch.submitted.lastName,
                                organizationName: context.profileMismatch.submitted.organizationName,
                                sid: context.sid,
                            }),
                            onDone: {
                                target: 'checkingDuplicate',
                                actions: assign({ profileMismatch: null })
                            },
                            onError: {
                                target: 'checkingDuplicate',
                                actions: [
                                    assign({ profileMismatch: null }),
                                    ({ event }) => console.warn('Profile update failed (non-fatal):', event.error?.message)
                                ]
                            }
                        }
                    },
                    creatingOrganization: {
                        invoke: {
                            src: 'createOrganization',
                            input: ({ context }) => context.contactInfo,
                            onDone: {
                                // ✅ FIX: Skip re-authentication if user already has sid (already authenticated)
                                target: 'checkingDuplicate',
                                actions: [
                                    assign({
                                        guestId: ({ event }) => {
                                            const guestId = event.output[0]?.['Guest ID'];
                                            console.log('✅ Organization created! Guest ID:', guestId);
                                            return guestId;
                                        },
                                        matchedAccounts: []
                                        // Keep sid - user already authenticated!
                                    }),
                                    ({ context }) => {
                                        console.log('📝 New organization created, proceeding to registration');
                                        console.log('   guestId:', context.guestId);
                                        console.log('   sid:', context.sid, '(already authenticated)');
                                    }
                                ]
                            },
                            onError: {
                                target: '#fundraiser.wizardFlow.selectingContact',
                                actions: ['captureFailedRegistration', 'assignError']
                            }
                        }
                    },
                    selectingAccount: {
                        on: {
                            SELECT_ACCOUNT: {
                                actions: assign({
                                    selectedAccountId: ({ event }) => event.accountId
                                })
                            },
                            CONFIRM_ACCOUNT_FOR_EVENT: {
                                target: 'checkingDuplicate',
                                guard: ({ context }) => !!context.selectedAccountId,
                                actions: assign({
                                    guestId: ({ context }) => context.selectedAccountId,
                                    customerId: ({ context }) => {
                                        const account = (context.matchedAccounts || []).find(a => a['Guest ID'] === context.selectedAccountId);
                                        return account?.['Customer ID'] || context.customerId || null;
                                    }
                                })
                            },
                            BACK: '#fundraiser.wizardFlow.selectingContact'
                        }
                    },
                    awaitingGuestAuthentication: {
                        initial: 'choosingMethod',
                        states: {
                            choosingMethod: {
                                always: [
                                    // Auto-select email if only email matched
                                    {
                                        target: 'sendingGuestOtp',
                                        guard: ({ context }) => context.matchType === 'email',
                                        actions: assign({ otpChannel: 'email' })
                                    },
                                    // Auto-select phone if only phone matched
                                    {
                                        target: 'sendingGuestOtp',
                                        guard: ({ context }) => context.matchType === 'phone',
                                        actions: assign({ otpChannel: 'sms' })
                                    },
                                ],
                                on: {
                                    CHOOSE_EMAIL: {
                                        target: 'sendingGuestOtp',
                                        actions: assign({ otpChannel: 'email' })
                                    },
                                    CHOOSE_SMS: {
                                        target: 'sendingGuestOtp',
                                        actions: assign({ otpChannel: 'sms' })
                                    },
                                    BACK: '#fundraiser.wizardFlow.selectingContact'
                                }
                            },
                            sendingGuestOtp: {
                                invoke: {
                                    src: 'sendOtp',
                                    input: ({ context }) => ({
                                        identifier: context.otpChannel === 'email'
                                            ? context.contactInfo.email
                                            : context.contactInfo.mobileNumber,
                                        email: context.contactInfo.email,
                                    }),
                                    onDone: {
                                        target: 'enteringGuestOtp',
                                        actions: [
                                            assign({
                                                sid: ({ event }) => event.output.sid
                                            }),
                                            ({ context, event }) => {
                                                console.log('✅ OTP sent successfully!');
                                                console.log('   Setting sid to:', event.output.sid);
                                                trackEventOtpSent(context.selectedEventId, context.otpChannel);
                                            }
                                        ]
                                    },
                                    onError: {
                                        target: 'choosingMethod',
                                        actions: 'assignError'
                                    }
                                }
                            },
                            enteringGuestOtp: {
                                on: {
                                    SUBMIT_GUEST_OTP: 'verifyingGuestOtp',
                                    BACK_TO_GUEST_METHOD_CHOICE: 'choosingMethod'
                                }
                            },
                            verifyingGuestOtp: {
                                invoke: {
                                    src: 'authenticateGuest',
                                    input: ({ context, event }) => ({
                                        otp: event.value,
                                        identifier: context.otpChannel === 'email'
                                            ? context.contactInfo.email
                                            : context.contactInfo.mobileNumber,
                                        email: context.contactInfo.email,
                                    }),
                                    onDone: {
                                        target: 'decidePostAuthPath',
                                        actions: [
                                            assign({
                                                isAuthenticated: true,
                                                potentialAccounts: ({ context }) => [{
                                                    'Guest ID': context.guestId,
                                                    'First Name': context.contactInfo.firstName,
                                                    'Last Name': context.contactInfo.lastName,
                                                    'Email': context.contactInfo.email,
                                                    'Mobile Number': context.contactInfo.mobileNumber,
                                                    'Organization Name': context.contactInfo.organizationName,
                                                }]
                                            }),
                                            ({ context }) => {
                                                console.log('✅ OTP verified successfully!');
                                                console.log('   matchedAccounts:', context.matchedAccounts.length);
                                                console.log('   orgMatchFound:', context.orgMatchFound);
                                                console.log('   sid:', context.sid);
                                                trackEventOtpVerified(context.selectedEventId);
                                            }
                                        ]
                                    },
                                    onError: {
                                        target: 'enteringGuestOtp',
                                        actions: 'assignError'
                                    }
                                }
                            },
                            decidePostAuthPath: {
                                always: [
                                    {
                                        // No Guest ID on matched account → create GUEST record first (e.g., customer from subscriptions)
                                        target: '#fundraiser.wizardFlow.submitting.creatingOrganization',
                                        guard: ({ context }) => {
                                            if (context.matchedAccounts.length !== 1) return false;
                                            return !context.matchedAccounts[0]['Guest ID'];
                                        },
                                    },
                                    {
                                        // Scenario 2a-mismatch: 1 account, org matches (or non-fundraiser), but name differs → prompt update
                                        target: '#fundraiser.wizardFlow.submitting.confirmingProfileUpdate',
                                        guard: ({ context }) => {
                                            if (context.matchedAccounts.length !== 1) return false;
                                            const account = context.matchedAccounts[0];
                                            const currentEvent = context.fundraiserEvents?.find(e => e.id === context.selectedEventId);
                                            const eventType = (currentEvent?.type || '').toLowerCase();
                                            const isFundraiser = eventType === 'fundraiser' || eventType === 'rolling fundraiser';
                                            // For fundraisers, org must match to be considered the same account
                                            if (isFundraiser) {
                                                const submittedOrg = (context.contactInfo.organizationName || '').toLowerCase().trim();
                                                const accountOrg = (account['Organization Name'] || '').toLowerCase().trim();
                                                if (submittedOrg !== accountOrg) return false;
                                            }
                                            const firstNameDiffers = context.contactInfo.firstName.trim() !== (account['First Name'] || '').trim();
                                            const lastNameDiffers = context.contactInfo.lastName.trim() !== (account['Last Name'] || '').trim();
                                            return firstNameDiffers || lastNameDiffers;
                                        },
                                        actions: assign({
                                            guestId: ({ context }) => context.matchedAccounts[0]['Guest ID'],
                                            customerId: ({ context }) => context.matchedAccounts[0]['Customer ID'] || context.customerId || null,
                                            profileMismatch: ({ context }) => {
                                                const account = context.matchedAccounts[0];
                                                return {
                                                    customerId: account['Customer ID'],
                                                    guestId: account['Guest ID'],
                                                    onFile: {
                                                        firstName: account['First Name'] || '',
                                                        lastName: account['Last Name'] || '',
                                                        organizationName: account['Organization Name'] || '',
                                                    },
                                                    submitted: {
                                                        firstName: context.contactInfo.firstName,
                                                        lastName: context.contactInfo.lastName,
                                                        organizationName: context.contactInfo.organizationName,
                                                    }
                                                };
                                            }
                                        })
                                    },
                                    {
                                        // Scenario 2a: Exactly 1 account, org matches (or non-fundraiser where org is irrelevant) → use directly
                                        target: '#fundraiser.wizardFlow.submitting.checkingDuplicate',
                                        guard: ({ context }) => {
                                            if (context.matchedAccounts.length !== 1) return false;
                                            // Non-fundraiser events: org name is irrelevant, just use the account
                                            const currentEvent = context.fundraiserEvents?.find(e => e.id === context.selectedEventId);
                                            const eventType = (currentEvent?.type || '').toLowerCase();
                                            const isFundraiser = eventType === 'fundraiser' || eventType === 'rolling fundraiser';
                                            if (!isFundraiser) return true;
                                            const submittedOrg = (context.contactInfo.organizationName || '').toLowerCase().trim();
                                            const accountOrg = (context.matchedAccounts[0]['Organization Name'] || '').toLowerCase().trim();
                                            return submittedOrg === accountOrg;
                                        },
                                        actions: assign({
                                            guestId: ({ context }) => context.matchedAccounts[0]['Guest ID'],
                                            customerId: ({ context }) => context.matchedAccounts[0]['Customer ID'] || context.customerId || null,
                                        })
                                    },
                                    {
                                        // Fundraiser: exact org match among multiple accounts → auto-select
                                        target: '#fundraiser.wizardFlow.submitting.checkingDuplicate',
                                        guard: ({ context }) => {
                                            const submittedOrg = (context.contactInfo.organizationName || '').toLowerCase().trim();
                                            if (!submittedOrg) return false;
                                            const accounts = context.matchedAccounts || [];
                                            // Find account with matching org + Guest ID
                                            const orgMatch = accounts.find(a =>
                                                a['Guest ID'] && (a['Organization Name'] || '').toLowerCase().trim() === submittedOrg
                                            );
                                            return !!orgMatch;
                                        },
                                        actions: assign({
                                            guestId: ({ context }) => {
                                                const submittedOrg = (context.contactInfo.organizationName || '').toLowerCase().trim();
                                                const accounts = context.matchedAccounts || [];
                                                const orgMatch = accounts.find(a =>
                                                    a['Guest ID'] && (a['Organization Name'] || '').toLowerCase().trim() === submittedOrg
                                                );
                                                return orgMatch['Guest ID'];
                                            },
                                            customerId: ({ context }) => {
                                                const submittedOrg = (context.contactInfo.organizationName || '').toLowerCase().trim();
                                                const accounts = context.matchedAccounts || [];
                                                const orgMatch = accounts.find(a =>
                                                    a['Guest ID'] && (a['Organization Name'] || '').toLowerCase().trim() === submittedOrg
                                                );
                                                return orgMatch?.['Customer ID'] || context.customerId || null;
                                            }
                                        })
                                    },
                                    {
                                        // Non-fundraiser events: all accounts same customer → auto-select best match
                                        target: '#fundraiser.wizardFlow.submitting.checkingDuplicate',
                                        guard: ({ context }) => {
                                            const currentEvent = context.fundraiserEvents?.find(e => e.id === context.selectedEventId);
                                            const eventType = (currentEvent?.type || '').toLowerCase();
                                            const isFundraiser = eventType === 'fundraiser' || eventType === 'rolling fundraiser';
                                            if (isFundraiser) return false;

                                            const accounts = context.matchedAccounts || [];
                                            if (accounts.length === 0) return false;

                                            // All accounts belong to same customer → same person
                                            const customerIds = [...new Set(accounts.map(a => a['Customer ID']).filter(Boolean))];
                                            if (customerIds.length !== 1) return false;

                                            // Pick best account: prefer both email+phone match with a Guest ID
                                            const bestMatch = accounts.find(a =>
                                                a['Guest ID'] && a.matchedOn?.includes('email') && a.matchedOn?.includes('phone')
                                            ) || accounts.find(a => a['Guest ID']);
                                            return !!bestMatch;
                                        },
                                        actions: assign({
                                            guestId: ({ context }) => {
                                                const accounts = context.matchedAccounts || [];
                                                const noOrgMatch = accounts.find(a =>
                                                    a['Guest ID'] && !(a['Organization Name'] || '').trim()
                                                );
                                                if (noOrgMatch) return noOrgMatch['Guest ID'];
                                                const best = accounts.find(a =>
                                                    a['Guest ID'] && a.matchedOn?.includes('email') && a.matchedOn?.includes('phone')
                                                ) || accounts.find(a => a['Guest ID']);
                                                return best?.['Guest ID'];
                                            },
                                            customerId: ({ context }) => {
                                                const accounts = context.matchedAccounts || [];
                                                const cid = accounts.find(a => a['Customer ID'])?.['Customer ID'];
                                                return cid || context.customerId || null;
                                            }
                                        })
                                    },
                                    {
                                        // All other scenarios → show account selection
                                        target: '#fundraiser.wizardFlow.submitting.resolvingAccountMatch',
                                    }
                                ]
                            }
                        }
                    },
                    checkingDuplicate: {
                        invoke: {
                            src: 'checkDuplicateRegistration',
                            input: ({ context }) => {
                                const datePart = (context.selectedDate || '').split('T')[0];
                                const [y, m, d] = datePart.split('-').map(Number);
                                let dateIso = null;
                                if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
                                    dateIso = new Date(Date.UTC(y, m - 1, d)).toISOString();
                                }
                                return {
                                    guestId: context.guestId,
                                    eventId: context.selectedEventId,
                                    date: dateIso,
                                };
                            },
                            onDone: [
                                {
                                    target: '#fundraiser.userDashboard',
                                    guard: ({ event }) => event.output.isDuplicate,
                                    actions: [
                                        assign({
                                            selectedDate: null,
                                            selectedTime: null,
                                            selectedEventId: null,
                                            duplicateNotice: true,
                                            lastFetchTimestamp: null,
                                        }),
                                    ]
                                },
                                {
                                    target: 'decidingPayment',
                                }
                            ],
                            onError: {
                                // Non-fatal — if the check fails, proceed to payment anyway
                                // The backend's createEventRegistration still has its own duplicate guard
                                target: 'decidingPayment',
                            }
                        }
                    },
                    decidingPayment: {
                        always: [
                            {
                                // Paid event → go to payment step
                                target: '#fundraiser.wizardFlow.selectingPayment',
                                guard: ({ context }) => {
                                    const currentEvent = context.fundraiserEvents.find(e => e.id === context.selectedEventId);
                                    let admissionFeeCents = currentEvent?.['Admission Fee Cents'] || currentEvent?.admissionFeeCents || 0;
                                    let pointsCost = currentEvent?.['Points Cost'] || currentEvent?.pointsCost || 0;
                                    if (currentEvent?.type === 'Tentpole' && Array.isArray(currentEvent?.schedule)) {
                                        const selDate = (context.selectedDate || '').substring(0, 10);
                                        const stop = currentEvent.schedule.find(s => s.date === selDate && s.locationId === context.selectedLocationId)
                                            || currentEvent.schedule.find(s => s.date === selDate);
                                        if (stop) {
                                            const stopFee = stop.admissionFeeCents || stop['Admission Fee Cents'] || 0;
                                            const stopPts = stop.pointsCost || stop['Points Cost'] || 0;
                                            if (stopFee > 0) admissionFeeCents = stopFee;
                                            if (stopPts > 0) pointsCost = stopPts;
                                        }
                                    }
                                    return admissionFeeCents > 0 || pointsCost > 0;
                                },
                                actions: assign({ paymentMethod: null, paymentNonce: null, stripeToken: null, encryptedCard: null, paymentError: null }),
                            },
                            {
                                // Free event → go directly to registration
                                target: 'creatingRegistration',
                            }
                        ]
                    },
                    creatingRegistration: {
                        entry: ({ context }) => {
                            const currentEvent = context.fundraiserEvents?.find(e => e.id === context.selectedEventId);
                            const role = roleFromEventType(currentEvent?.['Event Type'] || currentEvent?.eventType);

                            console.log('📝 Creating registration with:');
                            console.log('   guestId:', context.guestId);
                            console.log('   sid:', context.sid);
                            console.log('   eventId:', context.selectedEventId);
                            console.log('   date:', context.selectedDate);
                            console.log('   time:', context.selectedTime);
                            console.log('   locationId:', context.selectedLocationId);
                            console.log('   role:', role);
                            console.log('   smsOptIn:', context.contactInfo.smsOptIn);
                            
                            if (!context.guestId || !context.sid) {
                                console.error('❌ MISSING REQUIRED VALUES FOR REGISTRATION!');
                            }
                        },
                        invoke: {
                            src: 'createEventRegistration',
                            input: ({ context }) => {
                                // Parse date string safely — split on 'T' to handle both "2026-06-13" and ISO strings
                                const datePart = (context.selectedDate || '').split('T')[0];
                                const [y, m, d] = datePart.split('-').map(Number);
                                let dateIso = null;
                                if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
                                    dateIso = new Date(Date.UTC(y, m - 1, d)).toISOString();
                                }

                                const currentEvent = context.fundraiserEvents?.find(e => e.id === context.selectedEventId);
                                const role = roleFromEventType(currentEvent?.['Event Type'] || currentEvent?.eventType);

                                // Extract Meta/GA browser context for server-side conversion tracking
                                const fbc = document.cookie.match(/(?:^|;\s*)_fbc=([^;]*)/)?.[1] || undefined;
                                const fbp = document.cookie.match(/(?:^|;\s*)_fbp=([^;]*)/)?.[1] || undefined;
                                const gaRaw = document.cookie.match(/(?:^|;\s*)_ga=([^;]*)/)?.[1];
                                const gaClientId = gaRaw ? gaRaw.split('.').slice(2).join('.') : undefined;

                                return {
                                    guestId: context.guestId,
                                    eventId: context.selectedEventId,
                                    date: dateIso,
                                    time: context.selectedTime,
                                    locationId: context.selectedLocationId,
                                    sid: context.sid,
                                    role,
                                    smsOptIn: context.contactInfo.smsOptIn === true,
                                    consentAccepted: context.contactInfo.consentAccepted === true,
                                    reservationType: context.contactInfo.reservationType || null,
                                    partySize: context.contactInfo.partySize ? Number(context.contactInfo.partySize) : null,
                                    paymentMethod: context.paymentMethod || null,
                                    paymentNonce: context.paymentNonce || null,
                                    stripeToken: context.stripeToken || null,
                                    encryptedCard: context.encryptedCard || null,
                                    customerId: context.customerId || null,
                                    fbc,
                                    fbp,
                                    gaClientId,
                                    pageUrl: window.location.href,
                                    clientUserAgent: navigator.userAgent,
                                };
                            },
                            onDone: [
                                {
                                    // Duplicate registration → go to dashboard (user is already registered)
                                    target: '#fundraiser.userDashboard',
                                    guard: ({ event }) => event.output.outcome === 'DUPLICATE',
                                    actions: [
                                        assign({
                                            selectedDate: null,
                                            selectedTime: null,
                                            selectedEventId: null,
                                            duplicateNotice: true,
                                            lastFetchTimestamp: null, // Force re-fetch so dashboard shows fresh data
                                        }),
                                        ({ context }) => trackEventRegistrationCreated(context.selectedEventId, { outcome: 'duplicate', date: context.selectedDate, time: context.selectedTime }),
                                    ]
                                },
                                {
                                    target: '#fundraiser.userDashboard',
                                    guard: ({ event }) => event.output.outcome === 'SUCCESS',
                                    actions: [
                                        assign(({ context }) => {
                                            // Build the newly registered event object from context
                                            const currentEvent = context.fundraiserEvents?.find(e => e.id === context.selectedEventId);
                                            const selectedLocation = context.locations?.find(loc => loc.id === context.selectedLocationId);
                                            const role = roleFromEventType(currentEvent?.['Event Type'] || currentEvent?.eventType);

                                            // Format date for display — use date string directly to avoid UTC shift
                                            const formattedDate = (context.selectedDate || '').split('T')[0];

                                            const newEvent = {
                                                'Registered Event ID': `temp-${Date.now()}`, // Temporary ID until refresh
                                                'Event ID': context.selectedEventId,
                                                'Event Name': currentEvent?.title || currentEvent?.['Event Name'],
                                                'Event Date': formattedDate,
                                                'Event Time': context.selectedTime,
                                                'Location Name': selectedLocation?.['Location Name'] || '',
                                                'Location Address': selectedLocation?.Address || '',
                                                'Image URL': currentEvent?.imageUrl || currentEvent?.['Image URL'],
                                                'Description': currentEvent?.description || currentEvent?.['Description'],
                                                'Bullet Points': currentEvent?.bulletPoints || currentEvent?.['Bullet Points'],
                                                'Status': 'Pending',
                                                'Role': role
                                            };

                                            console.log('🎉 Registration successful! Adding event to list:', newEvent);

                                            // Add to the appropriate list based on role
                                            const currentEvents = context.registeredEvents || { hostedEvents: [], participantEvents: [] };
                                            let updatedEvents;

                                            if (role === 'Host') {
                                                updatedEvents = {
                                                    hostedEvents: [...(currentEvents.hostedEvents || []), newEvent],
                                                    participantEvents: currentEvents.participantEvents || []
                                                };
                                            } else {
                                                updatedEvents = {
                                                    hostedEvents: currentEvents.hostedEvents || [],
                                                    participantEvents: [...(currentEvents.participantEvents || []), newEvent]
                                                };
                                            }
                                            
                                            return {
                                                isAuthenticated: true,
                                                registeredEvents: updatedEvents,
                                                newlyRegisteredEvent: newEvent,
                                                lastFetchTimestamp: Date.now(),
                                                duplicateNotice: false,
                                            };
                                        }),
                                        ({ context }) => {
                                            console.log('Context at transition:', {
                                                guestId: context.guestId,
                                                sid: context.sid,
                                                isAuthenticated: true
                                            });
                                            
                                            if (!context.guestId) {
                                                console.error('❌ CRITICAL: guestId is NULL/undefined at transition!');
                                            }
                                            if (!context.sid) {
                                                console.error('❌ CRITICAL: sid is NULL/undefined at transition!');
                                            }
                                        },
                                        ({ context, event: machineEvent }) => {
                                            const evt = context.fundraiserEvents?.find(e => e.id === context.selectedEventId);
                                            trackEventRegistrationCreated(context.selectedEventId, { outcome: 'success', date: context.selectedDate, time: context.selectedTime, eventName: evt?.title || evt?.['Event Name'], registrationId: machineEvent.output.registrationId, paymentAmountCents: machineEvent.output.paymentAmountCents || 0, paymentMethod: context.paymentMethod });
                                            // Link visitor to customer so analytics shows their name
                                            if (context.customerId) {
                                                identifyUser(context.customerId, {
                                                    firstName: context.contactInfo?.firstName,
                                                    lastName: context.contactInfo?.lastName,
                                                    name: [context.contactInfo?.firstName, context.contactInfo?.lastName].filter(Boolean).join(' '),
                                                    email: context.contactInfo?.email,
                                                });
                                            }
                                        },
                                    ]
                                }
                            ],
                            onError: {
                                target: '#fundraiser.wizardFlow.selectingPayment',
                                actions: [
                                    'captureFailedRegistration',
                                    'assignError',
                                    assign({
                                        paymentError: ({ event }) => {
                                            const err = event.error || event.data;
                                            return typeof err === 'string' ? err : (err?.message || 'Registration failed. Please try again.');
                                        },
                                    }),
                                ],
                            }
                        }
                    }
                }
            },
            duplicateError: {
                on: {
                    RESET: {
                        target: '#fundraiser.directory',
                        actions: 'softReset'
                    }
                }
            },
            success: { type: 'final' }
        }
    },
    loginFlow: {
        initial: 'enteringIdentifier',
        states: {
            enteringIdentifier: {
                on: {
                    SUBMIT_IDENTIFIER: {
                        target: 'sendingOtp',
                        actions: assign({ loginIdentifier: ({ event }) => event.value })
                    },
                    BACK: '#fundraiser.directory'
                }
            },
            sendingOtp: {
                invoke: {
                    src: 'sendOtp',
                    input: ({ context }) => ({ identifier: context.loginIdentifier }),
                    onDone: {
                        target: 'enteringOtp',
                        actions: assign({
                            sid: ({ event }) => event.output.sid,
                            error: null
                        })
                    },
                    onError: { target: 'enteringIdentifier', actions: 'assignError' }
                }
            },
            enteringOtp: {
                on: {
                    SUBMIT_OTP: 'verifyingOtp',
                    BACK_TO_IDENTIFIER: 'enteringIdentifier'
                }
            },
            verifyingOtp: {
                invoke: {
                    src: 'verifyOtp',
                    input: ({ context, event }) => ({ identifier: context.loginIdentifier, otp: event.value }),
                    onDone: [
                        {
                            target: 'creatingSession',
                            guard: ({ event }) => Array.isArray(event.output) && event.output.length >= 1,
                            actions: assign({
                                    isAuthenticated: true,
                                    guestId: ({ event }) => {
                                        // Prefer an account with a Guest ID
                                        const withGuestId = event.output.filter(a => a['Guest ID']);
                                        return withGuestId.length > 0 ? withGuestId[0]['Guest ID'] : event.output[0]['Guest ID'];
                                    },
                                    potentialAccounts: ({ event }) => event.output,
                                    error: null
                                })
                        },
                        {
                            target: 'enteringIdentifier',
                            actions: assign({
                                error: 'No account was found for this contact information.'
                            })
                        }
                    ],
                    onError: {
                        target: 'enteringOtp',
                        actions: 'assignError'
                    }
                }
            },
            selectingAccount: {
                on: {
                    SELECT_ACCOUNT: {
                        actions: assign({
                            selectedAccountId: ({ event }) => event.accountId
                        })
                    },
                    CONFIRM_ACCOUNT_SELECTION: {
                        target: 'creatingSession',
                        guard: ({ context }) => !!context.selectedAccountId,
                        actions: assign({
                                isAuthenticated: true,
                                guestId: ({ context }) => {
                                    const selectedAccount = context.potentialAccounts.find(acc => acc['Guest ID'] === context.selectedAccountId);
                                    return selectedAccount ? selectedAccount['Guest ID'] : null;
                                }
                            })
                    },
                    BACK_TO_IDENTIFIER: 'enteringIdentifier'
                }
            },
            creatingSession: {
                invoke: {
                    src: 'createAccountSession',
                    input: ({ context }) => ({ guestId: context.guestId }),
                    onDone: {
                        target: '#fundraiser.userDashboard',
                        actions: assign({
                            sessionToken: ({ event }) => event.output.sessionToken || null,
                            customerId: ({ event }) => event.output.customerId || null,
                            lastSessionCreatedAt: () => Date.now(),
                        })
                    },
                    onError: {
                        target: '#fundraiser.userDashboard',
                        actions: [
                            assign({ lastSessionCreatedAt: () => Date.now() }),
                            () => console.warn('Account session creation failed (non-fatal)'),
                        ]
                    }
                }
            }
        }
    },
    failure: { type: 'final' }
  }
});
