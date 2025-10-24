import { setup, assign, fromPromise, createMachine } from 'xstate';
// ✅ LIST_EVENTS_URL has been re-added to the import list
import { LIST_LOCATIONS_URL, OTP_VERIFY_URL, LIST_EVENTS_URL, CHECK_GUEST_STATUS_URL, AUTHENTICATE_GUEST_URL, CREATE_EVENT_REGISTRATION_URL, LIST_REGISTERED_EVENTS_FOR_USER_URL, LIST_AND_UPDATE_TRANSACTION_DETAILS_AND_TALLY_URL, CREATE_ORGANIZATION_URL, UPDATE_PAYEE_URL } from '@/constants/events/eventsConstants';
import { format } from 'date-fns';

// Helper function to format phone numbers to E.164
const formatPhoneNumberE164 = (mobileNumber) => {
    const digits = mobileNumber.replace(/\D/g, '');
    if (digits.length === 10) return `+1${digits}`;
    if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
    return mobileNumber;
};

// Helper function to validate the contact form, now accepting the entire event object
const validateContactForm = (contactInfo, currentEvent) => {
    const errors = {};
    if (!contactInfo.firstName) errors.firstName = 'First name is required';
    if (!contactInfo.lastName) errors.lastName = 'Last name is required';

    // Conditionally require Organization Name based on the user's role for the event
    if (currentEvent?.Role === 'Host' && !contactInfo.organizationName) {
        errors.organizationName = 'Organization name is required for hosts';
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
    // Additions for partial match flow
    partialMatchAlternatives: [],
    selectedPartialMatch: null,
    // ✅ Add sid to context
    sid: null,
};

export const eventsMachine = setup({
  actors: {
    initialDataFetcher: fromPromise(async () => {
        const [locationsRes, eventsRes] = await Promise.all([
            fetch(LIST_LOCATIONS_URL),
            // ✅ This now correctly uses the constant from your updated file
            fetch(LIST_EVENTS_URL)
        ]);
        if (!locationsRes.ok) throw new Error(`Failed to fetch locations: ${locationsRes.statusText}`);
        if (!eventsRes.ok) throw new Error('Failed to fetch events');
        const locationsData = await locationsRes.json();
        const eventsData = await eventsRes.json();
        const dayNameToNumber = { 'Sunday': 0, 'Monday': 1, 'Tuesday': 2, 'Wednesday': 3, 'Thursday': 4, 'Friday': 5, 'Saturday': 6 };
        const normalizedEvents = eventsData.map(event => ({
            id: event['Event ID'],
            title: event['Event Name'],
            imageUrl: event['Image URL'] || '/src/assets/images/placeholder.png',
            description: event['Description'],
            type: event['Event Type'] || 'Event',
            status: 'Active',
            // Pass the Role through from the API response
            Role: event['Role'],
            bulletPoints: event['Bullet Points']
                ? event['Bullet Points'].split('\n').map(point => ({ name: point.trim(), id: point.trim() }))
                : [],
            startDate: event['Start Date'],
            endDate: event['End Date'],
            daysOfWeek: (event['Days of Week'] || []).map(day => dayNameToNumber[day]),
            eventTimes: event['Event Times'] || [],
        }));
        return {
            locations: locationsData.map(loc => ({
                id: loc['Location ID'],
                'Location Name': loc['Location Name'],
                Address: loc['Location Address']
            })),
            events: normalizedEvents
        };
    }),
    checkGuestStatus: fromPromise(async ({ input }) => {
        const response = await fetch(CHECK_GUEST_STATUS_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(input)
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
            action: 'check',
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
    },
    ),
    createOrganization: fromPromise(async ({ input }) => {
        const response = await fetch(CREATE_ORGANIZATION_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(input) // Sends the contactInfo object
        });
        if (!response.ok) throw new Error('Failed to create organization.');
        return await response.json(); // Expects a response with a Guest ID
    }),
    createEventRegistration: fromPromise(async ({ input }) => {
        const response = await fetch(CREATE_EVENT_REGISTRATION_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(input)
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
            body: JSON.stringify(input)
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
        const payload = { action: 'send', to, channel };
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
        const response = await fetch(OTP_VERIFY_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'check', to, channel, code: otp })
        });
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: 'Verification failed' }));
            throw new Error(errorData.message || 'Invalid verification code.');
        }
        return await response.json();
    }),
    fetchRegisteredEvents: fromPromise(async ({ input }) => {
        console.log("1. USER DASHBOARD: Fetching registered events with payload:", input);
        const response = await fetch(LIST_REGISTERED_EVENTS_FOR_USER_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(input)
        });
        if (!response.ok) throw new Error("Could not fetch user's registered events.");
        const rawEvents = await response.json();
        return rawEvents;
    }),
    fetchTransactionDetails: fromPromise(async ({ input }) => {
        console.log("3. FETCH ACTOR INPUT:", input);
        const response = await fetch(LIST_AND_UPDATE_TRANSACTION_DETAILS_AND_TALLY_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(input)
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
                        timestamp: txn.created_at || new Date().toISOString(), // Temporary fallback
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
        error: ({ event }) => event.data?.message || 'An unknown error occurred.',
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
  initial: 'loadingInitialData',

  on: {
    RESET: {
      target: '.directory',
      actions: 'softReset',
    },
  },

  states: {
    loadingInitialData: {
        invoke: {
            src: 'initialDataFetcher',
            onDone: {
              target: 'routing',
              actions: assign(({ context, event }) => ({
                    ...context,
                    locations: event.output.locations,
                    fundraiserEvents: event.output.events,
                }))
            },
            onError: { target: 'failure', actions: 'assignError' },
        },
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
        initial: 'loadingEvents',
        states: {
            loadingEvents: {
                invoke: {
                    src: 'fetchRegisteredEvents',
                    input: ({ context }) => ({
                        guestId: context.guestId,
                        sid: context.sid
                    }),
                    onDone: {
                        target: 'idle',
                        actions: assign({ registeredEvents: ({ event }) => event.output || [] })
                    },
                    onError: {
                        target: 'idle',
                        actions: 'assignError'
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
                                const updatedList = context.registeredEvents.map(re =>
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
                                return context.registeredEvents.map(re =>
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
        initial: 'validating',
        states: {
            validating: {
                always: [
                    { target: '#fundraiser.directory', guard: ({ context }) => !context.selectedEventId },
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
                            error: null // Clear error when a new date is selected
                        })
                    },
                    PROCEED_TO_CONTACT: [
                        {
                            target: 'selectingContact',
                            guard: ({ context }) => {
                                const currentEvent = context.fundraiserEvents.find(e => e.id === context.selectedEventId);
                                return currentEvent?.eventTimes?.length === 1;
                            },
                            actions: assign({
                                selectedTime: ({ context }) => {
                                    const currentEvent = context.fundraiserEvents.find(e => e.id === context.selectedEventId);
                                    return currentEvent.eventTimes[0];
                                }
                            })
                        },
                        {
                            target: 'selectingTime'
                        }
                    ],
                    BACK: 'selectingLocation'
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
                    BACK: 'selectingTime'
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
                                    target: 'awaitingGuestAuthentication', // Perfect match, NOT authenticated
                                    guard: ({ event }) => Array.isArray(event.output) && event.output.length === 1 && event.output[0]?.['Guest ID'],
                                    actions: assign({
                                        contactInfo: ({ event, context }) => ({ ...context.contactInfo, ...event.output[0] }),
                                        guestId: ({ event }) => event.output[0]['Guest ID']
                                    })
                                },
                                {
                                    target: 'awaitingGuestAuthentication', // Partial Match - verify first
                                    guard: ({ event }) => Array.isArray(event.output) && event.output[0]?.partialMatch,
                                    actions: assign({
                                        partialMatchAlternatives: ({ event }) => event.output[0].partialMatch,
                                        selectedPartialMatch: null
                                    })
                                },
                                {
                                    target: 'creatingOrganization', // No match / New user
                                    guard: ({ event }) => event.output?.action === 'Create Event',
                                }
                            ],
                            onError: {
                              target: '#fundraiser.wizardFlow.selectingContact',
                              actions: 'assignError',
                            }
                        }
                    },
                    resolvingPartialMatch: {
                        on: {
                            SELECT_PARTIAL_MATCH: {
                                actions: assign({
                                    selectedPartialMatch: ({ event }) => event.selection
                                })
                            },
                            CONFIRM_PARTIAL_MATCH: [
                                {
                                    target: 'creatingOrganization',
                                    guard: ({ context }) => context.selectedPartialMatch?.isNew
                                },
                                {
                                    target: 'creatingRegistration',
                                    guard: ({ context }) => !!context.selectedPartialMatch,
                                    actions: assign({
                                        guestId: ({ context }) => context.selectedPartialMatch['Guest ID'],
                                        contactInfo: ({ context }) => ({ ...context.contactInfo, ...context.selectedPartialMatch }),
                                    })
                                }
                            ],
                            BACK: '#fundraiser.wizardFlow.selectingContact'
                        }
                    },
                    creatingOrganization: {
                        invoke: {
                            src: 'createOrganization',
                            input: ({ context }) => context.contactInfo,
                            onDone: {
                                target: 'awaitingGuestAuthentication',
                                actions: assign({
                                    guestId: ({ event }) => event.output[0]?.['Guest ID'],
                                    partialMatchAlternatives: [],
                                    sid: null
                                })
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
                                        actions: assign({
                                            sid: ({ event }) => event.output.sid
                                        })
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
                                        target: 'decidePartialMatchPath',
                                        actions: assign({
                                            guestId: ({ context, event }) => context.guestId || event.output['Guest ID'],
                                            // ✅ This is the fix: save the contact info as the potential account
                                            potentialAccounts: ({ context }) => [{
                                                'Guest ID': context.guestId,
                                                'First Name': context.contactInfo.firstName,
                                                'Last Name': context.contactInfo.lastName,
                                                'Email': context.contactInfo.email,
                                                'Mobile Number': context.contactInfo.mobileNumber,
                                                'Organization Name': context.contactInfo.organizationName,
                                            }]
                                        })
                                    },
                                    onError: {
                                        target: 'enteringGuestOtp',
                                        actions: 'assignError'
                                    }
                                }
                            },
                            decidePartialMatchPath: {
                                always: [
                                    { target: '#fundraiser.wizardFlow.submitting.resolvingPartialMatch', guard: ({ context }) => context.partialMatchAlternatives?.length > 0 },
                                    { target: '#fundraiser.wizardFlow.submitting.creatingRegistration' }
                                ]
                            }
                        }
                    },
                    creatingRegistration: {
                        invoke: {
                            src: 'createEventRegistration',
                            input: ({ context }) => {
                                const localDate = new Date(context.selectedDate);
                                const utcDate = new Date(Date.UTC(localDate.getFullYear(), localDate.getMonth(), localDate.getDate()));
                                
                                return {
                                    guestId: context.guestId,
                                    eventId: context.selectedEventId,
                                    date: utcDate.toISOString(),
                                    time: context.selectedTime,
                                    locationId: context.selectedLocationId,
                                    sid: context.sid
                                };
                            },
                            onDone: [
                                {
                                    target: '#fundraiser.wizardFlow.selectingDate',
                                    guard: ({ event }) => event.output.outcome === 'DUPLICATE',
                                    actions: assign({
                                        error: 'You already have an event scheduled for this day. Please choose another date.',
                                        selectedDate: null,
                                        selectedTime: null,
                                        sid: null,
                                    })
                                },
                                {
                                    target: '#fundraiser.userDashboard',
                                    guard: ({ event }) => event.output.outcome === 'SUCCESS',
                                    actions: assign({ isAuthenticated: true })
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
                            sid: ({ event }) => event.output.sid
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
                                guestId: ({event}) => event.output.guestId
                            })
                        },
                        {
                            target: '#fundraiser.userDashboard',
                            guard: ({ event }) => Array.isArray(event.output) && event.output.length === 1,
                            actions: assign({
                                    isAuthenticated: true,
                                    guestId: ({ event }) => event.output[0]['Guest ID'],
                                    potentialAccounts: ({ event }) => event.output
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

