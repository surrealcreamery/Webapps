import { setup, assign, fromPromise, createMachine } from 'xstate';
import { EVENTS_API_URL, OTP_VERIFY_URL, CHECK_GUEST_STATUS_URL, AUTHENTICATE_GUEST_URL, CREATE_EVENT_REGISTRATION_URL, LIST_REGISTERED_EVENTS_FOR_USER_URL, LIST_AND_UPDATE_TRANSACTION_DETAILS_AND_TALLY_URL, CREATE_ORGANIZATION_URL, UPDATE_PAYEE_URL } from '@/constants/events/eventsConstants';
import { format } from 'date-fns';

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
    
    console.log('📊 Raw field values:');
    console.log('   Start Date (from API):', currentEvent['Start Date']);
    console.log('   End Date (from API):', currentEvent['End Date']);
    console.log('   Days of Week (from API):', currentEvent['Days of Week']);
    console.log('   startDate (camelCase):', currentEvent.startDate);
    console.log('   endDate (camelCase):', currentEvent.endDate);
    console.log('   daysOfWeek (camelCase):', currentEvent.daysOfWeek);
    console.log('   Using startDateRaw:', startDateRaw);
    console.log('   Using endDateRaw:', endDateRaw);
    console.log('   Using daysOfWeek:', daysOfWeek);
    
    const startDate = new Date(startDateRaw);
    const endDate = new Date(endDateRaw);
    
    console.log('📅 Parsed dates:');
    console.log('   startDate object:', startDate);
    console.log('   startDate valid?', !isNaN(startDate.getTime()));
    console.log('   startDate ISO:', startDate.toISOString());
    console.log('   startDate local string:', startDate.toString());
    console.log('   endDate object:', endDate);
    console.log('   endDate valid?', !isNaN(endDate.getTime()));
    console.log('   endDate ISO:', endDate.toISOString());
    
    // ✅ FIX: Create dates in local timezone to avoid day shifting
    // Parse "2025-11-28" as November 28 in local timezone, not UTC
    const [startYear, startMonth, startDay] = startDateRaw.split('-').map(Number);
    const [endYear, endMonth, endDay] = endDateRaw.split('-').map(Number);
    
    const startDateLocal = new Date(startYear, startMonth - 1, startDay);
    const endDateLocal = new Date(endYear, endMonth - 1, endDay);
    
    console.log('📅 Local timezone dates:');
    console.log('   startDateLocal:', startDateLocal.toString());
    console.log('   startDateLocal day of week:', startDateLocal.getDay());
    console.log('   endDateLocal:', endDateLocal.toString());
    console.log('   endDateLocal day of week:', endDateLocal.getDay());
    
    // Convert day names to numbers
    const dayNumbers = getDayNumbers(daysOfWeek);
    console.log('🔢 Day conversion:');
    console.log('   Input daysOfWeek:', daysOfWeek);
    console.log('   Converted dayNumbers:', dayNumbers);
    
    if (dayNumbers.length === 0) {
        console.error('❌ No valid days of week found!', daysOfWeek);
        return null;
    }
    
    const targetDayOfWeek = dayNumbers[0]; // Get first valid day number
    
    console.log('🎯 Target day:', targetDayOfWeek, '(0=Sun, 1=Mon, etc.)');
    
    let current = new Date(startDateLocal);
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Start of today
    
    console.log('⏰ Date iteration:');
    console.log('   Starting from:', current.toString());
    console.log('   Starting ISO:', current.toISOString());
    console.log('   Today:', today.toString());
    console.log('   End date:', endDateLocal.toString());
    
    let iterationCount = 0;
    while (current <= endDateLocal) {
        const currentDayOfWeek = current.getDay();
        iterationCount++;
        
        if (iterationCount <= 10) { // Only log first 10 iterations
            console.log(`   Day ${iterationCount}: ${current.toDateString()} (day ${currentDayOfWeek}) - Match target ${targetDayOfWeek}? ${currentDayOfWeek === targetDayOfWeek}, >= today? ${current >= today}`);
        }
        
        if (currentDayOfWeek === targetDayOfWeek && current >= today) {
            console.log('   ✅ Found valid date:', current.toISOString());
            return current.toISOString();
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
const validateContactForm = (contactInfo, currentEvent) => {
    const errors = {};
    if (!contactInfo.firstName) errors.firstName = 'First name is required';
    if (!contactInfo.lastName) errors.lastName = 'Last name is required';

    // Organization name is required for all fundraiser events
    const eventType = (currentEvent?.type || currentEvent?.Type || '').toLowerCase();
    const isFundraiser = eventType === 'fundraiser' || eventType === 'rolling fundraiser';
    if (isFundraiser && !contactInfo.organizationName) {
        errors.organizationName = 'Organization name is required';
    }

    if (!contactInfo.email) errors.email = 'Email is required';
    if (!contactInfo.mobileNumber) errors.mobileNumber = 'Mobile number is required';
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
        email: '',
        mobileNumber: '',
        smsOptIn: true,
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
            await response.json();
            return { outcome: 'SUCCESS' };
        } catch (error) {
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
    }),
    hardReset: assign({
        ...initialContext,
        locations: ({ context }) => context.locations,
        fundraiserEvents: ({ context }) => context.fundraiserEvents,
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
            GO_TO_DASHBOARD: 'userDashboard',
            CHOOSE_FUNDRAISER: {
              target: 'wizardFlow',
              actions: assign({ selectedEventId: ({ event }) => event.eventId })
            },
        }
    },
    userDashboard: {
        initial: 'checkingCache',
        states: {
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
                entry: ({ context }) => {
                    console.log('📊 Entering userDashboard.loadingEvents state');
                    console.log('   Context values:', {
                        guestId: context.guestId,
                        sid: context.sid,
                        isAuthenticated: context.isAuthenticated,
                        selectedEventId: context.selectedEventId
                    });
                },
                invoke: {
                    src: 'fetchRegisteredEvents',
                    input: ({ context }) => ({
                        guestId: context.guestId,
                        sid: context.sid
                    }),
                    onDone: {
                        target: 'idle',
                        actions: [
                            assign({ 
                                registeredEvents: ({ event }) => {
                                    // ✅ NEW API FORMAT: Returns [{ hostedEvents: [], participantEvents: [] }]
                                    let output = event.output;
                                    
                                    console.log('🔍 DEBUG: Raw API response:', JSON.stringify(output, null, 2));
                                    console.log('🔍 DEBUG: Type of output:', typeof output);
                                    console.log('🔍 DEBUG: Is array?', Array.isArray(output));
                                    
                                    // ✅ API returns array wrapper - extract first element
                                    if (Array.isArray(output) && output.length > 0) {
                                        console.log('🔍 DEBUG: Extracting first element from array wrapper');
                                        output = output[0];
                                    }
                                    
                                    console.log('🔍 DEBUG: Has hostedEvents?', output?.hostedEvents);
                                    console.log('🔍 DEBUG: Has participantEvents?', output?.participantEvents);
                                    
                                    // Check if it's the new format
                                    if (output && typeof output === 'object' && 
                                        (output.hostedEvents || output.participantEvents)) {
                                        console.log('✅ Detected new API format with hostedEvents/participantEvents');
                                        return output; // Store the object (not array)
                                    }
                                    
                                    // Fallback to old format (array)
                                    console.log('⚠️ Using old API format (array)');
                                    return Array.isArray(output) ? output : [];
                                },
                                // ✅ Set timestamp for cache checking
                                lastFetchTimestamp: () => Date.now(),
                                // ✅ Clear selectedEventId
                                selectedEventId: null
                            }),
                            ({ event }) => {
                                console.log('✅ Dashboard events loaded successfully');
                                
                                let output = event.output;
                                if (Array.isArray(output) && output.length > 0) {
                                    output = output[0];
                                }
                                
                                console.log('   Registered events:', output);
                                
                                if (output && typeof output === 'object' && 
                                    (output.hostedEvents || output.participantEvents)) {
                                    console.log('   Hosted events count:', output.hostedEvents?.length || 0);
                                    console.log('   Participant events count:', output.participantEvents?.length || 0);
                                } else {
                                    console.log('   Event count:', Array.isArray(output) ? output.length : 'Not an object');
                                }
                            }
                        ]
                    },
                    onError: {
                        target: 'idle',
                        actions: [
                            'assignError',
                            ({ event }) => {
                                console.error('❌ Failed to load dashboard events');
                                console.error('   Error:', event.error);
                            }
                        ]
                    }
                }
            },
            idle: {}
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
                on: {
                    SELECT_LOCATION: {
                        target: 'validating',
                        actions: [
                            assign({ selectedLocationId: ({ event }) => {
                                console.log('🎯 SELECT_LOCATION: Setting selectedLocationId to:', event.value);
                                return event.value;
                            }}),
                            ({ event }) => console.log('🎯 SELECT_LOCATION action completed for:', event.value)
                        ]
                    },
                    PROCEED_TO_SCHEDULING: 'validating', 
                    BACK: '#fundraiser.directory'
                }
            },
            
            validating: {
                always: [
                    { target: '#fundraiser.directory', guard: ({ context }) => !context.selectedEventId },
                    
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
                        actions: assign({
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
                            }
                        })
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
                        actions: assign({ 
                            selectedLocationId: ({ context }) => {
                                const currentEvent = context.fundraiserEvents.find(e => e.id === context.selectedEventId);
                                const locationIds = currentEvent['Location ID'] || currentEvent.locationIds;
                                return locationIds[0];
                            },
                            selectedDate: ({ context }) => {
                                const currentEvent = context.fundraiserEvents.find(e => e.id === context.selectedEventId);
                                return calculateFirstValidDate(currentEvent);
                            }
                        })
                    },
                    
                    // ✅ EXISTING: Skip location selection if only one location (but still show date picker)
                    { 
                        target: 'selectingDate', 
                        guard: ({ context }) => {
                            const currentEvent = context.fundraiserEvents.find(e => e.id === context.selectedEventId);
                            const locationIds = currentEvent?.['Location ID'] || currentEvent?.locationIds;
                            return currentEvent && locationIds && locationIds.length === 1;
                        },
                        actions: assign({ 
                            selectedLocationId: ({ context }) => {
                                const currentEvent = context.fundraiserEvents.find(e => e.id === context.selectedEventId);
                                const locationIds = currentEvent['Location ID'] || currentEvent.locationIds;
                                return locationIds[0];
                            }
                        })
                    },

                    { target: 'selectingLocation' }
                ]
            },
            selectingLocation: {
                on: {
                    SELECT_LOCATION: {
                        target: 'selectingDate',
                        actions: assign({ selectedLocationId: ({ event }) => event.value })
                    }
                }
            },
            selectingDate: {
                on: {
                    SELECT_DATE: {
                        actions: assign({
                            selectedDate: ({ event }) => event.value,
                            error: null
                        })
                    },
                    PROCEED_TO_CONTACT: [
                        {
                            target: 'selectingContact',
                            guard: ({ context }) => {
                                const currentEvent = context.fundraiserEvents.find(e => e.id === context.selectedEventId);
                                const eventTimes = parseEventTimes(currentEvent?.['Event Times'] || currentEvent?.eventTimes);
                                return eventTimes.length <= 1;
                            },
                            actions: assign({
                                selectedTime: ({ context }) => {
                                    const currentEvent = context.fundraiserEvents.find(e => e.id === context.selectedEventId);
                                    const eventTimes = parseEventTimes(currentEvent['Event Times'] || currentEvent.eventTimes);
                                    return eventTimes[0] || null;
                                }
                            })
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
                        actions: assign({ selectedTime: ({ event }) => event.value })
                    },
                    PROCEED_TO_CONTACT: 'selectingContact',
                    BACK: {
                        target: 'selectingDate',
                        actions: assign({ selectedTime: null })
                    }
                }
            },
            selectingContact: {
                entry: assign({
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
                        {
                            target: 'submitting',
                            guard: ({ context }) => {
                                const currentEvent = context.fundraiserEvents.find(e => e.id === context.selectedEventId);
                                const errors = validateContactForm(context.contactInfo, currentEvent);
                                return Object.keys(errors).length === 0;
                            },
                            actions: assign({ formErrors: {} })
                        },
                        {
                            actions: assign({
                                formErrors: ({ context }) => {
                                    const currentEvent = context.fundraiserEvents.find(e => e.id === context.selectedEventId);
                                    return validateContactForm(context.contactInfo, currentEvent);
                                }
                            })
                        }
                    ],
                    // ✅ SMART BACK BUTTON: Go to the last screen the user actually saw
                    BACK: [
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
            submitting: {
                initial: 'decidingAuthPath',
                states: {
                    decidingAuthPath: {
                        always: [
                            {
                                target: 'creatingRegistration',
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
                                }
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
                              actions: 'assignError',
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
                                    target: 'creatingRegistration',
                                    guard: ({ context }) => !!context.selectedPartialMatch && !context.selectedPartialMatch.isNew,
                                    actions: assign({
                                        guestId: ({ context }) => context.selectedPartialMatch['Guest ID'],
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
                                target: 'creatingRegistration',
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
                                target: 'creatingRegistration',
                                actions: assign({ profileMismatch: null })
                            },
                            onError: {
                                target: 'creatingRegistration',
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
                                target: 'creatingRegistration',
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
                            CONFIRM_ACCOUNT_FOR_EVENT: {
                                target: 'creatingRegistration',
                                guard: ({ context }) => !!context.selectedAccountId,
                                actions: assign({
                                    guestId: ({ context }) => context.selectedAccountId
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
                                            ({ event }) => {
                                                console.log('✅ OTP sent successfully!');
                                                console.log('   Setting sid to:', event.output.sid);
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
                                        // Scenario 2a-mismatch: 1 account, org matches, but name differs → prompt update
                                        target: '#fundraiser.wizardFlow.submitting.confirmingProfileUpdate',
                                        guard: ({ context }) => {
                                            if (context.matchedAccounts.length !== 1) return false;
                                            const account = context.matchedAccounts[0];
                                            const submittedOrg = (context.contactInfo.organizationName || '').toLowerCase().trim();
                                            const accountOrg = (account['Organization Name'] || '').toLowerCase().trim();
                                            if (submittedOrg !== '' && submittedOrg !== accountOrg) return false;
                                            const firstNameDiffers = context.contactInfo.firstName.trim() !== (account['First Name'] || '').trim();
                                            const lastNameDiffers = context.contactInfo.lastName.trim() !== (account['Last Name'] || '').trim();
                                            return firstNameDiffers || lastNameDiffers;
                                        },
                                        actions: assign({
                                            guestId: ({ context }) => context.matchedAccounts[0]['Guest ID'],
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
                                        // Scenario 2a: Exactly 1 account, org matches, name matches → use directly
                                        target: '#fundraiser.wizardFlow.submitting.creatingRegistration',
                                        guard: ({ context }) => {
                                            if (context.matchedAccounts.length !== 1) return false;
                                            const submittedOrg = (context.contactInfo.organizationName || '').toLowerCase().trim();
                                            const accountOrg = (context.matchedAccounts[0]['Organization Name'] || '').toLowerCase().trim();
                                            return submittedOrg === '' || submittedOrg === accountOrg;
                                        },
                                        actions: assign({
                                            guestId: ({ context }) => context.matchedAccounts[0]['Guest ID'],
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
                                const localDate = new Date(context.selectedDate);
                                const utcDate = new Date(Date.UTC(localDate.getFullYear(), localDate.getMonth(), localDate.getDate()));

                                const currentEvent = context.fundraiserEvents?.find(e => e.id === context.selectedEventId);
                                const role = roleFromEventType(currentEvent?.['Event Type'] || currentEvent?.eventType);

                                return {
                                    guestId: context.guestId,
                                    eventId: context.selectedEventId,
                                    date: utcDate.toISOString(),
                                    time: context.selectedTime,
                                    locationId: context.selectedLocationId,
                                    sid: context.sid,
                                    role,
                                    smsOptIn: context.contactInfo.smsOptIn === true
                                };
                            },
                            onDone: [
                                {
                                    // ✅ SMART DUPLICATE HANDLING: Check if user can select another date
                                    target: '#fundraiser.wizardFlow.duplicateError',
                                    guard: ({ event, context }) => {
                                        if (event.output.outcome !== 'DUPLICATE') return false;
                                        
                                        // Check if event has only one possible date
                                        const currentEvent = context.fundraiserEvents.find(e => e.id === context.selectedEventId);
                                        if (!currentEvent) return false;
                                        
                                        const daysOfWeek = currentEvent['Days of Week'] || currentEvent.daysOfWeek;
                                        const hasSingleDay = daysOfWeek && daysOfWeek.length === 1;
                                        
                                        // If single day, user can't pick another date - show error state
                                        return hasSingleDay;
                                    },
                                    actions: assign({
                                        error: 'You have already registered for this event.',
                                        selectedDate: null,
                                        selectedTime: null,
                                    })
                                },
                                {
                                    // ✅ If multiple dates available, let user pick another
                                    target: '#fundraiser.wizardFlow.selectingDate',
                                    guard: ({ event }) => event.output.outcome === 'DUPLICATE',
                                    actions: assign({
                                        error: 'You already have an event scheduled for this day. Please choose another date.',
                                        selectedDate: null,
                                        selectedTime: null,
                                    })
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

                                            // Format date for display
                                            const localDate = new Date(context.selectedDate);
                                            const formattedDate = `${localDate.getFullYear()}-${String(localDate.getMonth() + 1).padStart(2, '0')}-${String(localDate.getDate()).padStart(2, '0')}`;

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
                                                lastFetchTimestamp: Date.now()
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
                                        }
                                    ]
                                }
                            ],
                            onError: {
                                target: '#fundraiser.wizardFlow.selectingContact',
                                actions: 'assignError'
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
                            target: 'selectingAccount',
                            guard: ({ event }) => {
                                const isMultiple = Array.isArray(event.output) && event.output.length > 1;
                                console.log('MULTIPLE ACCOUNT CHECK:', { output: event.output, isArray: Array.isArray(event.output), length: event.output?.length, isMultiple });
                                return isMultiple;
                            },
                            actions: assign({
                                potentialAccounts: ({ event }) => event.output,
                                selectedAccountId: null,
                                guestId: ({event}) => event.output.guestId,
                                error: null
                            })
                        },
                        {
                            target: '#fundraiser.userDashboard',
                            guard: ({ event }) => Array.isArray(event.output) && event.output.length === 1,
                            actions: assign({
                                    isAuthenticated: true,
                                    guestId: ({ event }) => event.output[0]['Guest ID'],
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
                        target: '#fundraiser.userDashboard',
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
            }
        }
    },
    failure: { type: 'final' }
  }
});
