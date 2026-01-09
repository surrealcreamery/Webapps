import { setup, assign, fromPromise } from 'xstate';
// Constants import
import {
    LIST_ITEMS_URL, LIST_MODIFIERS_URL, CHECK_GUEST_STATUS_URL,
    OTP_VERIFY_URL, CREATE_ORGANIZATION_URL, AUTHENTICATE_GUEST_URL,
    LIST_LOCATIONS_URL, CREATE_ACCOUNT_URL,
    UPDATE_ORGANIZATION_NAME_AND_ACCOUNT_TYPE_URL, SAVE_CART_URL
} from '@/constants/catering/cateringConstants';

// --- Helper: Format phone number ---
const formatPhoneNumberE164 = (mobileNumber) => {
    const digits = (mobileNumber || '').replace(/\D/g, '');
    if (digits.length === 10) return `+1${digits}`; // US 10-digit
    if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`; // US 11-digit
    if (!digits || (digits.length !== 10 && digits.length !== 11)) {
        console.warn(`[formatPhoneNumberE164] Could not format number to E.164: ${mobileNumber}`);
    }
    return mobileNumber;
};

// --- Persistence ---
const CATERING_STORAGE_KEY = 'cateringState';
const defaultFulfillment = {
    type: 'pickup',
    locationId: null,
    address: { street: '', aptSuite: '', city: '', state: '', zip: '', fullAddressText: '' },
    selectedDate: null,
    selectedTime: null
};

const persistState = ({ context }) => {
    try {
        const stateToSave = {
            cart: context.cart,
            selectedCategory: context.selectedCategory,
            lastView: context.lastView,
            editingItem: context.editingItem,
            isAuthenticated: context.isAuthenticated,
            isVerified: context.isVerified, // Add isVerified to persistence
            accountId: context.accountId,
            contactInfo: context.contactInfo,
            fulfillmentDetails: context.fulfillmentDetails,
            // Note: selectedPackaging is NOT persisted here - it's managed by CategoryListView
            // This ensures footer shows on /catering page load
        };
        console.log('%c[persistState] Saving state with lastView:', 'color: #ff7f50; font-weight: bold;', context.lastView);
        console.log('%c[persistState] Full state:', 'color: #ff7f50', JSON.stringify(stateToSave, null, 2));
        localStorage.setItem(CATERING_STORAGE_KEY, JSON.stringify(stateToSave));
    } catch (error) {
        console.error("Failed to save catering state to localStorage", error);
    }
};


// --- Helper Functions ---
const normalizeMenuData = (items, modifiers) => {
    const modifiersByItemId = modifiers.reduce((acc, modifier) => {
        if (modifier.Items && modifier.Items.length > 0) {
            modifier.Items.forEach(itemId => {
                if (!acc[itemId]) acc[itemId] = [];
                acc[itemId].push(modifier);
            });
        }
        return acc;
    }, {});

    return items.map((item) => {
        if (!item || !item['Item ID']) return null;
        const itemModifiers = modifiersByItemId[item['Item ID']] || [];
        const groupedModifiers = itemModifiers.reduce((acc, modifier) => {
            const catId = modifier?.['Linked: Modifier Category ID in Modifier Categories']?.[0];
            const catName = modifier?.['Modifier Category Name']?.[0];
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
                if (modifier['Modifier ID'] && modifier['Modifier Name']) {
                    acc[catId].Modifiers.push({
                        'Modifier ID': modifier['Modifier ID'],
                        'Modifier Name': modifier['Modifier Name'],
                        'Modifier Type': modifier['Modifier Type'],
                        'Modifier Price': modifier['Modifier Price']
                    });
                }
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
            categoryDescription = item['Category Description'][0].split('\n').filter(line => line.trim() !== '');
        }

        const normalizedItem = {
            ...item,
            'Category Name': item['Category Name']?.[0] || 'Uncategorized',
            'Category Description': categoryDescription,
            ModifierCategories: Object.values(groupedModifiers),
            discounts
        };
        return normalizedItem;
    }).filter(Boolean);
};

const groupItemsByCategory = (menuData) => {
    if (!menuData || !Array.isArray(menuData)) return {};
    const grouped = menuData.reduce((acc, item) => {
        if (!item || !item['Category Name']) return acc;
        const category = item['Category Name'];
        if (!acc[category]) {
            acc[category] = { image: null, description: [], items: [] };
        }
        acc[category].items.push(item);
        if (!acc[category].image && item['Item Category Image'] && item['Item Category Image'][0]) {
            acc[category].image = item['Item Category Image'][0];
        }
        if (acc[category].description.length === 0 && item['Category Description']?.length > 0) {
            acc[category].description = item['Category Description'];
        }
        return acc;
    }, {});

    for (const category in grouped) {
        if (grouped[category]?.items) {
            grouped[category].items.sort((a, b) => (a?.['Show In Order'] || 999) - (b?.['Show In Order'] || 999));
        }
    }
    return grouped;
};

const hasOrgAndType = (contactInfo) => {
    const orgName = contactInfo?.organizationName;
    const accType = contactInfo?.accountType;
    if (accType === 'Retail') return true; 
    return !!orgName && !!accType;
};


export const cateringMachine = setup({
    actors: {
        fetchInitialData: fromPromise(async () => {
            const [itemsResponse, modifiersResponse, locationsResponse] = await Promise.all([
                fetch(LIST_ITEMS_URL), fetch(LIST_MODIFIERS_URL), fetch(LIST_LOCATIONS_URL)
            ]);
            if (!itemsResponse.ok || !modifiersResponse.ok || !locationsResponse.ok) throw new Error('Failed to fetch initial catering data');
            const items = await itemsResponse.json();
            const modifiers = await modifiersResponse.json();
            const locations = await locationsResponse.json();
            const normalizedData = normalizeMenuData(items, modifiers);
            return { menu: groupItemsByCategory(normalizedData), locations };
        }),
        checkAccountStatus: fromPromise(async ({ input }) => {
            console.log('%c[AuthFlow] checkAccountStatus actor input:', 'color: #blueviolet', input);
            const response = await fetch(CHECK_GUEST_STATUS_URL, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: input.email, mobileNumber: formatPhoneNumberE164(input.mobileNumber) })
            });
             if (!response.ok) { const txt = await response.text(); console.error('[AuthFlow] checkAccountStatus actor ERROR:', txt); throw new Error(`Failed to check guest status. Status: ${response.status}`); }
             const result = await response.json();
             console.log('%c[AuthFlow] checkAccountStatus actor SUCCESS:', 'color: #blueviolet', result);
             return result;
        }),
        createOrganization: fromPromise(async ({ input }) => {
            console.log('%c[AuthFlow] createOrganization actor input:', 'color: #blueviolet', input);
             const response = await fetch(CREATE_ORGANIZATION_URL, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...input, mobileNumber: formatPhoneNumberE164(input.mobileNumber) })
            });
             if (!response.ok) { const txt = await response.text(); console.error('[AuthFlow] createOrganization actor ERROR:', txt); throw new Error(`Failed to create organization. Status: ${response.status}`); }
             const result = await response.json();
             console.log('%c[AuthFlow] createOrganization actor SUCCESS:', 'color: #blueviolet', result);
             return result;
        }),
        sendOtp: fromPromise(async ({ input }) => {
            const { identifier, email, channel } = input;
            let to = identifier;
            if (channel === 'sms') to = formatPhoneNumberE164(identifier);
            const payload = { action: 'send', to, channel };
            if (email) payload.email = email;
            console.log('%c[AuthFlow] sendOtp actor payload:', 'color: #blueviolet', payload);
            const response = await fetch(OTP_VERIFY_URL, {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
            });
            if (!response.ok) { const err = await response.json().catch(()=>({})); console.error('[AuthFlow] sendOtp actor ERROR:', err); throw new Error(err.message || 'Failed to send OTP'); }
            const result = await response.json();
            console.log('%c[AuthFlow] sendOtp actor SUCCESS:', 'color: #blueviolet', result);
            return result;
        }),
        authenticateAccount: fromPromise(async ({ input }) => {
             const { otp, identifier, email, channel, sid } = input;
             console.log('%c[AuthFlow] authenticateAccount actor input:', 'color: #blueviolet', { otp, identifier, email, channel, sid });
            let to = identifier;
            if (channel === 'sms') to = formatPhoneNumberE164(identifier);
            const payload = { action: 'check', to, channel, code: otp, email, sid };
             console.log('%c[AuthFlow] authenticateAccount actor payload:', 'color: #blueviolet', payload);
            const response = await fetch(AUTHENTICATE_GUEST_URL, {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
            });
             console.log('%c[AuthFlow] authenticateAccount actor response status:', 'color: #blueviolet', response.status);
            if (!response.ok) { const err = await response.json().catch(()=>({})); console.error('[AuthFlow] authenticateAccount actor ERROR:', err); throw new Error(err.message || 'Authentication failed.'); }
            const result = await response.json();
             console.log('%c[AuthFlow] authenticateAccount actor SUCCESS:', 'color: #blueviolet', result);
             return result;
        }),
        createAccount: fromPromise(async ({ input }) => {
            console.log('%c[AuthFlow] createAccount actor input:', 'color: #a78bfa', input);
            const response = await fetch(CREATE_ACCOUNT_URL, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: input.email,
                    mobileNumber: formatPhoneNumberE164(input.mobileNumber),
                    firstName: input.firstName,
                    lastName: input.lastName
                })
            });
            if (!response.ok) { const txt = await response.text(); console.error('[AuthFlow] createAccount actor ERROR:', txt); throw new Error(`Create account failed: ${response.status}`); }
            const result = await response.json();
            console.log('%c[AuthFlow] createAccount actor SUCCESS:', 'color: #a78bfa', result);
            if (!result?.[0]?.['Account ID']) {
                 console.error("Create account response missing Account ID:", result);
                 throw new Error('Create account response missing Account ID.');
            }
            return result[0];
        }),
        updateOrgAndAccountType: fromPromise(async ({ input }) => {
            const { accountId, organizationName, accountType } = input;
            console.log('%c[updateOrgAndAccountType Actor] Input received:', 'color: #f472b6; font-weight: bold;', { accountId, organizationName, accountType });
            
            if (!accountId || !accountType) {
                console.error('[updateOrgAndAccountType Actor] ERROR: Missing required accountId or accountType.');
                throw new Error('Missing ID or Account Type for update.');
            }
            
            const payload = { accountId, accountType };
            if (organizationName) {
                payload.organizationName = organizationName;
            }

            console.log('%c[updateOrgAndAccountType Actor] Attempting fetch to:', 'color: #f472b6;', UPDATE_ORGANIZATION_NAME_AND_ACCOUNT_TYPE_URL);
            console.log('%c[updateOrgAndAccountType Actor] Sending payload:', 'color: #f472b6;', payload);

            const response = await fetch(UPDATE_ORGANIZATION_NAME_AND_ACCOUNT_TYPE_URL, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            console.log('%c[updateOrgAndAccountType Actor] Fetch response status:', 'color: #f472b6;', response.status);
            if (!response.ok) {
                const txt = await response.text();
                console.error('[updateOrgAndAccountType Actor] Fetch ERROR:', txt);
                throw new Error(`Update org/type failed: ${response.status}`);
            }
            const result = await response.json();
            console.log('%c[updateOrgAndAccountType Actor] Fetch SUCCESS:', 'color: #f472b6;', result);
            return result;
        }),
        saveCart: fromPromise(async ({ input }) => {
            console.log('%c[saveCart Actor] Saving cart data:', 'color: #10b981; font-weight: bold;', input);
            
            const response = await fetch(SAVE_CART_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(input)
            });

            if (!response.ok) {
                const txt = await response.text();
                console.error('[saveCart Actor] ERROR:', txt);
                throw new Error(`Save cart failed: ${response.status}`);
            }

            const result = await response.json();
            console.log('%c[saveCart Actor] SUCCESS:', 'color: #10b981;', result);
            return result;
        }),
    },
    actions: {
        persistState,
        rehydrateState: assign((context) => {
            const defaultState = {
                cart: [], selectedCategory: null, lastView: 'browsing', editingItem: null,
                isAuthenticated: false, isVerified: false, accountId: null,
                contactInfo: { email: '', mobileNumber: '', organizationName: '', firstName: '', lastName: '', accountType: null, accountId: null },
                loginContactInfo: { email: '', mobileNumber: '', firstName: '', lastName: '' },
                fulfillmentDetails: defaultFulfillment,
                formErrors: {}, otpChannel: null, sid: null, potentialAccounts: [],
                selectedAccountId: null, selectedPartialMatch: null, locations: [],
                chosenAccountType: null, error: null, authMode: null,
                selectedPackaging: null
            };
            try {
                const rawState = localStorage.getItem(CATERING_STORAGE_KEY);
                console.log('%c[rehydrateState] Raw state from localStorage:', 'color: #add8e6', rawState);
                if (rawState) {
                    const parsed = JSON.parse(rawState);
                    console.log('%c[rehydrateState] Parsed state:', 'color: #add8e6', parsed);
                    const validEditingItem = (parsed.editingItem && typeof parsed.editingItem === 'object' && Array.isArray(parsed.editingItem.ModifierCategories)) ? parsed.editingItem : null;
                    const rehydratedContactInfo = { ...defaultState.contactInfo, ...((parsed.contactInfo && typeof parsed.contactInfo === 'object') ? parsed.contactInfo : {}) };
                    
                    const rehydratedAccountId = parsed.accountId || rehydratedContactInfo.accountId || rehydratedContactInfo['Account ID'] || null;
                    if (!parsed.accountId && rehydratedAccountId) {
                         console.log('%c[rehydrateState] Syncing accountId from nested key:', 'color: #90ee90', rehydratedAccountId);
                    }

                    const finalState = {
                        ...defaultState, ...parsed,
                        editingItem: validEditingItem,
                        accountId: rehydratedAccountId,
                        isVerified: parsed.isVerified || false, // Restore isVerified
                        fulfillmentDetails: { ...defaultState.fulfillmentDetails, ...(parsed.fulfillmentDetails || {}), address: { ...defaultState.fulfillmentDetails.address, ...(parsed.fulfillmentDetails?.address || {}) } },
                        contactInfo: rehydratedContactInfo,
                        cart: parsed.cart || defaultState.cart,
                        potentialAccounts: parsed.potentialAccounts || defaultState.potentialAccounts,
                        locations: parsed.locations || defaultState.locations,
                        formErrors: parsed.formErrors || defaultState.formErrors,
                        error: null, tempSelectedModifiers: null, sid: null, otpChannel: null,
                        chosenAccountType: null, authMode: null,
                        selectedAccountId: parsed.selectedAccountId || null,
                        selectedPartialMatch: parsed.selectedPartialMatch || null,
                        loginContactInfo: defaultState.loginContactInfo
                    };
                    console.log('%c[rehydrateState] Final state being assigned:', 'color: #90ee90', finalState);
                    return finalState;
                }
            } catch (e) { console.error("Failed to rehydrate state", e); }
            console.log('%c[rehydrateState] No state found or error, returning default.', 'color: #ffa07a');
            return { ...context, ...defaultState };
        }),
        assignInitialData: assign({
            menu: ({ event }) => event.output.menu,
            locations: ({ event }) => event.output.locations,
        }),
        refreshCartItems: assign({
            cart: ({ context }) => {
                const { cart, menu } = context;
                if (!cart || cart.length === 0 || !menu || Object.keys(menu).length === 0) return context.cart || [];
                try {
                    const allItemsById = Object.values(menu).flatMap(category => category.items || []).reduce((acc, item) => {
                        if(item && item['Item ID']) acc[item['Item ID']] = item;
                        return acc;
                    }, {});
                    return cart.map(cartItem => {
                        if (!cartItem?.item?.['Item ID']) { console.warn("Invalid cart item in refresh:", cartItem); return null; }
                        const freshItem = allItemsById[cartItem.item['Item ID']];
                        return freshItem ? { ...cartItem, item: freshItem } : null;
                    }).filter(Boolean);
                } catch (e) {
                    console.error("Error refreshing cart items:", e);
                    return context.cart || [];
                }
            }
        }),
        assignError: assign({ error: ({ event }) => event.data?.message || 'An unexpected error occurred.' }),
        selectCategory: assign({ selectedCategory: ({ event }) => event.category }),
        setEditingItem: assign({ editingItem: ({ event }) => event.item }),
        clearEditingItem: assign({ editingItem: null, tempSelectedModifiers: null }),
        assignTempModifiers: assign({
            tempSelectedModifiers: ({ event }) => event.selectedModifiers,
        }),
        addToCart: assign({
            cart: ({ context, event }) => {
                const { item, selectedModifiers, quantity = 1 } = event;
                if (!item || !item['Item ID']) { console.error("Invalid item added to cart:", item); return context.cart; }
                const modifierString = Object.entries(selectedModifiers || {}).filter(([, qty]) => qty > 0).map(([id, qty]) => `${id}:${qty}`).sort().join(',');
                const cartItemId = `${item['Item ID']}-${modifierString}`;
                const existingItemIndex = context.cart.findIndex(cartItem => cartItem.id === cartItemId);
                let updatedCart = [...context.cart];
                if (existingItemIndex > -1) {
                    updatedCart[existingItemIndex] = { ...updatedCart[existingItemIndex], quantity: (updatedCart[existingItemIndex].quantity || 0) + quantity };
                } else {
                    updatedCart.push({ id: cartItemId, item, selectedModifiers: selectedModifiers || {}, quantity });
                }
                return updatedCart;
            },
            editingItem: null, tempSelectedModifiers: null,
        }),
        updateCartQuantity: assign({
            cart: ({ context, event }) => context.cart.map(cartItem =>
                cartItem.id === event.cartItemId ? { ...cartItem, quantity: Math.max(1, (cartItem.quantity || 0) + event.change) } : cartItem
            )
        }),
        removeFromCart: assign({
            cart: ({ context, event }) => context.cart.filter(item => item.id !== event.cartItemId)
        }),
        assignContactInfo: assign({
            contactInfo: ({ context, event }) => ({ ...context.contactInfo, [event.field]: event.value }),
            formErrors: ({ context, event }) => { const newErrors = { ...context.formErrors }; delete newErrors[event.field]; return newErrors; }
        }),
        assignLoginContactInfo: assign({
            loginContactInfo: ({ context, event }) => ({
                ...context.loginContactInfo,
                email: event.email,
                mobileNumber: event.mobileNumber
            }),
            error: null
        }),
        setAuthSuccess: assign({
            isAuthenticated: true,
            accountId: ({ context, event }) => event.output?.[0]?.['Account ID'] || context.accountId,
            contactInfo: ({ context, event }) => {
                const serverData = event.output?.[0];
                console.log('%c[AuthFlow] Merging contact info (setAuthSuccess). Extracted Server data:', 'color: #22c55e', serverData);
                const merged = {
                    ...context.contactInfo,
                    firstName: serverData?.['First Name'] || context.contactInfo.firstName,
                    lastName: serverData?.['Last Name'] || context.contactInfo.lastName,
                    email: serverData?.['Email'] || context.contactInfo.email,
                    mobileNumber: serverData?.['Mobile Number'] || context.contactInfo.mobileNumber,
                    organizationName: serverData?.['Organization Name'] || context.contactInfo.organizationName,
                    accountType: serverData?.['Account Type'] || context.contactInfo.accountType,
                    accountId: serverData?.['Account ID'] || context.accountId,
                };
                delete merged['First Name']; delete merged['Last Name']; delete merged['Email'];
                delete merged['Mobile Number']; delete merged['Organization Name'];
                delete merged['Account Type']; delete merged['Account ID'];
                console.log('%c[AuthFlow] Merging contact info (setAuthSuccess). Result:', 'color: #22c55e', merged);
                return merged;
            }
        }),
        assignPotentialAccounts: assign({
             potentialAccounts: ({ event }) => event.output[0].partialMatch || event.output || [],
             selectedAccountId: null
        }),
        assignSingleAccount: assign({
            contactInfo: ({ event, context }) => {
                console.log('%c[AuthFlow] Merging contact info (assignSingleAccount). Form data (base):', 'color: #f59e0b', context.contactInfo);
                const serverData = event.output[0];
                console.log('%c[AuthFlow] Merging contact info (assignSingleAccount). Server data:', 'color: #f59e0b', serverData);
                const merged = {
                    ...context.contactInfo,
                    firstName: serverData?.['First Name'] || context.contactInfo.firstName,
                    lastName: serverData?.['Last Name'] || context.contactInfo.lastName,
                    email: serverData?.['Email'] || context.contactInfo.email,
                    mobileNumber: serverData?.['Mobile Number'] || context.contactInfo.mobileNumber,
                    organizationName: serverData?.['Organization Name'] || context.contactInfo.organizationName,
                    accountType: serverData?.['Account Type'] || context.contactInfo.accountType,
                    accountId: serverData?.['Account ID'] || context.contactInfo.accountId,
                };
                delete merged['First Name']; delete merged['Last Name']; delete merged['Email'];
                delete merged['Mobile Number']; delete merged['Organization Name'];
                delete merged['Account Type']; delete merged['Account ID'];
                console.log('%c[AuthFlow] Merging contact info (assignSingleAccount). Result:', 'color: #22c55e', merged);
                return merged;
            },
            accountId: ({ event }) => event.output[0]?.['Account ID'],
            potentialAccounts: []
        }),
        assignNewUser: assign({
            potentialAccounts: []
        }),
        assignSelectedAccount: assign({
            selectedAccountId: ({ event }) => event.accountId,
            loginContactInfo: ({ context, event }) => {
                const selected = context.potentialAccounts.find(acc => 
                    acc['Account ID'] === event.accountId
                );
                if (!selected || !selected['Account ID']) {
                    console.error('[assignSelectedAccount] No valid Account ID found for selected account');
                }
                return {
                    email: selected?.['Email'] || context.loginContactInfo.email,
                    mobileNumber: selected?.['Mobile Number'] || context.loginContactInfo.mobileNumber
                };
            }
        }),
        assignNewAccount: assign({
             isAuthenticated: true,
             isVerified: true, // User is verified after creating account
             accountId: ({ event }) => {
                 const account = event.output?.[0] || event.output;
                 return account?.['Account ID'];
             },
             contactInfo: ({ context, event }) => {
                 const account = event.output?.[0] || event.output;
                 return {
                    ...context.contactInfo,
                    firstName: account?.['First Name'] || context.contactInfo.firstName,
                    lastName: account?.['Last Name'] || context.contactInfo.lastName,
                    email: account?.['Email'] || context.contactInfo.email,
                    mobileNumber: account?.['Mobile Number'] || context.contactInfo.mobileNumber,
                    accountId: account?.['Account ID']
                };
            },
             potentialAccounts: [],
             selectedAccountId: null
        }),
        clearAuthData: assign({
            otpChannel: null, sid: null, potentialAccounts: [], selectedAccountId: null,
            selectedPartialMatch: null, error: null, chosenAccountType: null, authMode: null,
            loginContactInfo: { email: '', mobileNumber: '' }
        }),
        setFinalGuestFromSelection: assign({
             accountId: ({ context }) => context.selectedPartialMatch?.['Account ID'],
             contactInfo: ({ context }) => {
                 const selected = context.selectedPartialMatch;
                 console.log('%c[AuthFlow] Merging contact info (setFinalGuestFromSelection). Selected data:', 'color: #9333ea', selected);
                 const merged = {
                    ...context.contactInfo,
                    firstName: selected?.['First Name'] || context.contactInfo.firstName,
                    lastName: selected?.['Last Name'] || context.contactInfo.lastName,
                    email: selected?.['Email'] || context.contactInfo.email,
                    mobileNumber: selected?.['Mobile Number'] || context.contactInfo.mobileNumber,
                    organizationName: selected?.['Organization Name'] || context.contactInfo.organizationName,
                    accountType: selected?.['Account Type'] || context.contactInfo.accountType,
                    accountId: selected?.['Account ID'] || context.contactInfo.accountId,
                 };
                 delete merged['First Name']; delete merged['Last Name']; delete merged['Email'];
                 delete merged['Mobile Number']; delete merged['Organization Name'];
                 delete merged['Account Type']; delete merged['Account ID'];
                 console.log('%c[AuthFlow] Merging contact info (setFinalGuestFromSelection). Result:', 'color: #22c55e', merged);
                 return merged;
             }
         }),
        setFulfillmentType: assign({
            fulfillmentDetails: (({ context, event }) => ({ ...defaultFulfillment, type: event.fulfillmentType }))
        }),
        selectPickupLocation: assign({
            fulfillmentDetails: (({ context, event }) => ({ ...context.fulfillmentDetails, type: 'pickup', locationId: event.locationId, address: defaultFulfillment.address }))
        }),
        updateDeliveryAddress: assign({
            fulfillmentDetails: (({ context, event }) => ({ ...context.fulfillmentDetails, type: 'delivery', locationId: null, address: { ...context.fulfillmentDetails.address, [event.field]: event.value } }))
        }),
        assignMissingAccountType: assign({
            chosenAccountType: ({ event }) => {
                if (event.type === 'SELECT_RETAIL') return 'Retail';
                if (event.type === 'SELECT_NONPROFIT') return 'Non-Profit';
                if (event.type === 'SELECT_COMPANY_MISSING') return 'Company';
                return null;
            }
        }),
        setLastViewAccount: assign({ lastView: 'account' }),
        assignOrgAndAccountType: assign({
            contactInfo: ({ context, event }) => {
                const updatedInfo = {
                    ...context.contactInfo,
                    organizationName: event.accountType === 'Retail' ? '' : event.organizationName
                };
                console.log('%c[assignOrgAndAccountType Action] Merging Org/Type. Event data:', 'color: #dc2626;', { organizationName: event.organizationName, accountType: event.accountType });
                console.log('%c[assignOrgAndAccountType Action] Updated contactInfo:', 'color: #dc2626;', updatedInfo);
                return updatedInfo;
            },
            chosenAccountType: ({ event }) => event.accountType
        }),
        updateContactInfoWithOrgAndType: assign({
            contactInfo: ({ context, event }) => {
                const updatedInfo = {
                    ...context.contactInfo,
                    organizationName: context.contactInfo.organizationName,
                    accountType: context.chosenAccountType,
                    ...(event.output || {})
                };
                console.log('%c[updateContactInfoWithOrgAndType Action] Merging final Account Type. Chosen:', context.chosenAccountType);
                console.log('%c[updateContactInfoWithOrgAndType Action] Final contactInfo:', 'color: #16a085;', updatedInfo);
                return updatedInfo;
            },
            chosenAccountType: null
        }),
        setAuthModeGuest: assign({ authMode: 'guestCheckout' }),
        setAuthModeLogin: assign({ authMode: 'login' }),
    },
})
.createMachine({
    id: 'catering',
    context: {
        menu: {}, cart: [], selectedCategory: null, editingItem: null, error: null,
        lastView: 'browsing', tempSelectedModifiers: null, isAuthenticated: false,
        isVerified: false, // NEW: tracks OTP verification
        accountId: null,
        contactInfo: { email: '', mobileNumber: '', organizationName: '', firstName: '', lastName: '', accountType: null, accountId: null },
        loginContactInfo: { email: '', mobileNumber: '' },
        formErrors: {}, otpChannel: null, sid: null, potentialAccounts: [], selectedAccountId: null,
        selectedPartialMatch: null, locations: [], fulfillmentDetails: defaultFulfillment,
        chosenAccountType: null,
        authMode: null,
        cartDrawerOpen: false, // Controls cart drawer overlay
        packagingResetCounter: 0, // Increments when logo is clicked to reset packaging selection
        selectedPackaging: null, // Current packaging selection (Cookie Tray, Cake Jar Boxes, etc.)
    },
    initial: 'booting',
    on: {
        RESET: {
            target: '#catering.browsing.browsingCategories',
            actions: [
                assign({ 
                    selectedCategory: null, 
                    editingItem: null, 
                    lastView: 'browsing', 
                    isVerified: false,
                    isAuthenticated: false,
                    accountId: null,
                    contactInfo: {
                        email: '',
                        mobileNumber: '',
                        organizationName: '',
                        firstName: '',
                        lastName: '',
                        accountType: null,
                        accountId: null
                    },
                    loginContactInfo: {
                        email: '',
                        mobileNumber: '',
                        firstName: '',
                        lastName: ''
                    }
                }), 
                'persistState'
            ]
        },
        GO_TO_BROWSING: {
            target: '#catering.browsing.browsingCategories',
            actions: [assign(({ context }) => ({
                selectedCategory: null,
                editingItem: null,
                lastView: 'browsing',
                cartDrawerOpen: false,
                packagingResetCounter: context.packagingResetCounter + 1
            })), 'persistState']
        },
        // Cart drawer overlay - doesn't change state, just opens drawer
        OPEN_CART_DRAWER: {
            actions: assign({ cartDrawerOpen: true })
        },
        CLOSE_CART_DRAWER: {
            actions: assign({ cartDrawerOpen: false })
        },
        // Legacy VIEW_CART - now just opens the drawer
        VIEW_CART: {
            actions: assign({ cartDrawerOpen: true })
        },
        // Continue to date selection from cart drawer
        CONTINUE_TO_DATE: {
            target: '#catering.selectingDate',
            actions: [assign({ cartDrawerOpen: false }), 'persistState']
        },
        // Global fulfillment handlers (for cart drawer overlay)
        SET_FULFILLMENT_TYPE: { actions: ['setFulfillmentType', 'persistState'] },
        SELECT_PICKUP_LOCATION: { actions: ['selectPickupLocation', 'persistState'] },
        UPDATE_DELIVERY_ADDRESS: { actions: ['updateDeliveryAddress', 'persistState'] },
        SET_FULL_DELIVERY_ADDRESS: {
            actions: [
                assign({
                    fulfillmentDetails: ({ context, event }) => ({
                        ...context.fulfillmentDetails,
                        type: 'delivery',
                        locationId: null,
                        address: { ...defaultFulfillment.address, ...event.address }
                    })
                }),
                'persistState'
            ]
        },
        CLEAR_DELIVERY_ADDRESS: {
            actions: [
                assign({
                    fulfillmentDetails: ({ context }) => ({
                        ...context.fulfillmentDetails,
                        address: defaultFulfillment.address
                    })
                }),
                'persistState'
            ]
        },
        // Global packaging handler (for footer visibility in layout)
        SET_SELECTED_PACKAGING: {
            actions: [
                assign({ selectedPackaging: ({ event }) => {
                    console.log('[cateringMachine] SET_SELECTED_PACKAGING received:', event.packaging?.name);
                    return event.packaging;
                }}),
                'persistState'
            ]
        },
        TRIGGER_AUTH: {
            target: '#catering.guestCheckoutFlow',
            actions: ['clearEditingItem', 'setAuthModeGuest', 'persistState']
        },
        VIEW_DISCOUNTS_AUTH: {
            target: '#catering.loginFlow',
            actions: ['setAuthModeLogin', 'persistState']
        },
        VIEW_ACCOUNT: [
            {
                target: '#catering.viewingOrders',
                guard: ({ context }) => context.isVerified, // Changed to isVerified
                actions: ['setLastViewAccount', 'persistState']
            },
            {
                target: '#catering.loginFlow',
                actions: ['setAuthModeLogin', 'setLastViewAccount', 'persistState']
            }
        ],
        REQUEST_ORG_AND_TYPE: { 
            target: '#catering.guestCheckoutFlow.enteringOrgAndAccountType', 
            actions: ['persistState'] 
        }
    },
    states: {
        booting: {
            entry: 'rehydrateState',
            always: 'loadingMenu'
        },
        loadingMenu: {
            invoke: {
                src: 'fetchInitialData',
                onDone: { target: 'restoring', actions: ['assignInitialData', 'refreshCartItems', 'persistState'] },
                onError: { target: 'failure', actions: 'assignError' },
            },
        },
        restoring: {
             // Always start at categories - user can use cart button to access saved cart
             entry: () => console.log('[Restoring] Always starting at categories...'),
             always: [
                 {
                    target: '#catering.browsing.browsingCategories',
                    actions: [
                        assign({ selectedCategory: null, editingItem: null }),
                        () => console.log('[Restoring] -> Browsing Categories (Always start here)')
                    ]
                 }
            ]
        },
        browsing: {
            entry: assign({ lastView: 'browsing' }),
            initial: 'browsingCategories',
            states: {
                 browsingCategories: {
                    on: {
                        SELECT_CATEGORY: { target: 'browsingItems', actions: ['selectCategory', 'persistState'], guard: ({ event }) => !!event.category },
                        ADD_TO_CART: { actions: ['addToCart', 'persistState'] },
                        REMOVE_ITEM: { actions: ['removeFromCart', 'persistState'] },
                        UPDATE_QUANTITY: { actions: ['updateCartQuantity', 'persistState'] },
                    },
                },
                 browsingItems: {
                    on: {
                        GO_BACK: { target: 'browsingCategories', actions: [assign({ selectedCategory: null, editingItem: null }), 'persistState'] },
                        EDIT_ITEM: { target: 'editingItem', actions: ['setEditingItem', 'persistState'] },
                        VIEW_ITEM: { target: 'viewingItemDetails', actions: ['setEditingItem', 'persistState'] },
                        SELECT_CATEGORY: { target: 'browsingItems', actions: ['selectCategory', 'persistState'], guard: ({ event }) => !!event.category },
                    },
                },
                 viewingItemDetails: {
                    on: {
                        GO_BACK: { target: 'browsingItems', actions: ['clearEditingItem', 'persistState'] },
                        ADD_TO_CART: { target: 'browsingItems', actions: ['addToCart', 'clearEditingItem', 'persistState'] },
                        SELECT_CATEGORY: { target: 'browsingItems', actions: ['selectCategory', 'clearEditingItem', 'persistState'], guard: ({ event }) => !!event.category },
                    }
                },
                 editingItem: {
                    on: {
                        GO_BACK: { target: 'browsingItems', actions: ['clearEditingItem', 'persistState'] },
                        CONFIRM_MODIFIERS: { target: 'selectingQuantity', actions: 'assignTempModifiers' },
                        SELECT_CATEGORY: { target: 'browsingItems', actions: ['selectCategory', 'clearEditingItem', 'persistState'], guard: ({ event }) => !!event.category },
                    }
                },
                 selectingQuantity: {
                    on: {
                        GO_BACK: { target: 'editingItem', actions: assign({ tempSelectedModifiers: null }) },
                        ADD_TO_CART: { target: 'browsingItems', actions: ['addToCart', 'persistState'] },
                        SELECT_CATEGORY: { target: 'browsingItems', actions: ['selectCategory', assign({ tempSelectedModifiers: null, editingItem: null }), 'persistState'], guard: ({ event }) => !!event.category },
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
                 SET_FULL_DELIVERY_ADDRESS: { actions: [ assign({ fulfillmentDetails: ({ context, event }) => ({ ...context.fulfillmentDetails, type: 'delivery', locationId: null, address: { ...defaultFulfillment.address, ...event.address } }) }), 'persistState' ] },
                 CLEAR_DELIVERY_ADDRESS: { actions: [ assign({ fulfillmentDetails: ({ context }) => ({ ...context.fulfillmentDetails, address: defaultFulfillment.address }) }), 'persistState' ] },
                 CONTINUE_TO_DATE: 'selectingDate'
            }
        },
        selectingDate: {
            entry: [
                assign({ lastView: 'selectingDate' }),
                () => console.log('[Flow] Selecting Date'),
                // Reset date and time to force user to select date first
                assign({
                    fulfillmentDetails: ({ context }) => ({
                        ...context.fulfillmentDetails,
                        selectedDate: null,
                        selectedTime: null
                    })
                }),
                'persistState'
            ],
            on: {
                // Go back opens the cart drawer instead of going to viewingCart state
                GO_BACK: {
                    target: '#catering.browsing.browsingCategories',
                    actions: assign({ cartDrawerOpen: true })
                },
                SET_FULFILLMENT_DATE: {
                    actions: [
                        assign({
                            fulfillmentDetails: ({ context, event }) => ({
                                ...context.fulfillmentDetails,
                                selectedDate: event.date
                            })
                        }),
                        'persistState'
                    ]
                },
                SET_FULFILLMENT_TIME: {
                    actions: [
                        assign({
                            fulfillmentDetails: ({ context, event }) => ({
                                ...context.fulfillmentDetails,
                                selectedTime: event.time
                            })
                        }),
                        'persistState'
                    ]
                },
                TRIGGER_AUTH: 'guestCheckoutFlow'
            }
        },
        guestCheckoutFlow: {
            entry: ['clearAuthData', assign({ lastView: 'guestCheckout' }), 'persistState'],
             initial: 'enteringContactInfo',
             states: {
                 enteringContactInfo: {
                    entry: [
                        assign({ lastView: 'guestCheckout.enteringContactInfo' }),
                        'persistState',
                        () => console.log('%c[Guest Flow] State: enteringContactInfo', 'color: #8b5cf6')
                    ],
                    on: {
                        UPDATE_FIELD: { actions: 'assignContactInfo' },
                        SUBMIT_CONTACT: 'checkingAccountStatus',
                        GO_BACK: '#catering.selectingDate',
                    }
                 },
                 checkingAccountStatus: {
                    entry: () => console.log('%c[Guest Flow] State: checkingAccountStatus', 'color: #8b5cf6'),
                    invoke: {
                         src: 'checkAccountStatus', input: ({ context }) => context.contactInfo,
                         onDone: [
                            { target: 'savingCart', guard: ({ event }) => Array.isArray(event.output) && event.output.length === 1 && event.output[0]?.partialMatch, actions: ['assignPotentialAccounts', () => console.log('[Guest Flow] -> Partial match, saving cart')] },
                            { target: 'savingCart', guard: ({ event }) => Array.isArray(event.output) && event.output.length === 1 && event.output[0]?.['Account ID'], actions: ['assignSingleAccount', 'persistState', () => console.log('[Guest Flow] -> Single account found, saving cart')] },
                            { target: 'savingCart', actions: ['assignNewUser', () => console.log('[Guest Flow] -> No account, saving cart before creating')] }
                         ],
                         onError: { target: 'enteringContactInfo', actions: 'assignError' }
                    }
                 },
                 savingCart: {
                    entry: () => console.log('%c[Guest Flow] State: savingCart', 'color: #10b981'),
                    invoke: {
                        src: 'saveCart',
                        input: ({ context }) => {
                            // Calculate subtotal
                            const subtotal = context.cart.reduce((total, item) => {
                                const itemPrice = item.item?.['Item Price'] || 0;
                                const quantity = item.quantity || 0;
                                return total + (itemPrice * quantity);
                            }, 0);

                            // Prepare date/time fields
                            const selectedDate = context.fulfillmentDetails?.selectedDate;
                            const selectedTime = context.fulfillmentDetails?.selectedTime;
                            
                            // Extract just the date portion (YYYY-MM-DD) without time
                            let dateOnly = null;
                            if (selectedDate) {
                                const dateObj = new Date(selectedDate);
                                dateOnly = dateObj.toISOString().split('T')[0]; // "2024-11-15"
                            }
                            
                            // Create combined ISO dateTime if both date and time are selected
                            let combinedDateTime = null;
                            if (selectedDate && selectedTime) {
                                const dateObj = new Date(selectedDate);
                                const [hours, minutes] = selectedTime.split(':');
                                dateObj.setHours(parseInt(hours), parseInt(minutes), 0, 0);
                                combinedDateTime = dateObj.toISOString();
                            }

                            return {
                                accountId: context.accountId,
                                email: context.contactInfo.email,
                                mobileNumber: context.contactInfo.mobileNumber,
                                firstName: context.contactInfo.firstName,
                                lastName: context.contactInfo.lastName,
                                cart: context.cart,
                                fulfillmentDetails: context.fulfillmentDetails,
                                // Date/Time fields
                                fulfillmentDate: dateOnly, // Just date in YYYY-MM-DD format
                                fulfillmentTime: selectedTime, // Separate time (HH:mm)
                                fulfillmentDateTime: combinedDateTime, // Combined date+time (ISO string for Airtable)
                                subtotal: subtotal
                            };
                        },
                        onDone: [
                            { target: 'selectingAccount', guard: ({ context }) => context.potentialAccounts?.length > 0, actions: () => console.log('[Guest Flow] -> Cart saved, showing account selection') },
                            { target: 'decideNextStep', guard: ({ context }) => context.accountId, actions: () => console.log('[Guest Flow] -> Cart saved, account found') },
                            { target: 'creatingAccount', actions: () => console.log('[Guest Flow] -> Cart saved, creating account') }
                        ],
                        onError: {
                            target: 'enteringContactInfo',
                            actions: [
                                assign({ error: ({ event }) => `Failed to save cart: ${event.error?.message || 'Unknown error'}` }),
                                () => console.error('[Guest Flow] -> Cart save failed')
                            ]
                        }
                    }
                 },
                 creatingAccount: {
                     entry: () => console.log('%c[Guest Flow] State: creatingAccount', 'color: #a78bfa'),
                     invoke: {
                         id: 'createGuest', src: 'createAccount',
                         input: ({ context }) => context.contactInfo,
                         onDone: {
                             target: 'enteringOrgAndAccountType',
                             actions: ['assignNewAccount', 'persistState', () => console.log('[Guest Flow] -> Account created, need org/type...')]
                         },
                         onError: { target: 'enteringContactInfo', actions: 'assignError' }
                     }
                 },
                 enteringOrgAndAccountType: {
                    entry: () => console.log('%c[Guest Flow] State: enteringOrgAndAccountType', 'color: #0ea5e9; font-weight: bold;'),
                     on: {
                         SUBMIT_ORG_AND_TYPE: {
                             target: 'updatingOrgAndAccountType',
                             actions: ['assignOrgAndAccountType', () => console.log('%c[Guest Flow] SUBMIT_ORG_AND_TYPE received.', 'color: #0ea5e9;')]
                         },
                         BACK: [
                             { target: 'enteringContactInfo', guard: ({ context }) => !context.accountId, actions: 'clearAuthData' },
                             { target: 'selectingAccount', guard: ({ context }) => context.potentialAccounts.length > 0 },
                             { target: 'checkingAccountStatus' }
                         ]
                     }
                 },
                 updatingOrgAndAccountType: {
                    entry: () => console.log('%c[Guest Flow] State: updatingOrgAndAccountType', 'color: #0ea5e9; font-weight: bold;'),
                     invoke: {
                         id: 'updateOrgTypeWebhook', src: 'updateOrgAndAccountType',
                         input: ({ context }) => ({
                             accountId: context.accountId,
                             organizationName: context.contactInfo.organizationName,
                             accountType: context.chosenAccountType
                         }),
                         onDone: {
                             target: 'decideNextStep',
                             actions: ['updateContactInfoWithOrgAndType', 'persistState', () => console.log('%c[Guest Flow] Invoke Success', 'color: #10b981;')]
                         },
                         onError: {
                             target: 'enteringOrgAndAccountType',
                             actions: ['assignError', ({ event }) => console.error('[Guest Flow] Invoke Error:', event.data)]
                         }
                     }
                 },
                 selectingAccount: {
                    entry: () => console.log('%c[Guest Flow] State: selectingAccount', 'color: #8b5cf6'),
                    on: {
                        SELECT_PARTIAL_MATCH: { actions: assign({ selectedPartialMatch: ({ event }) => event.selection }) },
                        CONFIRM_PARTIAL_MATCH: [
                            {
                                target: 'creatingAccount',
                                guard: ({ context }) => !!context.selectedPartialMatch && context.selectedPartialMatch.isNew,
                                actions: [assign({ selectedPartialMatch: null }), () => console.log('[Guest Flow] -> Create new selected')]
                            },
                            {
                                target: 'decideNextStep',
                                guard: ({ context }) => !!context.selectedPartialMatch,
                                actions: ['setFinalGuestFromSelection', 'persistState', () => console.log('[Guest Flow] -> Existing partial match selected, NO AUTH')]
                            }
                        ],
                         BACK: { target: 'enteringContactInfo', actions: 'clearAuthData' }
                    }
                 },
                 decideNextStep: {
                     entry: () => console.log('%c[Guest Flow] State: decideNextStep', 'color: #2dd4bf;'),
                     always: [
                         {
                             target: 'enteringOrgAndAccountType',
                             guard: ({ context }) => !hasOrgAndType(context.contactInfo),
                             actions: [() => console.log('[Guest Flow] -> Redirect: Missing org/type.')]
                         },
                         {
                             target: '#catering.checkoutPlaceholder',
                             actions: [() => console.log('[Guest Flow] -> Redirect: All info OK, to checkout.'), 'persistState']
                         }
                     ]
                 },
             }
        },
        loginFlow: {
            entry: 'clearAuthData',
            initial: 'enteringLoginContactInfo',
            states: {
                enteringLoginContactInfo: {
                    entry: () => console.log('%c[Login Flow] State: enteringLoginContactInfo', 'color: #fb923c;'),
                    on: {
                        UPDATE_FIELD: { actions: assign({
                            loginContactInfo: ({ context, event }) => ({ 
                                ...context.loginContactInfo, 
                                [event.field]: event.value 
                            }),
                            formErrors: ({ context, event }) => { 
                                const newErrors = { ...context.formErrors }; 
                                delete newErrors[event.field]; 
                                return newErrors; 
                            }
                        })},
                        SUBMIT_LOGIN_CONTACT: {
                            target: 'checkingLoginAccountStatus',
                            actions: ['assignLoginContactInfo', () => console.log('[Login Flow] Contact submitted, checking account...')]
                        },
                        GO_BACK: { target: '#catering.browsing.history' }
                    }
                },
                
                checkingLoginAccountStatus: {
                    entry: () => console.log('%c[Login Flow] State: checkingLoginAccountStatus', 'color: #fb923c;'),
                    invoke: {
                        src: 'checkAccountStatus',
                        input: ({ context }) => ({
                            email: context.loginContactInfo.email,
                            mobileNumber: context.loginContactInfo.mobileNumber
                        }),
                        onDone: [
                            {
                                // Partial match - send OTP directly based on what they entered
                                target: 'awaitingAuthentication.sendingOtp',
                                guard: ({ event }) => Array.isArray(event.output) && event.output.length === 1 && event.output[0]?.partialMatch,
                                actions: [
                                    assign({ 
                                        potentialAccounts: ({ event }) => event.output[0].partialMatch,
                                        otpChannel: ({ context }) => context.loginContactInfo.email ? 'email' : 'sms'
                                    }),
                                    () => console.log('[Login Flow] Partial match found, sending OTP')
                                ]
                            },
                            {
                                // Exact match - determine OTP method and send
                                target: 'awaitingAuthentication.sendingOtp',
                                guard: ({ event }) => Array.isArray(event.output) && event.output.length === 1 && event.output[0]?.['Account ID'] && !event.output[0]?.partialMatch,
                                actions: [
                                    assign({ 
                                        potentialAccounts: ({ event }) => event.output,
                                        otpChannel: ({ context }) => context.loginContactInfo.email ? 'email' : 'sms'
                                    }),
                                    () => console.log('[Login Flow] Exact match found, sending OTP')
                                ]
                            },
                            {
                                // No match - create account
                                target: 'creatingAccount',
                                actions: () => console.log('[Login Flow] No match found, creating account')
                            }
                        ],
                        onError: { 
                            target: 'enteringLoginContactInfo', 
                            actions: 'assignError' 
                        }
                    }
                },
                
                creatingAccount: {
                    entry: () => console.log('%c[Login Flow] State: creatingAccount', 'color: #fb923c;'),
                    invoke: {
                        src: 'createAccount',
                        input: ({ context }) => context.loginContactInfo,
                        onDone: {
                            target: 'decideLoginRedirect',
                            actions: [
                                assign({ 
                                    isAuthenticated: true,
                                    isVerified: true, // User is verified after creating account
                                    accountId: ({ event }) => {
                                        const accountId = event.output?.[0]?.['Account ID'] || event.output?.['Account ID'];
                                        if (!accountId) {
                                            console.error('[Login Flow] Account created but no Account ID returned');
                                        }
                                        return accountId;
                                    },
                                    contactInfo: ({ context, event }) => {
                                        const account = event.output?.[0] || event.output;
                                        return {
                                            ...context.contactInfo,
                                            firstName: account?.['First Name'] || context.loginContactInfo.firstName,
                                            lastName: account?.['Last Name'] || context.loginContactInfo.lastName,
                                            email: account?.['Email'] || context.loginContactInfo.email,
                                            mobileNumber: account?.['Mobile Number'] || context.loginContactInfo.mobileNumber,
                                            accountId: account?.['Account ID']
                                        };
                                    },
                                    error: ({ event }) => {
                                        const account = event.output?.[0] || event.output;
                                        const accountId = account?.['Account ID'];
                                        return accountId ? null : 'Account created but no Account ID returned. Please contact support.';
                                    }
                                }),
                                'persistState',
                                () => console.log('[Login Flow] Account created successfully')
                            ]
                        },
                        onError: { 
                            target: 'enteringLoginContactInfo', 
                            actions: 'assignError' 
                        }
                    }
                },
                
                awaitingAuthentication: {
                    initial: 'choosingMethod',
                    states: {
                        choosingMethod: {
                            entry: () => console.log('%c[Login Flow] State: choosingMethod', 'color: #fb923c;'),
                            on: {
                                CHOOSE_EMAIL: {
                                    target: 'sendingOtp',
                                    actions: assign({ otpChannel: 'email' })
                                },
                                CHOOSE_SMS: {
                                    target: 'sendingOtp',
                                    actions: assign({ otpChannel: 'sms' })
                                },
                                BACK: { target: '#catering.loginFlow.enteringLoginContactInfo' }
                            }
                        },
                        
                        sendingOtp: {
                            entry: () => console.log('%c[Login Flow] State: sendingOtp', 'color: #fb923c;'),
                            invoke: {
                                src: 'sendOtp',
                                input: ({ context }) => ({
                                    identifier: context.otpChannel === 'email' 
                                        ? context.loginContactInfo.email 
                                        : context.loginContactInfo.mobileNumber,
                                    email: context.loginContactInfo.email,
                                    channel: context.otpChannel
                                }),
                                onDone: { 
                                    target: 'enteringOtp', 
                                    actions: assign({ sid: ({event}) => event.output.sid }) 
                                },
                                onError: { 
                                    target: 'choosingMethod', 
                                    actions: 'assignError' 
                                }
                            }
                        },
                        
                        enteringOtp: {
                            entry: () => console.log('%c[Login Flow] State: enteringOtp', 'color: #fb923c;'),
                            on: { 
                                SUBMIT_OTP: 'verifyingOtp',
                                BACK: 'choosingMethod'
                            }
                        },
                        
                        verifyingOtp: {
                            entry: () => console.log('%c[Login Flow] State: verifyingOtp', 'color: #fb923c;'),
                            invoke: {
                                src: 'authenticateAccount',
                                input: ({context, event}) => ({
                                    otp: event.otp,
                                    identifier: context.otpChannel === 'email' 
                                        ? context.loginContactInfo.email 
                                        : context.loginContactInfo.mobileNumber,
                                    email: context.loginContactInfo.email,
                                    channel: context.otpChannel,
                                    sid: context.sid
                                }),
                                onDone: [
                                    {
                                        // Multiple accounts - OTP verified, show selection using existing potentialAccounts
                                        target: '#catering.loginFlow.selectingLoginAccount',
                                        guard: ({ context }) => context.potentialAccounts && context.potentialAccounts.length > 1,
                                        actions: [
                                            assign({ 
                                                // DON'T overwrite potentialAccounts - keep the ones from checkAccountStatus
                                                isAuthenticated: true,
                                                isVerified: true
                                            }),
                                            'persistState',
                                            () => console.log('%c[Login Flow] ✅ OTP verified, multiple accounts, showing selection', 'color: #00ff00;')
                                        ]
                                    },
                                    {
                                        // Single account - OTP verified, use the account from potentialAccounts
                                        target: '#catering.loginFlow.decideLoginRedirect',
                                        guard: ({ context }) => context.potentialAccounts && context.potentialAccounts.length === 1,
                                        actions: [
                                            assign({ 
                                                isAuthenticated: true,
                                                isVerified: true,
                                                accountId: ({ context }) => {
                                                    const account = context.potentialAccounts[0];
                                                    console.log('[OTP Verification] Using account from potentialAccounts:', account);
                                                    const accountId = account['Account ID'];
                                                    console.log('[OTP Verification] Extracted Account ID:', accountId);
                                                    if (!accountId) {
                                                        console.error('[Login Flow] OTP verified but no Account ID in potentialAccounts. Full account:', account);
                                                    }
                                                    return accountId;
                                                },
                                                contactInfo: ({ context }) => {
                                                    const selected = context.potentialAccounts[0];
                                                    return {
                                                        ...context.contactInfo,
                                                        firstName: selected?.['First Name'] || context.loginContactInfo?.firstName || context.contactInfo.firstName,
                                                        lastName: selected?.['Last Name'] || context.loginContactInfo?.lastName || context.contactInfo.lastName,
                                                        email: selected?.['Email'] || context.loginContactInfo?.email || context.contactInfo.email,
                                                        mobileNumber: selected?.['Mobile Number'] || context.loginContactInfo?.mobileNumber || context.contactInfo.mobileNumber,
                                                        organizationName: selected?.['Organization Name'] || context.contactInfo.organizationName,
                                                        accountType: selected?.['Account Type'] || context.contactInfo.accountType,
                                                        accountId: selected?.['Account ID']
                                                    };
                                                },
                                                error: ({ context }) => {
                                                    const accountId = context.potentialAccounts[0]['Account ID'];
                                                    return accountId ? null : 'Login successful but no Account ID found. Please contact support.';
                                                }
                                            }),
                                            'persistState',
                                            () => console.log('%c[Login Flow] ✅ OTP verified, single account, logging in', 'color: #00ff00;')
                                        ]
                                    },
                                    {
                                        // Invalid OTP
                                        target: 'enteringOtp',
                                        actions: [
                                            assign({ error: 'Invalid code. Please try again.' })
                                        ]
                                    }
                                ],
                                onError: { 
                                    target: 'enteringOtp', 
                                    actions: ['assignError'] 
                                }
                            }
                        }
                    }
                },
                
                selectingLoginAccount: {
                    entry: () => console.log('%c[Login Flow] State: selectingLoginAccount', 'color: #fb923c;'),
                    on: {
                        SELECT_ACCOUNT: {
                            actions: assign({
                                selectedAccountId: ({ event }) => {
                                    console.log('[SELECT_ACCOUNT] Received accountId:', event.accountId);
                                    return event.accountId;
                                }
                            })
                        },
                        CONFIRM_LOGIN_ACCOUNT: {
                            target: 'decideLoginRedirect',
                            guard: ({ context }) => !!context.selectedAccountId,
                            actions: [
                                assign({
                                    accountId: ({ context }) => {
                                        console.log('[CONFIRM_LOGIN_ACCOUNT] selectedAccountId:', context.selectedAccountId);
                                        console.log('[CONFIRM_LOGIN_ACCOUNT] potentialAccounts:', context.potentialAccounts);
                                        
                                        const selected = context.potentialAccounts.find(
                                            acc => acc['Account ID'] === context.selectedAccountId
                                        );
                                        
                                        console.log('[CONFIRM_LOGIN_ACCOUNT] Found selected account:', selected);
                                        
                                        const accountId = selected?.['Account ID'];
                                        if (!accountId) {
                                            console.error('[Login Flow] Account selected but no Account ID found. Selected account data:', selected);
                                        }
                                        return accountId || context.selectedAccountId;
                                    },
                                    contactInfo: ({ context }) => {
                                        const selected = context.potentialAccounts.find(
                                            acc => acc['Account ID'] === context.selectedAccountId
                                        );
                                        return {
                                            ...context.contactInfo,
                                            firstName: selected?.['First Name'] || context.loginContactInfo?.firstName || context.contactInfo.firstName,
                                            lastName: selected?.['Last Name'] || context.loginContactInfo?.lastName || context.contactInfo.lastName,
                                            email: selected?.['Email'] || context.loginContactInfo?.email || context.contactInfo.email,
                                            mobileNumber: selected?.['Mobile Number'] || context.loginContactInfo?.mobileNumber || context.contactInfo.mobileNumber,
                                            organizationName: selected?.['Organization Name'] || context.contactInfo.organizationName,
                                            accountType: selected?.['Account Type'] || context.contactInfo.accountType,
                                            accountId: selected?.['Account ID']
                                        };
                                    },
                                    error: ({ context }) => {
                                        const selected = context.potentialAccounts.find(
                                            acc => acc['Account ID'] === context.selectedAccountId
                                        );
                                        const accountId = selected?.['Account ID'];
                                        return accountId ? null : 'Account selected but no Account ID found. Please contact support.';
                                    }
                                }),
                                'persistState',
                                () => console.log('[Login Flow] Account selected, logging in')
                            ]
                        },
                        BACK: 'enteringLoginContactInfo'
                    }
                },
                
                decideLoginRedirect: {
                    entry: () => console.log('%c[Login Flow] State: decideLoginRedirect', 'color: #2dd4bf;'),
                    always: [
                        {
                            target: '#catering.browsing.history',
                            guard: ({ context }) => context.lastView === 'browsing',
                            actions: [
                                () => console.log('[Login Flow] Redirecting to browsing history'), 
                                'persistState'
                            ]
                        },
                        {
                            target: '#catering.viewingOrders',
                            actions: [
                                () => console.log('[Login Flow] Redirecting to account details'), 
                                'setLastViewAccount', 
                                'persistState'
                            ]
                        }
                    ]
                }
            }
        },
        checkoutPlaceholder: {
            entry: [assign({ lastView: 'checkout' }), 'persistState', () => console.log('%c[Flow] Reached Checkout Placeholder', 'color: #16a34a')],
            on: {
                // Go back opens the cart drawer instead of going to viewingCart state
                GO_BACK: {
                    target: '#catering.browsing.browsingCategories',
                    actions: assign({ cartDrawerOpen: true })
                },
                GO_TO_DATE_SELECTION: 'selectingDate'
            }
        },
        viewingOrders: {
            entry: [assign({ lastView: 'account' }), () => console.log('%c[Flow] Viewing Orders', 'color: #16a34a')],
             on: { GO_BACK: '#catering.browsing.history' }
        },
        failure: { type: 'final' },
    },
});