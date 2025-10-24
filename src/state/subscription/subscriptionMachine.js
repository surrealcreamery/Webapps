import { setup, assign, fromPromise, createMachine } from 'xstate';
//import { normalizeData, parseQueryParams } from '../../utils/subscription';
import * as api from '@/constants/subscriptions';
import { WIZARD_STORAGE_KEY, AUTH_STORAGE_KEY } from '@/constants/subscriptions/subscriptionsConstants';

const emptyCustomerForm = { firstName: '', lastName: '', email: '', phone: '' };

export const parseQueryParams = () => {
    if (typeof window === 'undefined') return null;
    const params = new URLSearchParams(window.location.search);
    const utmParams = {};
    for (const [key, value] of params.entries()) {
        if (key.startsWith('utm_') || ['model_id', 'location_id', 'plan_id'].includes(key)) {
            utmParams[key] = value;
        }
    }
    return Object.keys(utmParams).length > 0 ? utmParams : null;
};

export function normalizeData(rawModels) {

    if (!rawModels || !Array.isArray(rawModels)) return { models: [], locations: [], plans: [] };
    const allModels = [], allLocations = new Map(), allPlans = [];
    rawModels.forEach(model => {
        allModels.push({ 
            id: model.id, 
            name: model['Friendly Name'],
            description: model['Description']
        });
        if (model.array) {
            model.array.forEach(plan => {
                const planLocations = plan['Location ID'] || [];
                allPlans.push({
                    id: plan['Plan ID'],
                    name: plan['Plan Name'],
                    price: plan.Price,
                    frequency: plan.Frequency,
                    modelId: model.id,
                    locationIds: planLocations,
                    description: plan.Description,
                    'Plan Type': plan['Plan Type'],
                });
                planLocations.forEach((locId, i) => {
                    if (!allLocations.has(locId)) {
                        allLocations.set(locId, { 
                            id: locId, 
                            name: (plan['Location Name'] || [])[i] || `Location ${locId}`,
                            address: (plan['Location Address'] || [])[i] || null,
                            coords: {
                                lat: (plan['Lattitude'] || [])[i],
                                lng: (plan['Longitude'] || [])[i]
                            }
                        });
                    }
                });
            });
        }
    });
    return { models: allModels, locations: Array.from(allLocations.values()), plans: allPlans };
}

// --- Persistence Logic ---
const persistState = ({ context }) => {
    try {
        const campaignStateToSave = {
            id: context.persistedCampaignState?.id,
            models: context.campaignModels,
            locations: context.campaignLocations,
            plan: context.campaignPlan,
        };
        const userSelectedStateToSave = {
            modelId: context.modelId,
            locationId: context.locationId,
            planId: context.planId,
            numberOfSubscriptions: context.numberOfSubscriptions,
            isGift: context.isGift,
            giftDetails: context.giftDetails,
            customerForms: context.customerForms,
            allEnteredForms: context.allEnteredForms,
            submittedCustomers: context.submittedCustomers,
            currentCustomerIndex: context.currentCustomerIndex,
            primaryCustomerId: context.primaryCustomerId,
            linkedCustomerIds: context.linkedCustomerIds,
            authRequired: context.authRequired,
            isReauthenticated: context.isReauthenticated,
            maskedPhone: context.maskedPhone,
            otpMethod: context.otpMethod,
            savedCards: context.savedCards,
            selectedSavedCardId: context.selectedSavedCardId,
            choseToEnterNewCard: context.choseToEnterNewCard,
            currentFlowType: context.currentFlowType,
            originalFlowType: context.originalFlowType,
            hasProceededToContact: context.hasProceededToContact,
            hasProceededToPayment: context.hasProceededToPayment,
            utmParams: context.utmParams,
            currentStep: context.currentStep,
            isComplete: context.isComplete,
        };
        const stateToSave = {
            campaignState: campaignStateToSave,
            userSelectedState: userSelectedStateToSave
        };
        localStorage.setItem(WIZARD_STORAGE_KEY, JSON.stringify(stateToSave));

    } catch (error) {
        console.error("Failed to save state to localStorage", error);
    }
};

const initialWizardContext = {
    campaignRaw: null, modelsRaw: null, normalizedData: { models: [], locations: [], plans: [] },
    campaignModels: [], campaignLocations: [], campaignPlan: null,
    persistedCampaignState: { id: null, models: [], locations: [], plan: null },
    persistedUserSelectedState: {},
    modelId: null, locationId: null, planId: null,
    numberOfSubscriptions: 1,
    isGift: false,
    giftDetails: {
        recipientName: '',
        recipientEmail: '',
        message: '',
    },
    customerForms: [emptyCustomerForm],
    allEnteredForms: [emptyCustomerForm],
    submittedCustomers: [],
    currentCustomerIndex: 0,
    isEditingContact: false,
    preEditCustomerIndex: null,
    primaryCustomerId: null,
    linkedCustomerIds: [],
    authRequired: false,
    isReauthenticated: false,
    maskedPhone: null,
    otpMethod: null,
    otpCode: '',
    savedCards: [],
    selectedSavedCardId: null,
    paymentNonce: null,
    idempotencyKey: null,
    choseToEnterNewCard: false,
    contextForBackNavigation: null,
    currentFlowType: 'initial',
    originalFlowType: 'initial',
    hasProceededToContact: false,
    hasProceededToPayment: false,
    userIsNavigatingBack: false,
    utmParams: null, error: null, isSubmitting: false,
    currentStep: null,
    isComplete: false,
};

export const wizardMachine = setup({
    actors: {
        fetchInitialData: fromPromise(async ({ input }) => {
            const campaignParams = input.utmParams || { "source": "no-utm-default" };
            const [campaignData, plansData, benefitsData] = await Promise.all([
                api.fetchCampaign(campaignParams),
                api.fetchPlans(),
                api.fetchBenefits()
            ]);
            return {
                campaignRaw: campaignData,
                modelsRaw: plansData,
                benefitsRaw: benefitsData,
                hasUrlParams: !!Object.keys(input.utmParams || {}).length
            };
        }),
        submitCustomer: fromPromise(async ({ input }) => {
            const { customer, index, role } = input;
            const response = await fetch(api.SUBSCRIBER_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...customer, role })
            });
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ message: 'Customer submission failed' }));
                throw new Error(errorData.message);
            }
            const result = await response.json();
            return { ...result, index };
        }),
        sendOtp: fromPromise(async ({ input }) => {
            const { to, channel } = input;
            const response = await fetch(api.OTP_VERIFY_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'send', to, channel })
            });
            const result = await response.json();
            if (!response.ok || result.success === false) {
                throw new Error(result.message || `Failed to send OTP via ${channel}`);
            }
            return result;
        }),
        verifyOtp: fromPromise(async ({ input }) => {
            const { to, channel, code } = input;
            const response = await fetch(api.OTP_VERIFY_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'check', to, code, channel })
            });
            const result = await response.json();
            if (!response.ok || result.success !== 'approved') {
                throw new Error(result.message || 'Invalid verification code.');
            }
            return result;
        }),
        fetchCustomerInfo: fromPromise(async ({ input }) => {
            const { email, phone } = input;
            const response = await fetch(api.SUBSCRIBER_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, phone })
            });
            if (!response.ok) {
                throw new Error("Could not find a customer with that contact info.");
            }
            const result = await response.json();
            if (!result || (!result.id && !result.CID)) {
                throw new Error("No account associated with this contact was found.");
            }
            return result;
        }),
        fetchCustomerProfile: fromPromise(async ({ input }) => {
            const response = await fetch(api.SUBSCRIBER_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ CID: input.CID })
            });
            if (!response.ok) {
                throw new Error('Could not retrieve customer profile.');
            }
            const data = await response.json();
            const profile = data[0] || null;
            if (!profile || !profile.id) {
                throw new Error(`No valid customer profile found for CID: ${input.CID}`);
            }
            return profile;
        }),
        fetchSavedCards: fromPromise(async ({ input }) => {
            const response = await fetch(api.RETRIEVE_CUSTOMER_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ CID: input.primaryCustomerId })
            });
            if (!response.ok) {
                throw new Error('Could not retrieve saved cards.');
            }
            const data = await response.json();
            return data[0]?.cards || [];
        }),
        processSavedCardPayment: fromPromise(async ({ input }) => {
            const { primaryCustomerId, cardId, planId, modelId, locationId, idempotencyKey, linkedCustomerIds } = input;
            const response = await fetch(api.SUBSCRIPTION_CHARGE_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', },
                body: JSON.stringify({
                    customerId: primaryCustomerId,
                    cardId,
                    planId,
                    modelId,
                    locationId,
                    idempotencyKey,
                    ...(linkedCustomerIds && linkedCustomerIds.length > 0 && { linkedCustomerId: linkedCustomerIds })
                })
            });
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || 'Saved card payment failed.');
            }
            const result = await response.json();
            return { success: true, paymentId: result.paymentId };
        }),
        saveNewCard: fromPromise(async ({ input }) => {
            console.log(
                '%c[LOG] saveNewCard actor received this data:',
                'color: #9333ea; font-weight: bold;',
                { ...input, paymentNonce: 'REDACTED' }
            );
            const { paymentNonce, idempotencyKey, primaryCustomerId, planId, linkedCustomerIds } = input;
            const response = await fetch(api.SAVE_CARD_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey, },
                body: JSON.stringify({
                    nonce: paymentNonce,
                    customerId: primaryCustomerId,
                    planId: planId,
                    idempotency_key: idempotencyKey,
                    ...(linkedCustomerIds && linkedCustomerIds.length > 0 && { linkedCustomerId: linkedCustomerIds })
                })
            });
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || 'New card payment failed.');
            }
            const result = await response.json();
            return result;
        }),
    },
    actions: {
        persistState,
        assignUserAuthentication: assign(({ context, event }) => {
            const { customerId } = event;
            try {
                if (customerId) {
                    const authSession = { isAuthenticated: true, customerId: customerId };
                    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authSession));
                }
            } catch (error) {
                console.error("Failed to save auth session to localStorage", error);
            }
            return {
                ...context,
                isReauthenticated: true,
                primaryCustomerId: customerId,
            };
        }),
        setAuthSession: ({ context }) => {
            try {
                if (context.primaryCustomerId) {
                    const authSession = {
                        isAuthenticated: true,
                        customerId: context.primaryCustomerId,
                    };
                    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authSession));
                }
            } catch (error) {
                console.error("Failed to save auth session to localStorage", error);
            }
        },
        clearAuthSession: () => {
            try {
                localStorage.removeItem(AUTH_STORAGE_KEY);
            } catch (error) {
                console.error("Failed to clear auth session from localStorage", error);
            }
        },
        assignFetchedData: assign(({ context, event }) => {
            const { campaignRaw, modelsRaw, benefitsRaw, hasUrlParams } = event.output;
            
            // --- LOG 1: See the raw data coming from the API calls ---
            console.log('%c[assignFetchedData] Received raw data:', 'color: blue; font-weight: bold;', { modelsRaw, benefitsRaw });

            const normalizedDataResult = normalizeData(modelsRaw);

            console.log('--- WIZARD MACHINE: NORMALIZED DATA ---', normalizedDataResult);
            
            // --- LOG 2: See the plans *after* normalization ---
            console.log('%c[assignFetchedData] After normalizeData:', 'color: blue; font-weight: bold;', normalizedDataResult);

            const benefitsByPlanId = (benefitsRaw || []).reduce((acc, benefit) => {
                const planIds = benefit['Linked: Plan ID in Plans'];
                const benefitName = benefit['Benefit Name'];
                const status = benefit['Status'];

                if (benefitName && status?.includes('Active') && Array.isArray(planIds)) {
                    planIds.forEach(planId => {
                        if (!acc[planId]) { acc[planId] = []; }
                        acc[planId].push(benefitName);
                    });
                }
                return acc;
            }, {});

            // --- LOG 3: See the generated benefits map ---
            console.log('%c[assignFetchedData] Built benefits lookup map:', 'color: blue; font-weight: bold;', benefitsByPlanId);
            
            const plansWithBenefits = normalizedDataResult.plans.map(plan => ({
                ...plan,
                benefits: benefitsByPlanId[plan.id] || [],
            }));

            // --- LOG 4: See the final result of the merge ---
            console.log('%c[assignFetchedData] Final plans with benefits:', 'color: green; font-weight: bold;', plansWithBenefits);

            const finalNormalizedData = {
                ...normalizedDataResult,
                plans: plansWithBenefits,
            };

            const currentCampaign = {
                id: campaignRaw?.['Campaign ID'] || null,
                models: campaignRaw?.['Pricing Model IDs'] || [],
                locations: campaignRaw?.['Location IDs'] || [],
                plan: (campaignRaw?.['Plan IDs'] || [])[0] || null,
            };
            const persistedCampaignBeforeUpdate = context.persistedCampaignState;
            const areCampaignsEqual = (a, b) => {
                if (!a || !b) return false;
                if (b.id === null) return true;
                const idsAreEqual = a.id === b.id;
                const stringifyForCompare = (campaign) => {
                    if (!campaign) return null;
                    const sorted = {
                        models: [...(campaign.models || [])].sort(),
                        locations: [...(campaign.locations || [])].sort(),
                        plan: campaign.plan || null
                    };
                    return JSON.stringify(sorted);
                };
                const contentIsEqual = stringifyForCompare(a) === stringifyForCompare(b);
                return idsAreEqual && contentIsEqual;
            };
            const isEqual = areCampaignsEqual(currentCampaign, persistedCampaignBeforeUpdate);
            let selectionsToApply = {};
            let flowTypeFromUrl = 'noUtmDefault';
            const utmOverrides = {};
            if (hasUrlParams) {
                if (currentCampaign.plan) flowTypeFromUrl = 'explicitUtmPlan';
                else if (currentCampaign.models.length > 0 && currentCampaign.locations.length > 0) flowTypeFromUrl = 'explicitUtmModelAndLoc';
                else if (currentCampaign.locations.length > 0) flowTypeFromUrl = 'explicitUtmLocOnly';
                else if (currentCampaign.models.length > 0) flowTypeFromUrl = 'explicitUtmModelOnly';
            }
            utmOverrides.originalFlowType = flowTypeFromUrl;
            if (isEqual) {
                selectionsToApply = context.persistedUserSelectedState;
            } else {
                selectionsToApply = {
                    modelId: null, locationId: null, planId: null,
                    numberOfSubscriptions: 1, isGift: false,
                    giftDetails: { recipientName: '', recipientEmail: '', message: '' },
                    customerForms: [emptyCustomerForm], allEnteredForms: [emptyCustomerForm],
                    submittedCustomers: [], currentCustomerIndex: 0, linkedCustomerIds: [],
                    maskedPhone: null, otpMethod: null, otpCode: '', savedCards: [], selectedSavedCardId: null,
                    paymentNonce: null, idempotencyKey: null, choseToEnterNewCard: false,
                    hasProceededToContact: false, hasProceededToPayment: false,
                    userIsNavigatingBack: false, currentStep: null,
                };
            }
            const finalCurrentFlowType = selectionsToApply.currentFlowType || flowTypeFromUrl;
            const finalOriginalFlowType = selectionsToApply.originalFlowType || flowTypeFromUrl;
            const baseState = {
                ...context,
                campaignRaw,
                modelsRaw,
                normalizedData: finalNormalizedData,
                campaignModels: currentCampaign.models,
                campaignLocations: currentCampaign.locations,
                campaignPlan: currentCampaign.plan,
                persistedCampaignState: currentCampaign,
            };
            const finalState = {
                ...baseState,
                ...selectionsToApply,
                ...utmOverrides,
                currentFlowType: finalCurrentFlowType,
                originalFlowType: finalOriginalFlowType,
            };
            persistState({ context: finalState });
            return finalState;
        }),
        assignPrefilledContactInfo: assign({
            customerForms: ({ context, event }) => {
                const profile = event.output;
                if (!profile) {
                    return context.customerForms;
                }
                const prefilledForm = {
                    firstName: profile.given_name || '',
                    lastName: profile.family_name || '',
                    email: profile.email_address || '',
                    phone: profile.phone_number || ''
                };
                const newForms = [...context.customerForms];
                if (newForms.length > 0) {
                    newForms[0] = { ...newForms[0], ...prefilledForm };
                } else {
                    newForms.push(prefilledForm);
                }
                return newForms;
            }
        }),
        assignAuthenticatedUserAsSubmitted: assign(({ context, event }) => {
            const profile = event.output;
            if (!profile || !context.primaryCustomerId) {
                return {};
            }
            const updatedSubmittedCustomers = [...context.submittedCustomers];
            const isAuthenticatedUserAlreadySubmitted = updatedSubmittedCustomers.some(c => c.index === 0);
            if (!isAuthenticatedUserAlreadySubmitted) {
                updatedSubmittedCustomers.push({
                    CID: context.primaryCustomerId,
                    index: 0,
                });
            }
            return {
                submittedCustomers: updatedSubmittedCustomers.sort((a, b) => a.index - b.index)
            };
        }),
        setQuantity: assign({
            numberOfSubscriptions: ({ event }) => event.value,
            customerForms: ({ context, event }) => {
                const newSize = context.isGift ? event.value + 1 : event.value;
                const currentSize = context.customerForms.length;

                if (newSize > currentSize) {
                    const newForms = [];
                    for (let i = currentSize; i < newSize; i++) {
                        const cachedForm = context.allEnteredForms[i];
                        newForms.push(cachedForm || emptyCustomerForm);
                    }
                    return [...context.customerForms, ...newForms];
                }

                if (newSize < currentSize) {
                    return context.customerForms.slice(0, newSize);
                }

                return context.customerForms;
            },
            submittedCustomers: ({ context, event }) => {
                const newSize = context.isGift ? event.value + 1 : event.value;
                return context.submittedCustomers.filter(customer => customer.index < newSize);
            },
            linkedCustomerIds: ({ context, event }) => {
                const newSize = context.isGift ? event.value + 1 : event.value;
                const updatedSubmittedCustomers = context.submittedCustomers.filter(customer => customer.index < newSize);

                if (context.isGift) {
                    return updatedSubmittedCustomers
                        .filter(c => c.index > 0)
                        .map(c => c.CID || c.id);
                } else {
                    return updatedSubmittedCustomers
                        .map(c => c.CID || c.id);
                }
            },
            currentCustomerIndex: ({ context, event }) => {
                const newSize = context.isGift ? event.value + 1 : event.value;
                const currentSubmittedCount = context.submittedCustomers.filter(c => c.index < newSize).length;
                return currentSubmittedCount;
            }
        }),
        toggleIsGift: assign(({ context }) => {
            const isBecomingGift = !context.isGift;
            let newNumberOfSubscriptions;

            if (isBecomingGift) {
                newNumberOfSubscriptions = Math.max(1, context.numberOfSubscriptions - 1);
            } else {
                newNumberOfSubscriptions = context.numberOfSubscriptions + 1;
            }

            const newTotalForms = isBecomingGift ? newNumberOfSubscriptions + 1 : newNumberOfSubscriptions;

            const newCustomerForms = context.customerForms.slice(0, newTotalForms);
            const newSubmittedCustomers = context.submittedCustomers.filter(c => c.index < newTotalForms);

            while (newCustomerForms.length < newTotalForms) {
                newCustomerForms.push(emptyCustomerForm);
            }

            let newLinkedIds = [];
            if (isBecomingGift) {
                newLinkedIds = newSubmittedCustomers
                    .filter(c => c.index > 0)
                    .map(c => c.CID || c.id);
            } else {
                newLinkedIds = newSubmittedCustomers
                    .map(c => c.CID || c.id);
            }

            return {
                isGift: isBecomingGift,
                numberOfSubscriptions: newNumberOfSubscriptions,
                customerForms: newCustomerForms,
                submittedCustomers: newSubmittedCustomers,
                linkedCustomerIds: newLinkedIds
            };
        }),
        updateGiftDetailsField: assign({
            giftDetails: ({ context, event }) => ({
                ...context.giftDetails,
                [event.field]: event.value,
            }),
        }),
        updateCustomerFormField: assign({
            customerForms: ({ context, event }) => {
                const newForms = [...context.customerForms];
                newForms[event.index] = { ...newForms[event.index], [event.field]: event.value };
                return newForms;
            },
            allEnteredForms: ({ context, event }) => {
                const newAllForms = [...context.allEnteredForms];
                newAllForms[event.index] = { ...newAllForms[event.index], [event.field]: event.value };
                return newAllForms;
            }
        }),
        assignModel: assign({ modelId: ({ event }) => event.value, planId: null }),
        assignLocation: assign({ locationId: ({ event }) => event.value, planId: null }),
        assignPlan: assign({ planId: ({ event }) => event.value }),
        setSubmitting: assign({ isSubmitting: true }),
        clearSubmitting: assign({ isSubmitting: false }),
        assignError: assign({ error: ({ event }) => event.data?.message || 'An unknown error occurred.' }),
        setOtpEmail: assign({ otpMethod: 'email' }),
        setOtpSms: assign({ otpMethod: 'sms' }),
        assignOtpCode: assign({ otpCode: ({ event }) => event.code }),
        clearError: assign({ error: null }),
        assignSavedCards: assign({ savedCards: ({ event }) => event.output, selectedSavedCardId: ({ event }) => (event.output.length > 0 ? event.output[0].id : null) }),
        assignSelectedCard: assign({ selectedSavedCardId: ({ event }) => event.cardId }),
        assignNonce: assign({ paymentNonce: ({ event }) => event.nonce }),
        assignPaymentId: assign({ paymentId: ({ event }) => event.output.paymentId }),
        generateIdempotencyKey: assign({ idempotencyKey: () => crypto.randomUUID() }),
        setChoseToEnterNewCard: assign({ choseToEnterNewCard: true }),
        clearChoseToEnterNewCard: assign({ choseToEnterNewCard: false }),
    },
}).createMachine({
    id: 'wizard',
    context: initialWizardContext,
    initial: 'booting',
    on: {
        LOGIN_SUCCESS: {
            target: '.displayFlow.restoring',
            actions: 'assignUserAuthentication',
            guard: ({ event }) => !!event.customerId
        },
        LOGOUT: {
            target: '.fetchingData',
            actions: [
                assign({ ...initialWizardContext }),
                'clearAuthSession',
            ]
        },
        RESET_FLOW: {
            target: '.displayFlow.planSelectionWorkflow',
            actions: [
                assign(({ context }) => {
                    const flowResetState = {
                        modelId: null,
                        locationId: null,
                        planId: null,
                        hasProceededToContact: false,
                        hasProceededToPayment: false,
                        currentFlowType: context.originalFlowType,
                        currentStep: null,
                        otpMethod: null,
                        isComplete: false,
                    };

                    if (context.isReauthenticated) {
                        return { ...context, ...flowResetState };
                    } else {
                        return {
                            ...initialWizardContext,
                            ...flowResetState,
                            utmParams: context.utmParams,
                            persistedCampaignState: context.persistedCampaignState,
                            originalFlowType: context.originalFlowType,
                            normalizedData: context.normalizedData
                        };
                    }
                }),
                'persistState'
            ]
        },
        CHANGE_MODEL: {
            target: '.displayFlow.planSelectionWorkflow',
            actions: [
                assign({
                    contextForBackNavigation: ({ context }) => ({
                        modelId: context.modelId,
                        planId: context.planId,
                    }),
                    modelId: null,
                    planId: null,
                    currentFlowType: 'changeModel'
                }),
                'persistState'
            ]
        },
        CHANGE_LOCATION: {
            target: '.displayFlow.planSelectionWorkflow',
            actions: [
                assign({
                    contextForBackNavigation: ({ context }) => ({
                        locationId: context.locationId,
                        planId: context.planId,
                    }),
                    locationId: null,
                    planId: null,
                    currentFlowType: 'changeLocation'
                }),
                'persistState'
            ]
        },
        CHANGE_PLAN_ONLY: {
            target: '.displayFlow.dedicatedPlanSelection',
            actions: [
                assign({ planId: null, currentFlowType: 'changePlanOnly' }),
                'persistState'
            ]
        },
        PERSIST_STATE: {
            actions: 'persistState'
        }
    },
    states: {
        booting: {
            entry: assign((context) => {
                const utmParams = parseQueryParams();
                let authData = { isReauthenticated: false, primaryCustomerId: null };
                try {
                    const authSessionRaw = localStorage.getItem(AUTH_STORAGE_KEY);
                    if (authSessionRaw) {
                        const authSession = JSON.parse(authSessionRaw);
                        if (authSession.isAuthenticated && authSession.customerId) {
                            authData = {
                                isReauthenticated: true,
                                primaryCustomerId: authSession.customerId
                            };
                        }
                    }
                } catch (e) {
                    console.error('Failed to parse unified auth session.', e);
                }
                let rehydratedState = {};
                try {
                    const rawState = localStorage.getItem(WIZARD_STORAGE_KEY);
                    if (rawState) {
                        const parsed = JSON.parse(rawState);
                        rehydratedState = {
                            persistedCampaignState: parsed.campaignState,
                            persistedUserSelectedState: parsed.userSelectedState,
                        };
                    }
                } catch (e) {
                    console.error('[BOOTING] Failed to parse persisted state. Clearing storage.', e);
                    localStorage.removeItem(WIZARD_STORAGE_KEY);
                    rehydratedState = {};
                }
                return {
                    ...context,
                    persistedCampaignState: rehydratedState.persistedCampaignState || context.persistedCampaignState,
                    persistedUserSelectedState: rehydratedState.persistedUserSelectedState || context.persistedUserSelectedState,
                    ...authData,
                    utmParams
                };
            }),
            always: 'fetchingData',
        },
        fetchingData: {
            invoke: {
                src: 'fetchInitialData',
                input: ({ context }) => ({ utmParams: context.utmParams }),
                onDone: { target: 'displayFlow', actions: 'assignFetchedData' },
                onError: { target: 'failure', actions: 'assignError' },
            },
        },
        displayFlow: {
            initial: 'checkingAuthForPrefill',
            states: {
                checkingAuthForPrefill: {
                    always: [
                        {
                            target: 'prefillingOnBoot',
                            guard: ({ context }) => context.isReauthenticated && (!context.customerForms[0] || !context.customerForms[0].firstName),
                        },
                        {
                            target: 'restoring'
                        }
                    ]
                },
                prefillingOnBoot: {
                    invoke: {
                        src: 'fetchCustomerProfile',
                        input: ({ context }) => ({ CID: context.primaryCustomerId }),
                        onDone: {
                            target: 'restoring',
                            actions: [
                                'assignPrefilledContactInfo',
                                'assignAuthenticatedUserAsSubmitted',
                                'persistState'
                            ]
                        },
                        onError: {
                            target: 'restoring',
                            actions: [
                                assign({ error: 'Could not pre-fill contact information.' }),
                                'persistState'
                            ]
                        }
                    }
                },
                restoring: {
                    always: [
                        { target: 'summary', guard: ({ context }) => context.isComplete },
                        { target: '#wizard.displayFlow.authenticationOrPayment.payment.enterNewCard', guard: ({ context }) => context.currentStep === 'newCardEntry' },
                        { target: '#wizard.displayFlow.authenticationOrPayment.payment.confirmSavedCard', guard: ({ context }) => context.currentStep === 'selectCard' },
                        { target: '#wizard.displayFlow.authenticationOrPayment.authentication.enterCode', guard: ({ context }) => context.currentStep === 'otpEntry' },
                        { target: '#wizard.displayFlow.authenticationOrPayment.authentication.chooseMethod', guard: ({ context }) => context.currentStep === 'otpMethodChoice' },
                        { target: 'contactInfo', guard: ({ context }) => context.currentStep === 'contactInfo' },
                        { target: 'planSummary', guard: ({ context }) => context.currentStep === 'planSummary' },
                        { target: 'dedicatedPlanSelection', guard: ({ context }) => context.currentStep === 'planSelection' },
                        { target: '#wizard.displayFlow.planSelectionWorkflow.noUtmDefault.locationSelection', guard: ({ context }) => context.currentStep === 'locationSelection' },
                        { target: '#wizard.displayFlow.planSelectionWorkflow.noUtmDefault.modelSelection', guard: ({ context }) => context.currentStep === 'modelSelection' },
                        { target: 'authenticationOrPayment', guard: ({ context }) => context.hasProceededToPayment },
                        { target: 'contactInfo', guard: ({ context }) => context.hasProceededToContact },
                        { target: 'planSummary', guard: ({ context }) => !!context.planId },
                        { target: 'planSelectionWorkflow' }
                    ]
                },
                planSelectionWorkflow: {
                    on: {
                        RESET_MODEL: { target: '.routing', actions: [assign({ modelId: null }), 'persistState'] },
                        BACK_TO_SUMMARY: {
                            target: 'planSummary',
                            actions: [assign(({ context }) => ({
                                modelId: context.contextForBackNavigation.modelId,
                                planId: context.contextForBackNavigation.planId,
                                currentFlowType: context.originalFlowType,
                                contextForBackNavigation: null
                            })), 'persistState']
                        }
                    },
                    initial: 'routing',
                    states: {
                        routing: {
                            always: [
                                { target: '#wizard.displayFlow.explicitUtmPlan', guard: ({ context }) => context.currentFlowType === 'explicitUtmPlan' },
                                { target: '#wizard.displayFlow.dedicatedPlanSelection', guard: ({ context }) => context.currentFlowType === 'explicitUtmModelAndLoc' },
                                { target: 'explicitUtmModelOnly', guard: ({ context }) => context.currentFlowType === 'explicitUtmModelOnly' },
                                { target: 'explicitUtmLocOnly', guard: ({ context }) => context.currentFlowType === 'explicitUtmLocOnly' },
                                { target: 'noUtmDefault' },
                            ],
                        },
                        noUtmDefault: {
                            initial: 'restoring',
                            states: {
                                restoring: {
                                    always: [
                                        { target: 'locationSelection', guard: ({ context }) => !!context.modelId },
                                        { target: 'modelSelection' }
                                    ]
                                },
                                modelSelection: {
                                    tags: 'showsModelSelection',
                                    entry: [assign({ currentStep: 'modelSelection' }), 'persistState'],
                                    on: {
                                        SELECT_MODEL: [
                                            {
                                                target: '#wizard.displayFlow.dedicatedPlanSelection',
                                                guard: ({ context }) => context.currentFlowType === 'changeModel',
                                                actions: ['assignModel', 'persistState']
                                            },
                                            {
                                                target: 'locationSelection',
                                                actions: ['assignModel', 'persistState']
                                            }
                                        ]
                                    }
                                },
                                locationSelection: {
                                    tags: 'showsLocationSelection',
                                    entry: [assign({ currentStep: 'locationSelection' }), 'persistState'],
                                    on: {
                                        SELECT_LOCATION: {
                                            target: '#wizard.displayFlow.dedicatedPlanSelection',
                                            actions: ['assignLocation', 'persistState']
                                        },
                                        BACK: [
                                            {
                                                target: '#wizard.displayFlow.planSummary',
                                                guard: ({ context }) => context.currentFlowType === 'changeLocation',
                                                actions: [assign(({ context }) => ({
                                                    locationId: context.contextForBackNavigation.locationId,
                                                    planId: context.contextForBackNavigation.planId,
                                                    currentFlowType: context.originalFlowType,
                                                    contextForBackNavigation: null
                                                })), 'persistState']
                                            },
                                            {
                                                target: 'modelSelection',
                                                actions: [assign({ modelId: null }), 'persistState']
                                            }
                                        ]
                                    }
                                }
                            }
                        },
                        explicitUtmModelOnly: {
                            initial: 'locationSelection',
                            states: {
                                locationSelection: {
                                    tags: 'showsLocationSelection',
                                    entry: [assign({ currentStep: 'locationSelection' }), 'persistState'],
                                    on: { SELECT_LOCATION: { target: '#wizard.displayFlow.dedicatedPlanSelection', actions: ['assignLocation', 'persistState'] } }
                                },
                            }
                        },
                        explicitUtmLocOnly: {
                            initial: 'modelSelection',
                            states: {
                                modelSelection: {
                                    tags: 'showsModelSelection',
                                    entry: [assign({ currentStep: 'modelSelection' }), 'persistState'],
                                    on: {
                                        SELECT_MODEL: [
                                            {
                                                target: '#wizard.displayFlow.dedicatedPlanSelection',
                                                guard: ({ context }) => context.currentFlowType === 'changeModel',
                                                actions: ['assignModel', 'persistState']
                                            },
                                            {
                                                target: '#wizard.displayFlow.dedicatedPlanSelection',
                                                actions: ['assignModel', 'persistState']
                                            }
                                        ]
                                    }
                                }
                            }
                        },
                    }
                },
                dedicatedPlanSelection: {
                    tags: 'showsPlanSelection',
                    entry: [assign({ currentStep: 'planSelection' }), 'persistState'],
                    on: {
                        SELECT_PLAN: {
                            target: 'planSummary',
                            actions: [assign(({ context, event }) => {
                                return {
                                    planId: event.value,
                                    currentFlowType: context.originalFlowType
                                };
                            }), 'persistState']
                        },
                        BACK: [
                            {
                                target: '#wizard.displayFlow.planSummary',
                                guard: ({ context }) => context.currentFlowType === 'changeModel' || context.currentFlowType === 'changeLocation' || context.currentFlowType === 'changePlanOnly',
                                actions: [assign({
                                    currentFlowType: ({ context }) => context.originalFlowType
                                }), 'persistState']
                            },
                            {
                                target: 'planSelectionWorkflow',
                                actions: [assign({
                                    planId: null,
                                    modelId: ({ context }) => {
                                        if (context.originalFlowType === 'explicitUtmLocOnly') return null;
                                        return context.modelId;
                                    },
                                    locationId: ({ context }) => {
                                        if (context.originalFlowType === 'noUtmDefault' || context.originalFlowType === 'explicitUtmModelOnly') return null;
                                        return context.locationId;
                                    }
                                }), 'persistState']
                            }
                        ]
                    }
                },
                explicitUtmPlan: {
                    always: 'planSummary'
                },
                planSummary: {
                    tags: 'showsPlanSummary',
                    entry: [
                        assign({ currentStep: 'planSummary' }),
                        assign(({ context }) => {
                            const { plans } = context.normalizedData;
                            let { planId, modelId, locationId } = context;
                            if (!plans || plans.length === 0) {
                                console.error("Attempted to enter planSummary without plan data loaded.");
                                return {};
                            }
                            if (!planId && modelId && locationId) {
                                const plan = plans.find(p => p.modelId === modelId && (p.locationIds || []).includes(locationId));
                                if (plan) {
                                    planId = plan.id;
                                }
                            }
                            if (planId) {
                                const plan = plans.find(p => p.id === planId);
                                if (plan) {
                                    return {
                                        planId: plan.id,
                                        modelId: plan.modelId,
                                        locationId: plan.locationIds?.[0]
                                    };
                                }
                            }
                            console.error("Could not resolve necessary IDs for Plan Summary. Context:", context);
                            return {};
                        }),
                        'persistState'
                    ],
                    on: {
                        SET_QUANTITY: { actions: ['setQuantity', 'persistState'] },
                        TOGGLE_IS_GIFT: { actions: ['toggleIsGift', 'persistState'] },
                        UPDATE_GIFT_DETAILS_FIELD: { actions: ['updateGiftDetailsField', 'persistState'] },
                        PROCEED_TO_CONTACT: {
                            target: 'contactInfo',
                            actions: [assign({ hasProceededToContact: true }), 'persistState']
                        },
                        BACK: {
                            target: 'dedicatedPlanSelection',
                            actions: [assign({ planId: null }), 'persistState']
                        }
                    }
                },
                contactInfo: {
                    tags: 'showsContactInfo',
                    entry: [
                        assign({ currentStep: 'contactInfo' }),
                        'persistState'
                    ],
                    initial: 'idle',
                    on: {
                        SET_QUANTITY: { actions: ['setQuantity', 'persistState'] },
                        UPDATE_CUSTOMER_FORM_FIELD: { actions: ['updateCustomerFormField', 'persistState'] },
                        SUBMIT_CONTACT: { target: '.submittingContact' },
                        PROCEED_TO_PAYMENT: {
                            target: 'authenticationOrPayment',
                            actions: [assign({ hasProceededToPayment: true }), 'persistState']
                        },
                        EDIT_CONTACT: {
                            actions: [assign({
                                isEditingContact: true,
                                preEditCustomerIndex: ({ context }) => context.currentCustomerIndex,
                                currentCustomerIndex: ({ event }) => event.index,
                            }), 'persistState']
                        },
                        CANCEL_EDIT: {
                            actions: [assign({
                                isEditingContact: false,
                                currentCustomerIndex: ({ context }) => context.preEditCustomerIndex,
                                preEditCustomerIndex: null
                            }), 'persistState']
                        },
                        BACK: {
                            target: 'planSummary',
                            actions: [assign({ hasProceededToContact: false }), 'persistState']
                        }
                    },
                    states: {
                        idle: {
                            entry: [assign({ userIsNavigatingBack: false })],
                        },
                        submittingContact: {
                            entry: ['setSubmitting'],
                            invoke: {
                                src: 'submitCustomer',
                                input: ({ context }) => {
                                    const { customerForms, currentCustomerIndex, isGift } = context;
                                    let role = 'primary';
                                    if (isGift) {
                                        role = currentCustomerIndex === 0 ? 'gifter' : 'recipient';
                                    }
                                    return {
                                        customer: customerForms[currentCustomerIndex],
                                        index: currentCustomerIndex,
                                        role: role
                                    };
                                },
                                onDone: [
                                    {
                                        target: 'idle',
                                        guard: ({ context, event }) => {
                                            console.log(
                                                '%c[DEBUG] submitCustomer successful. API returned:',
                                                'color: #2563eb; font-weight: bold;',
                                                event.output
                                            );

                                            const customerData = event.output;
                                            const newCustomerId = customerData.CID || customerData.id;

                                            const isPrimaryContactEdit = context.isEditingContact && customerData.index === 0;
                                            const hasOldCustomerId = !!context.primaryCustomerId;
                                            const isIdDifferent = context.primaryCustomerId !== newCustomerId;
                                            const shouldResetAuth = isPrimaryContactEdit && hasOldCustomerId && isIdDifferent;

                                            console.log(
                                                '%c[DEBUG] Evaluating Auth Reset Guard:',
                                                'color: #9333ea; font-weight: bold;',
                                                {
                                                    '1. In Edit Mode?': context.isEditingContact,
                                                    '2. Is Primary Contact?': customerData.index === 0,
                                                    '3. Old Customer ID Exists?': context.primaryCustomerId,
                                                    '4. New Customer ID': newCustomerId,
                                                    '5. Are IDs Different?': isIdDifferent,
                                                    'WILL RESET AUTH?': shouldResetAuth
                                                }
                                            );

                                            return shouldResetAuth;
                                        },
                                        actions: [
                                            'clearAuthSession',
                                            assign(({ context, event }) => {
                                                const customerData = event.output;
                                                const newCustomerId = customerData.CID || customerData.id;
                                                const oldCustomerId = context.primaryCustomerId;

                                                console.log(
                                                    '%c[DEBUG] AUTH RESET: Primary customer changed. Resetting auth state.',
                                                    'color: #be123c; font-weight: bold;',
                                                    { oldId: context.primaryCustomerId, newId: newCustomerId }
                                                );

                                                const newSubmittedCustomers = [...context.submittedCustomers];
                                                const existingIdx = newSubmittedCustomers.findIndex(c => c.index === 0);
                                                if (existingIdx > -1) {
                                                    newSubmittedCustomers[existingIdx] = customerData;
                                                }

                                                let newLinkedIds = [...context.linkedCustomerIds];
                                                if (!context.isGift) {
                                                    const oldIdIndex = newLinkedIds.indexOf(oldCustomerId);
                                                    if (oldIdIndex > -1) {
                                                        newLinkedIds[oldIdIndex] = newCustomerId;
                                                    }
                                                }

                                                return {
                                                    isSubmitting: false,
                                                    submittedCustomers: newSubmittedCustomers,
                                                    primaryCustomerId: newCustomerId,
                                                    linkedCustomerIds: newLinkedIds,
                                                    isReauthenticated: false,
                                                    authRequired: customerData?.status === 'has_card',
                                                    maskedPhone: customerData.maskedPhone,
                                                    isEditingContact: false,
                                                    currentCustomerIndex: context.preEditCustomerIndex,
                                                    preEditCustomerIndex: null,
                                                    savedCards: [],
                                                    selectedSavedCardId: null
                                                };
                                            }),
                                            'persistState'
                                        ]
                                    },
                                    {
                                        target: 'idle',
                                        guard: ({ context }) => context.isEditingContact,
                                        actions: [assign(({ context, event }) => {
                                            const customerData = event.output;
                                            const newSubmittedCustomers = [...context.submittedCustomers];
                                            const existingCustomerIndex = newSubmittedCustomers.findIndex(c => c.index === customerData.index);
                                            if (existingCustomerIndex > -1) {
                                                newSubmittedCustomers[existingCustomerIndex] = customerData;
                                            }
                                            return {
                                                isSubmitting: false,
                                                submittedCustomers: newSubmittedCustomers,
                                                isEditingContact: false,
                                                currentCustomerIndex: context.preEditCustomerIndex,
                                                preEditCustomerIndex: null
                                            };
                                        }), 'persistState']
                                    },
                                    {
                                        target: 'checkIfDone',
                                        actions: [assign(({ context, event }) => {
                                            const customerData = event.output;
                                            const customerId = customerData.CID || customerData.id;
                                            const newSubmittedCustomers = [...context.submittedCustomers];
                                            if (newSubmittedCustomers.findIndex(c => c.index === customerData.index) === -1) {
                                                newSubmittedCustomers.push(customerData);
                                            }

                                            const { isGift, currentCustomerIndex } = context;
                                            let primaryId = context.primaryCustomerId;
                                            let newLinkedIds = [...context.linkedCustomerIds];

                                            if (currentCustomerIndex === 0) {
                                                primaryId = customerId;
                                                if (!isGift) {
                                                    newLinkedIds.push(customerId);
                                                }
                                            } else {
                                                newLinkedIds.push(customerId);
                                            }

                                            return {
                                                isSubmitting: false,
                                                submittedCustomers: newSubmittedCustomers,
                                                primaryCustomerId: primaryId,
                                                linkedCustomerIds: newLinkedIds,
                                                authRequired: currentCustomerIndex === 0 ? customerData?.status === 'has_card' : context.authRequired,
                                                maskedPhone: currentCustomerIndex === 0 ? customerData.maskedPhone : context.maskedPhone,
                                                currentCustomerIndex: context.currentCustomerIndex + 1
                                            };
                                        }), 'persistState']
                                    }
                                ],
                                onError: {
                                    target: 'idle',
                                    actions: ['clearSubmitting', 'assignError']
                                }
                            }
                        },
                        checkIfDone: {
                            always: [
                                {
                                    target: '#wizard.displayFlow.authenticationOrPayment',
                                    guard: ({ context }) => {
                                        const totalForms = context.isGift
                                            ? context.numberOfSubscriptions + 1
                                            : context.numberOfSubscriptions;
                                        return context.currentCustomerIndex >= totalForms;
                                    },
                                },
                                { target: 'idle' }
                            ]
                        }
                    }
                },
                authenticationOrPayment: {
                    tags: 'showsPayment',
                    entry: ({ context }) => {
                        console.log(
                            '%c[DEBUG] Entering Payment Step. Current State:',
                            'color: #16a34a; font-weight: bold;',
                            {
                                authRequired: context.authRequired,
                                isReauthenticated: context.isReauthenticated,
                                primaryCustomerId: context.primaryCustomerId,
                                customerForms: context.customerForms
                            }
                        );
                    },
                    initial: 'deciding',
                    on: {
                        BACK: {
                            target: 'contactInfo',
                            actions: [
                                assign({
                                    choseToEnterNewCard: false,
                                    userIsNavigatingBack: true,
                                    hasProceededToPayment: false,
                                    otpMethod: null
                                }),
                                'persistState'
                            ]
                        }
                    },
                    states: {
                        deciding: {
                            always: [
                                {
                                    target: 'authentication',
                                    guard: ({ context }) => context.authRequired
                                },
                                {
                                    target: 'fetchingCardDetails',
                                    guard: ({ context }) => context.isReauthenticated
                                },
                                {
                                    target: 'payment.confirmSavedCard',
                                    guard: ({ context }) => context.savedCards.length > 0
                                },
                                {
                                    target: 'payment.enterNewCard'
                                }
                            ]
                        },
                        authentication: {
                            initial: 'chooseMethod',
                            states: {
                                chooseMethod: {
                                    entry: [assign({ currentStep: 'otpMethodChoice' }), 'clearError', 'persistState'],
                                    on: {
                                        SEND_CODE_EMAIL: {
                                            target: 'sendingCode',
                                            actions: ['setOtpEmail', 'persistState']
                                        },
                                        SEND_CODE_SMS: {
                                            target: 'sendingCode',
                                            actions: ['setOtpSms', 'persistState']
                                        }
                                    }
                                },
                                sendingCode: {
                                    invoke: {
                                        src: 'sendOtp',
                                        input: ({ context }) => ({
                                            to: context.otpMethod === 'email' ? context.customerForms[0].email : context.customerForms[0].phone,
                                            channel: context.otpMethod
                                        }),
                                        onDone: { target: 'enterCode' },
                                        onError: { target: 'chooseMethod', actions: 'assignError' }
                                    }
                                },
                                enterCode: {
                                    entry: [assign({ currentStep: 'otpEntry' }), 'clearError', 'persistState'],
                                    on: {
                                        UPDATE_OTP_CODE: { actions: 'assignOtpCode' },
                                        SUBMIT_CODE: { target: 'verifyingCode' },
                                        BACK_TO_METHOD_CHOICE: {
                                            target: 'chooseMethod',
                                            actions: [assign({ otpMethod: null, otpCode: '' }), 'persistState']
                                        }
                                    }
                                },
                                verifyingCode: {
                                    invoke: {
                                        src: 'verifyOtp',
                                        input: ({ context }) => ({ to: context.otpMethod === 'email' ? context.customerForms[0].email : context.customerForms[0].phone, channel: context.otpMethod, code: context.otpCode }),
                                        onDone: {
                                            target: 'fetchingCustomerInfoAfterOtp'
                                        },
                                        onError: { target: 'enterCode', actions: 'assignError' }
                                    }
                                },
                                fetchingCustomerInfoAfterOtp: {
                                    invoke: {
                                        src: 'fetchCustomerInfo',
                                        input: ({ context }) => ({
                                            email: context.customerForms[0].email,
                                            phone: context.customerForms[0].phone
                                        }),
                                        onDone: {
                                            target: '#wizard.displayFlow.authenticationOrPayment.fetchingCardDetails',
                                            actions: [
                                                assign({
                                                    isReauthenticated: true,
                                                    primaryCustomerId: ({ event }) => event.output.id || event.output.CID,
                                                    authRequired: false
                                                }),
                                                'setAuthSession',
                                                'persistState'
                                            ]
                                        },
                                        onError: {
                                            target: 'chooseMethod',
                                            actions: 'assignError'
                                        }
                                    }
                                }
                            }
                        },
                        fetchingCardDetails: {
                            invoke: {
                                src: 'fetchSavedCards',
                                input: ({ context }) => ({ primaryCustomerId: context.primaryCustomerId }),
                                onDone: {
                                    actions: ['assignSavedCards', 'persistState'],
                                    target: 'payment.routingAfterCardFetch'
                                },
                                onError: {
                                    target: 'payment.enterNewCard',
                                    actions: ['assignError', 'persistState']
                                }
                            }
                        },
                        payment: {
                            initial: 'routingAfterCardFetch',
                            states: {
                                routingAfterCardFetch: {
                                    always: [
                                        {
                                            target: 'confirmSavedCard',
                                            guard: ({ context }) => context.savedCards.length > 0
                                        },
                                        {
                                            target: 'enterNewCard'
                                        }
                                    ]
                                },
                                confirmSavedCard: {
                                    entry: [assign({ currentStep: 'selectCard' }), 'persistState'],
                                    on: {
                                        SELECT_SAVED_CARD: { actions: ['assignSelectedCard', 'persistState'] },
                                        PAY_WITH_SAVED_CARD: { target: 'processingSavedCardPayment', actions: 'generateIdempotencyKey' },
                                        USE_NEW_CARD: { target: 'enterNewCard', actions: ['setChoseToEnterNewCard', 'persistState'] }
                                    }
                                },
                                enterNewCard: {
                                    entry: [assign({ currentStep: 'newCardEntry' }), 'persistState'],
                                    on: {
                                        SUBMIT_NONCE: { target: 'savingNewCard', actions: ['assignNonce', 'generateIdempotencyKey'] },
                                        BACK_TO_SAVED_CARDS: {
                                            target: 'confirmSavedCard',
                                            guard: ({ context }) => context.savedCards.length > 0,
                                            actions: ['clearChoseToEnterNewCard', 'persistState']
                                        },
                                    }
                                },
                                processingSavedCardPayment: {
                                    invoke: {
                                        src: 'processSavedCardPayment',
                                        input: ({ context }) => ({ primaryCustomerId: context.primaryCustomerId, cardId: context.selectedSavedCardId, planId: context.planId, modelId: context.modelId, locationId: context.locationId, idempotencyKey: context.idempotencyKey, linkedCustomerIds: context.linkedCustomerIds }),
                                        onDone: { target: '#wizard.displayFlow.summary', actions: ['assignPaymentId', 'persistState'] },
                                        onError: { target: 'confirmSavedCard', actions: ['assignError', 'persistState'] }
                                    }
                                },
                                savingNewCard: {
                                    invoke: {
                                        src: 'saveNewCard',
                                        input: ({ context }) => ({ paymentNonce: context.paymentNonce, idempotencyKey: context.idempotencyKey, primaryCustomerId: context.primaryCustomerId, planId: context.planId, linkedCustomerIds: context.linkedCustomerIds }),
                                        onDone: {
                                            target: 'confirmSavedCard',
                                            actions: [
                                                assign({
                                                    savedCards: ({ context, event }) => {
                                                        const newCard = event.output.card;
                                                        const isDuplicate = context.savedCards.some(
                                                            existingCard => existingCard.last_4 === newCard.last_4 && existingCard.card_brand?.toUpperCase() === newCard.card_brand?.toUpperCase() && String(existingCard.exp_month) === String(newCard.exp_month) && String(existingCard.exp_year) === String(newCard.exp_year)
                                                        );
                                                        if (isDuplicate) {
                                                            return context.savedCards;
                                                        }
                                                        return [newCard, ...context.savedCards];
                                                    },
                                                    selectedSavedCardId: ({ event }) => event.output.card.id,
                                                    choseToEnterNewCard: false
                                                }),
                                                'persistState'
                                            ]
                                        },
                                        onError: { target: 'enterNewCard', actions: ['assignError', 'persistState'] }
                                    }
                                }
                            }
                        }
                    }
                },
                summary: {
                    tags: 'showsFinalSummary',
                    entry: [
                        assign({ currentStep: 'finalSummary', isComplete: true }),
                        'persistState'
                    ],
                }
            }
        },
        failure: {
            entry: () => console.log('%c[STATE] ❌ Failure', 'color: #ef4444; font-weight: bold;'),
            type: 'final'
        }
    }
});