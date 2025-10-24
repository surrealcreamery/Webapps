// src/state/subscription/initialContext.js

export const initialWizardContext = {
    hasPassedPlanSelection: false,
    campaignRaw: null,
    modelsRaw: null,
    normalizedData: { models: [], locations: [], plans: [] }, // FIX: Removed duplicate []
    previousCampaignRaw: null, // Holds the campaign data from the LAST successful routing
    persistedFlowType: 'initial', // NEW: Stores the flow type from the last persisted state for comparison
    modelId: null,
    locationId: null,
    planId: null,
    initialUtmModels: [],
    initialUtmLocations: [],
    initialUtmPlan: '',
    customerId: null,
    authRequired: false,
    isReauthenticated: false,
    paymentId: null,
    nonce: null,
    maskedPhone: null,
    otpMethod: null,
    savedCards: [],
    selectedSavedCardId: null,
    sid: null,
    customer: { firstName: '', lastName: '', email: '', phone: '' },
    currentFlowType: 'initial', // Will be set by setFlowType action in routing
    utmParams: null, // Will hold current UTMs from URL
    processingData: null,
  };