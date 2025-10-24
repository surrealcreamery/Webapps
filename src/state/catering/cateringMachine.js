import { setup, assign, fromPromise } from 'xstate';
// Assuming catering auth uses the same endpoints as events
// ✅ IMPORTED THE CORRECT AUTHENTICATE_GUEST_URL
import { LIST_ITEMS_URL, LIST_MODIFIERS_URL, CHECK_GUEST_STATUS_URL, OTP_VERIFY_URL, CREATE_ORGANIZATION_URL, AUTHENTICATE_GUEST_URL, LIST_LOCATIONS_URL } from '@/constants/catering/cateringConstants';

// --- Helper: Format phone number
const formatPhoneNumberE164 = (mobileNumber) => {
    const digits = (mobileNumber || '').replace(/\D/g, '');
    if (digits.length === 10) return `+1${digits}`;
    if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
    return mobileNumber;
};

// --- Persistence ---
const CATERING_STORAGE_KEY = 'cateringState';
const defaultFulfillment = {
    type: 'pickup',
    locationId: null,
    address: { street: '', city: '', state: '', zip: '' }
};

const persistState = ({ context }) => {
    try {
        const stateToSave = {
            cart: context.cart,
            selectedCategory: context.selectedCategory,
            lastView: context.lastView,
            editingItem: context.editingItem,
            isAuthenticated: context.isAuthenticated,
            guestId: context.guestId,
            contactInfo: context.contactInfo,
            fulfillmentDetails: context.fulfillmentDetails,
        };
        localStorage.setItem(CATERING_STORAGE_KEY, JSON.stringify(stateToSave));
    } catch (error) {
        console.error("Failed to save catering state to localStorage", error);
    }
};


// --- Helper Functions ---
const normalizeMenuData = (items, modifiers) => {
    // console.log('[normalizeMenuData] Starting normalization...');
    const modifiersByItemId = modifiers.reduce((acc, modifier) => {
        if (modifier.Items && modifier.Items.length > 0) {
            modifier.Items.forEach(itemId => {
                if (!acc[itemId]) acc[itemId] = [];
                acc[itemId].push(modifier);
            });
        }
        return acc;
    }, {});

    return items.map((item, index) => {
        // console.log(`[normalizeMenuData] Processing raw item ${index}:`, item);
        const itemModifiers = modifiersByItemId[item['Item ID']] || [];
        const groupedModifiers = itemModifiers.reduce((acc, modifier) => {
            const catId = modifier['Linked: Modifier Category ID in Modifier Categories']?.[0];
            const catName = modifier['Modifier Category Name']?.[0];
            if (catId && catName) {
                if (!acc[catId]) {
                    acc[catId] = {
                        ModifierCategoryID: catId,
                        ModifierCategoryName: catName,
                        ModifierCategoryMinimum: modifier['Modifier Minimum']?.[0] || null,
                        ModifierCategoryMaximum: modifier['Modifier Maximum']?.[0] || null,
                        Modifiers: []
                    };
                }
                acc[catId].Modifiers.push({
                    'Modifier ID': modifier['Modifier ID'],
                    'Modifier Name': modifier['Modifier Name'],
                    'Modifier Type': modifier['Modifier Type'],
                    'Modifier Price': modifier['Modifier Price']
                });
            }
            return acc;
        }, {});

        const discounts = [];
        const minQuantities = item['Minimum Quantity Discount'] || [];
        const fixedAmounts = item['Fixed Amount Discount'] || [];
        const percentageAmounts = item['Percentage Discount'] || [];

        minQuantities.forEach((minQty, index) => {
            discounts.push({
                minimumQuantity: minQty,
                fixedAmount: fixedAmounts[index] || null,
                percentage: percentageAmounts[index] || null,
            });
        });

        let categoryDescription = [];
        if (item['Category Description'] && item['Category Description'][0]) {
            // console.log(`[normalizeMenuData] Found description for item ${item['Item Name']}: "${item['Category Description'][0]}"`);
            categoryDescription = item['Category Description'][0].split('\n').filter(line => line.trim() !== '');
        }

        const normalizedItem = {
            ...item,
            'Category Name': item['Category Name']?.[0] || 'Uncategorized',
            'Category Description': categoryDescription,
            ModifierCategories: Object.values(groupedModifiers),
            discounts
        };
        // console.log(`[normalizeMenuData] Finished processing item ${index}. Result:`, normalizedItem);
        return normalizedItem;
    });
};

const groupItemsByCategory = (menuData) => {
    // console.log('[groupItemsByCategory] Starting grouping...');
    const grouped = menuData.reduce((acc, item) => {
        const category = item['Category Name'];
        if (!acc[category]) {
            acc[category] = { image: null, description: [], items: [] };
        }
        acc[category].items.push(item);
        if (!acc[category].image && item['Item Category Image'] && item['Item Category Image'][0]) {
            acc[category].image = item['Item Category Image'][0];
        }
        if (acc[category].description.length === 0 && item['Category Description'].length > 0) {
            // console.log(`[groupItemsByCategory] Assigning description to category "${category}":`, item['Category Description']);
            acc[category].description = item['Category Description'];
        }
        return acc;
    }, {});

    for (const category in grouped) {
        grouped[category].items.sort((a, b) => (a['Show In Order'] || 999) - (b['Show In Order'] || 999));
    }

    // console.log('[groupItemsByCategory] Final grouped structure:', grouped);
    return grouped;
};


export const cateringMachine = setup({
    actors: {
        fetchInitialData: fromPromise(async () => {
            const [itemsResponse, modifiersResponse, locationsResponse] = await Promise.all([
                fetch(LIST_ITEMS_URL),
                fetch(LIST_MODIFIERS_URL),
                fetch(LIST_LOCATIONS_URL) // ✅ Fetch locations
            ]);
            if (!itemsResponse.ok || !modifiersResponse.ok || !locationsResponse.ok) {
                throw new Error('Failed to fetch initial catering data');
            }
            const items = await itemsResponse.json();
            const modifiers = await modifiersResponse.json();
            const locations = await locationsResponse.json();
            
            const normalizedData = normalizeMenuData(items, modifiers);
            return {
                menu: groupItemsByCategory(normalizedData),
                locations: locations // Assuming locations are already in a good format
            };
        }),
        checkGuestStatus: fromPromise(async ({ input }) => {
            console.log('%c[AuthFlow] checkGuestStatus actor input:', 'color: #blueviolet', input);
            const response = await fetch(CHECK_GUEST_STATUS_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: input.email, mobileNumber: input.mobileNumber })
            });
             if (!response.ok) {
                 const errorText = await response.text();
                 console.error('[AuthFlow] checkGuestStatus actor ERROR:', errorText);
                 throw new Error(`Failed to check guest status. Status: ${response.status}`);
             }
             const result = await response.json();
             console.log('%c[AuthFlow] checkGuestStatus actor SUCCESS:', 'color: #blueviolet', result);
             return result;
        }),
        createOrganization: fromPromise(async ({ input }) => {
            console.log('%c[AuthFlow] createOrganization actor input:', 'color: #blueviolet', input);
             const response = await fetch(CREATE_ORGANIZATION_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(input) // Sends { email, mobileNumber, organizationName }
            });
             if (!response.ok) {
                 const errorText = await response.text();
                 console.error('[AuthFlow] createOrganization actor ERROR:', errorText);
                 throw new Error(`Failed to create organization. Status: ${response.status}`);
             }
             const result = await response.json();
             console.log('%c[AuthFlow] createOrganization actor SUCCESS:', 'color: #blueviolet', result);
             // Expects response like [{ "Guest ID": "rec..." }] or similar
             return result;
        }),
        sendOtp: fromPromise(async ({ input }) => {
            const { identifier, email, channel } = input;
            let to = identifier;

            if (channel === 'sms') {
                to = formatPhoneNumberE164(identifier);
            }
            
            const payload = { action: 'send', to, channel };
            if (email) payload.email = email;
            
            console.log('%c[AuthFlow] sendOtp actor payload:', 'color: #blueviolet', payload);
            
            const response = await fetch(OTP_VERIFY_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ message: 'Failed to send OTP' }));
                console.error('[AuthFlow] sendOtp actor ERROR:', errorData);
                throw new Error(errorData.message);
            }
            const result = await response.json();
            console.log('%c[AuthFlow] sendOtp actor SUCCESS:', 'color: #blueviolet', result);
            return result;
        }),
        authenticateGuest: fromPromise(async ({ input }) => {
             const { otp, identifier, email, channel } = input;
             console.log('%c[AuthFlow] authenticateGuest actor input:', 'color: #blueviolet', { otp, identifier, email, channel });

            let to = identifier;
            if (channel === 'sms') {
                to = formatPhoneNumberE164(identifier);
            }
            const payload = { action: 'check', to, channel, code: otp, email };
            
             console.log('%c[AuthFlow] authenticateGuest actor payload:', 'color: #blueviolet', payload);

            const response = await fetch(AUTHENTICATE_GUEST_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

             console.log('%c[AuthFlow] authenticateGuest actor response status:', 'color: #blueviolet', response.status);
            
            if (!response.ok) {
                 const errorData = await response.json().catch(() => ({ message: 'Authentication failed.' }));
                 console.error('[AuthFlow] authenticateGuest actor ERROR:', errorData);
                throw new Error(errorData.message);
            }
            const result = await response.json();
             console.log('%c[AuthFlow] authenticateGuest actor SUCCESS:', 'color: #blueviolet', result);
             return result;
        }),
    },
    actions: {
        persistState,
        rehydrateState: assign((context) => {
            const defaultState = {
                cart: [],
                selectedCategory: null,
                lastView: 'browsing',
                editingItem: null,
                isAuthenticated: false,
                guestId: null,
                contactInfo: { email: '', mobileNumber: '' },
                fulfillmentDetails: defaultFulfillment
            };
            try {
                const rawState = localStorage.getItem(CATERING_STORAGE_KEY);
                if (rawState) {
                    const parsed = JSON.parse(rawState);
                    return {
                        ...context,
                        ...defaultState, // Apply defaults first
                        ...parsed, // Then overwrite with saved data
                        // Ensure nested objects also get defaults
                        fulfillmentDetails: {
                            ...defaultFulfillment,
                            ...(parsed.fulfillmentDetails || {}),
                            address: parsed.fulfillmentDetails?.address || defaultFulfillment.address
                        },
                        contactInfo: parsed.contactInfo || defaultState.contactInfo,
                    };
                }
            } catch (e) { console.error("Failed to rehydrate state", e); }
            // Return context merged with defaults if rehydration fails or is partial
            return { ...context, ...defaultState };
        }),
        assignInitialData: assign({
            menu: ({ event }) => event.output.menu,
            locations: ({ event }) => event.output.locations,
        }),
        refreshCartItems: assign({
            cart: ({ context }) => {
                const { cart, menu } = context;
                if (!cart || cart.length === 0 || !menu) return [];
                const allItemsById = Object.values(menu).flatMap(category => category.items).reduce((acc, item) => {
                    acc[item['Item ID']] = item;
                    return acc;
                }, {});
                return cart.map(cartItem => {
                    const freshItem = allItemsById[cartItem.item['Item ID']];
                    return freshItem ? { ...cartItem, item: freshItem } : null;
                }).filter(Boolean);
            }
        }),
        assignError: assign({ error: ({ event }) => event.data?.message || 'An error occurred.' }),
        selectCategory: assign({ selectedCategory: ({ event }) => event.category }),
        setEditingItem: assign({ editingItem: ({ event }) => event.item }),
        clearEditingItem: assign({ editingItem: null, tempSelectedModifiers: null }),
        assignTempModifiers: assign({
            tempSelectedModifiers: ({ event }) => event.selectedModifiers,
        }),
        addToCart: assign({
            cart: ({ context, event }) => {
                const { item, selectedModifiers, quantity = 1 } = event;
                const modifierString = Object.entries(selectedModifiers).filter(([, qty]) => qty > 0).map(([id, qty]) => `${id}:${qty}`).sort().join(',');
                const cartItemId = `${item['Item ID']}-${modifierString}`;
                const existingItemIndex = context.cart.findIndex(cartItem => cartItem.id === cartItemId);
                let updatedCart;
                if (existingItemIndex > -1) {
                    updatedCart = [...context.cart];
                    updatedCart[existingItemIndex].quantity += quantity;
                } else {
                    updatedCart = [...context.cart, { id: cartItemId, item, selectedModifiers, quantity }];
                }
                return updatedCart;
            },
            editingItem: null,
            tempSelectedModifiers: null,
        }),
        updateCartQuantity: assign({
            cart: ({ context, event }) => context.cart.map(cartItem =>
                cartItem.id === event.cartItemId ? { ...cartItem, quantity: Math.max(1, cartItem.quantity + event.change) } : cartItem
            )
        }),
        removeFromCart: assign({
            cart: ({ context, event }) => context.cart.filter(item => item.id !== event.cartItemId)
        }),
        assignContactInfo: assign({
            contactInfo: ({ context, event }) => ({ ...context.contactInfo, [event.field]: event.value }),
            formErrors: ({ context, event }) => {
                const newErrors = { ...context.formErrors };
                delete newErrors[event.field]; // Clear error for the specific field being updated
                return newErrors;
            }
        }),
        setAuthSuccess: assign({
            isAuthenticated: true,
            guestId: ({ event }) => event.output?.['Guest ID'], // Assuming OTP verify returns Guest ID
             // Store the full contact info (email, phone, etc.) used for auth
             contactInfo: ({ context }) => context.contactInfo
        }),
        assignPotentialAccounts: assign({
             potentialAccounts: ({ event }) => event.output[0].partialMatch || [], // Store the partialMatch array
             selectedAccountId: null
        }),
        assignSingleAccount: assign({
            // ✅ FIX: Correct merge order. User's form data is the base.
            contactInfo: ({ event, context }) => {
                console.log('%c[AuthFlow] Merging contact info. Form data (base):', 'color: #f59e0b', context.contactInfo);
                console.log('%c[AuthFlow] Merging contact info. Server data (overwrites):', 'color: #f59e0b', event.output[0]);
                const merged = {...context.contactInfo, ...event.output[0]};
                console.log('%c[AuthFlow] Merging contact info. Result:', 'color: #22c55e', merged);
                return merged;
            },
            guestId: ({ event }) => event.output[0]['Guest ID'],
            potentialAccounts: []
        }),
        assignNewUser: assign({
            potentialAccounts: []
        }),
        assignSelectedAccount: assign({
            selectedAccountId: ({ event }) => event.accountId
        }),
        assignNewOrgGuestId: assign({
             guestId: ({ event }) => event.output?.[0]?.['Guest ID'],
             potentialAccounts: [],
             selectedAccountId: null
        }),
        clearAuthData: assign({
            otpChannel: null,
            sid: null,
            potentialAccounts: [],
            selectedAccountId: null,
            error: null,
        }),
        // Action to set the final authenticated guestId after account selection
        setFinalGuestFromSelection: assign({
            guestId: ({ context }) => context.selectedAccountId,
            contactInfo: ({ context }) => {
                 const selected = context.potentialAccounts.find(acc => acc['Guest ID'] === context.selectedAccountId);
                 // ✅ FIX: Correct merge order
                 return selected ? {...context.contactInfo, ...selected} : context.contactInfo;
            }
        }),
        // ✅ Actions for fulfillment
        setFulfillmentType: assign({
            fulfillmentDetails: (({ context, event }) => ({
                ...defaultFulfillment, // Reset all fields
                type: event.type // Set the new type
            }))
        }),
        selectPickupLocation: assign({
            fulfillmentDetails: (({ context, event }) => ({
                ...defaultFulfillment,
                type: 'pickup',
                locationId: event.locationId
            }))
        }),
        updateDeliveryAddress: assign({
            fulfillmentDetails: (({ context, event }) => ({
                ...context.fulfillmentDetails,
                type: 'delivery',
                locationId: null, // Clear location ID
                address: {
                    ...context.fulfillmentDetails.address,
                    [event.field]: event.value
                }
            }))
        }),
    },
}).createMachine({
    id: 'catering',
    context: {
        menu: {}, 
        cart: [], 
        selectedCategory: null, 
        editingItem: null, 
        error: null, 
        lastView: 'browsing', 
        tempSelectedModifiers: null, 
        isAuthenticated: false, 
        guestId: null, 
        contactInfo: { email: '', mobileNumber: '', organizationName: '' }, 
        formErrors: {}, 
        otpChannel: null, 
        sid: null, 
        potentialAccounts: [], 
        selectedAccountId: null,
        locations: [],
        fulfillmentDetails: defaultFulfillment, // Use default
    },
    initial: 'booting',
    on: {
        RESET: { 
            target: '#catering.browsing.browsingCategories',
            actions: [assign({ selectedCategory: null, editingItem: null, isAuthenticated: false, guestId: null }), 'persistState'] 
        },
        VIEW_CART: { 
            target: '#catering.viewingCart',
            actions: 'persistState' 
        },
        TRIGGER_AUTH: { 
            target: '#catering.authenticationFlow',
            guard: ({ context }) => !context.isAuthenticated 
        }
    },
    states: {
        booting: { entry: 'rehydrateState', always: 'loadingMenu' },
        loadingMenu: {
            invoke: {
                src: 'fetchInitialData',
                onDone: { target: 'restoring', actions: ['assignInitialData', 'refreshCartItems', 'persistState'] },
                onError: { target: 'failure', actions: 'assignError' },
            },
        },
        restoring: {
             always: [
                 { target: '#catering.browsing.browsingCategories', guard: ({ context }) => context.isAuthenticated && !context.selectedCategory && context.lastView !== 'cart'},
                 { target: '#catering.viewingCart', guard: ({ context }) => context.isAuthenticated && context.lastView === 'cart' },
                 { target: '#catering.browsing.browsingItems', guard: ({ context }) => context.isAuthenticated && context.selectedCategory },
                 { target: '#catering.viewingCart', guard: ({ context }) => context.lastView === 'cart' },
                 { target: '#catering.browsing.editingItem', guard: ({ context }) => !!context.editingItem && context.editingItem.ModifierCategories.some(cat => cat.ModifierCategoryMinimum !== null) },
                 { target: '#catering.browsing.viewingItemDetails', guard: ({ context }) => !!context.editingItem },
                 { target: '#catering.browsing.browsingItems', guard: ({ context }) => !!context.selectedCategory },
                 { target: '#catering.browsing.browsingCategories' }
            ]
        },
        browsing: {
            entry: assign({ lastView: 'browsing' }),
            initial: 'browsingCategories',
            states: {
                 browsingCategories: {
                    on: { SELECT_CATEGORY: { target: 'browsingItems', actions: ['selectCategory', 'persistState'], guard: ({ event }) => event.category !== null } },
                },
                 browsingItems: {
                    on: {
                        GO_BACK: { target: 'browsingCategories', actions: [assign({ selectedCategory: null, editingItem: null }), 'persistState'] },
                        EDIT_ITEM: { target: 'editingItem', actions: ['setEditingItem', 'persistState'] },
                        VIEW_ITEM: { target: 'viewingItemDetails', actions: ['setEditingItem', 'persistState'] },
                    },
                },
                 viewingItemDetails: {
                    on: {
                        GO_BACK: { target: 'browsingItems', actions: ['clearEditingItem', 'persistState'] },
                        ADD_TO_CART: { target: 'browsingItems', actions: ['addToCart', 'clearEditingItem', 'persistState'] }
                    }
                },
                 editingItem: {
                    on: {
                        GO_BACK: { target: 'browsingItems', actions: ['clearEditingItem', 'persistState'] },
                        CONFIRM_MODIFIERS: { target: 'selectingQuantity', actions: 'assignTempModifiers' }
                    }
                },
                 selectingQuantity: {
                    on: {
                        GO_BACK: { target: 'editingItem', actions: assign({ tempSelectedModifiers: null }) },
                        ADD_TO_CART: { target: 'browsingItems', actions: ['addToCart', 'persistState'] }
                    }
                },
                 history: { type: 'history' }
            }
        },
        viewingCart: {
             entry: [assign({ lastView: 'cart' }), 'persistState'],
            on: {
                 GO_BACK: '#catering.browsing.history',
                 UPDATE_QUANTITY: { actions: ['updateCartQuantity', 'persistState'] },
                 REMOVE_ITEM: { actions: ['removeFromCart', 'persistState'] },
                 SET_FULFILLMENT_TYPE: { actions: ['setFulfillmentType', 'persistState'] },
                 SELECT_PICKUP_LOCATION: { actions: ['selectPickupLocation', 'persistState'] },
                 UPDATE_DELIVERY_ADDRESS: { actions: ['updateDeliveryAddress', 'persistState'] },
            }
        },
        authenticationFlow: {
            entry: 'clearAuthData',
             initial: 'enteringContactInfo',
             states: {
                 enteringContactInfo: {
                    entry: () => console.log('%c[AuthFlow] State: enteringContactInfo', 'color: #8b5cf6'),
                    on: {
                        UPDATE_FIELD: { actions: 'assignContactInfo' },
                        SUBMIT_CONTACT: 'checkingGuestStatus',
                         GO_BACK: { target: '#catering.browsing.history', actions: 'clearAuthData' }
                    }
                },
                 checkingGuestStatus: {
                    entry: () => console.log('%c[AuthFlow] State: checkingGuestStatus', 'color: #8b5cf6'),
                    invoke: {
                         src: 'checkGuestStatus',
                         input: ({ context }) => context.contactInfo,
                         onDone: [
                            {
                                 target: 'awaitingAuthentication',
                                 guard: ({ event }) => Array.isArray(event.output) && event.output.length === 1 && event.output[0]?.partialMatch,
                                 actions: ['assignPotentialAccounts', () => console.log('%c[AuthFlow] Transition: Partial match found.', 'color: #orange')]
                            },
                            {
                                 target: 'awaitingAuthentication',
                                 guard: ({ event }) => Array.isArray(event.output) && event.output.length === 1,
                                 actions: ['assignSingleAccount', () => console.log('%c[AuthFlow] Transition: Single account found.', 'color: #orange')]
                            },
                             {
                                target: 'creatingOrganization',
                                guard: ({ event, context }) => event.output?.action === 'Create Organization' || (event.output?.length === 0 && context.contactInfo.organizationName),
                                actions: ['assignNewUser', () => console.log('%c[AuthFlow] Transition: No account, creating org.', 'color: #orange')]
                            },
                             {
                                target: 'awaitingAuthentication',
                                actions: ['assignNewUser', () => console.log('%c[AuthFlow] Transition: No account, new user OTP.', 'color: #orange')]
                            }
                        ],
                         onError: { target: 'enteringContactInfo', actions: 'assignError' }
                    }
                },
                 selectingAccount: {
                    entry: () => console.log('%c[AuthFlow] State: selectingAccount', 'color: #8b5cf6'),
                    on: {
                        SELECT_ACCOUNT: {
                            actions: 'assignSelectedAccount'
                        },
                        CONFIRM_ACCOUNT_SELECTION: {
                             target: '#catering.browsing.history',
                             guard: ({ context }) => !!context.selectedAccountId,
                             actions: ['setFinalGuestFromSelection', 'persistState']
                        },
                         CREATE_NEW_ORGANIZATION: 'creatingOrganization',
                         BACK: { target: 'enteringContactInfo', actions: 'clearAuthData' }
                    }
                },
                 creatingOrganization: {
                    entry: () => console.log('%c[AuthFlow] State: creatingOrganization', 'color: #8b5cf6'),
                     invoke: {
                         src: 'createOrganization',
                         input: ({ context }) => context.contactInfo,
                         onDone: {
                             target: 'awaitingAuthentication',
                             actions: 'assignNewOrgGuestId'
                         },
                         onError: { target: 'enteringContactInfo', actions: 'assignError' }
                     }
                 },
                 awaitingAuthentication: {
                    entry: () => console.log('%c[AuthFlow] State: awaitingAuthentication', 'color: #8b5cf6'),
                     initial: 'choosingMethod',
                     states: {
                        choosingMethod: {
                            entry: () => console.log('%c[AuthFlow] State: choosingMethod', 'color: #8b5cf6'),
                            on: {
                                CHOOSE_EMAIL: { target: 'sendingOtp', actions: [assign({ otpChannel: 'email' }), () => console.log('%c[AuthFlow] Event: CHOOSE_EMAIL', 'color: #blue')] },
                                CHOOSE_SMS: { target: 'sendingOtp', actions: [assign({ otpChannel: 'sms' }), () => console.log('%c[AuthFlow] Event: CHOOSE_SMS', 'color: #blue')] },
                                BACK: '#catering.authenticationFlow.enteringContactInfo'
                            }
                        },
                        sendingOtp: {
                            entry: () => console.log('%c[AuthFlow] State: sendingOtp', 'color: #8b5cf6'),
                             invoke: {
                                src: 'sendOtp',
                                input: ({ context }) => {
                                    const input = {
                                        identifier: context.otpChannel === 'email' ? context.contactInfo.email : context.contactInfo.mobileNumber,
                                        email: context.contactInfo.email,
                                        channel: context.otpChannel
                                    };
                                    console.log('%c[AuthFlow] sendingOtp actor input:', 'color: #blue', input);
                                    return input;
                                },
                                onDone: { target: 'enteringOtp', actions: assign({ sid: ({event}) => event.output.sid }) },
                                onError: { target: 'choosingMethod', actions: 'assignError' }
                            }
                        },
                        enteringOtp: {
                            entry: () => console.log('%c[AuthFlow] State: enteringOtp', 'color: #8b5cf6'),
                            on: {
                                SUBMIT_OTP: 'verifyingOtp', 
                                BACK: 'choosingMethod'
                            }
                        },
                        verifyingOtp: {
                            entry: () => console.log('%c[AuthFlow] State: verifyingOtp', 'color: #8b5cf6'),
                            invoke: {
                                src: 'authenticateGuest',
                                input: ({context, event}) => {
                                    const input = {
                                        otp: event.otp, 
                                        identifier: context.otpChannel === 'email' ? context.contactInfo.email : context.contactInfo.mobileNumber,
                                        email: context.contactInfo.email,
                                        channel: context.otpChannel
                                    };
                                    console.log('%c[AuthFlow] verifyingOtp actor input:', 'color: #blue', input);
                                    return input;
                                },
                                onDone: {
                                    target: 'decidePartialMatchPath',
                                    actions: ['setAuthSuccess', 'persistState']
                                },
                                onError: {
                                    target: 'enteringOtp',
                                    actions: ['assignError', () => console.error('%c[AuthFlow] OTP verification failed.', 'color: #ef4444')]
                                }
                            }
                        },
                        decidePartialMatchPath: {
                            always: [
                                {
                                    target: '#catering.authenticationFlow.selectingAccount',
                                    guard: ({ context }) => context.potentialAccounts.length > 0
                                },
                                {
                                    target: '#catering.browsing.history'
                                }
                            ]
                        }
                    }
                }
            }
        },
        failure: { type: 'final' },
    },
});

