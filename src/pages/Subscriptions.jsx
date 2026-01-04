/**
 * ========================================================================
 * List of Files Comprising the Subscription Wizard:
 * ========================================================================
 * //src/constants/subscriptions/subscriptionsConstants.js
 * //src/api/subscription/index.js
 * //src/components/subscription/cardBrandIcon.jsx
 * //src/components/subscription/otpInput.jsx
 * //src/components/subscription/phoneInput.jsx
 * //src/components/subscription/quantityInput.jsx
 * //src/components/subscription/squarePaymentForm.jsx
 * //src/components/subscription/stepContactInfo.jsx
 * //src/components/subscription/stepFinalSummary.jsx
 * //src/components/subscription/stepPayment.jsx
 * //src/components/subscription/stepPlanSelection.jsx
 * //src/components/subscription/stepPlanSummary.jsx
 * //src/components/subscription/ViewAllDrinksModal.jsx
 * //src/pages/Home.jsx
 * //src/state/subscription/subscriptionMachine.js
 * //src/utils/subscription/index.js
 * ========================================================================
 */

/**
 * ========================================================================
 * Supporting Files:
 * ========================================================================
 * //router.jsx
 * //src/layouts/default.jsx
 * //src/components/header/header.jsx
 * //src/theme/publicTheme.js
 * ========================================================================
 */

/**
 * ========================================================================
 * Consolidated Subscription Wizard Requirements (Updated)
 * ========================================================================
 *
 * ### I. Core Flow and Navigation
 *
 * 1. **Dynamic Flow Based on URL Parameters**: The wizard's starting point and subsequent steps must adapt based on specific UTM parameters (`model_id`, `location_id`, `plan_id`). The flows include:
 * * No UTMs (Default): Model → Location → Plan
 * * Model Only: Location → Plan
 * * Location Only: Model → Plan
 * * Model & Location: Plan Selection
 * * Plan ID: Contact Information
 *
 * 2. **State Persistence**: The wizard must remember the user's progress using `localStorage`. When a user returns to a session, they should be taken to the exact step where they left off with their data restored.
 *
 * 3. **Logo Navigation**: Clicking the logo in the header must reset the user's *flow progress* (selections, current step) while **preserving their authentication state**. This will return them to the first screen of the wizard without logging them out.
 *
 * ### II. UI, Layout, and Accessibility
 *
 * 1. **Conditional Header Button**: The "Redeem" button in the header must only be visible on the initial selection screens (Select a Plan, Select a Location). It must be hidden on all subsequent steps (Plan Summary, Contact Info, Payment, etc.).
 *
 * 2. **Offer Section**:
 * * An offer section (with a hero image, title, and drink categories) should be conditionally displayed on the initial selection screens based on the `currentFlowType`.
 * * The info icons next to each drink category and the "View All Drinks" button must open a full-page modal.
 * * Clicking an info icon must deep-link and scroll the user to the corresponding section within the modal.
 *
 * 3. **Selection Screens (Plan, Model, Location)**:
 * * All selection options must be rendered as focusable `<Button>` elements for ADA compliance.
 * * Buttons should have a consistent style: white background, black text, and a black border. Selected items should have a blue primary color border.
 * * The main title of the page (e.g., "Select a Plan") should be an `<h1>` if the offer section is not present, and an `<h2>` if it is.
 * * Spacing and margins must be consistent between the sections.
 *
 * 4. **"View All Drinks" Modal**:
 * * The modal must be full-page with a sticky header containing the "All Drinks" title.
 * * The content area must be scrollable and include a list of anchor links for jumping to specific drink sections.
 * * The drink list should be a two-column layout with a thumbnail on the left and the drink name on the right.
 *
 * ### III. Data Integrity and Reset Behavior
 *
 * 1. **Universal Reset on Campaign Change**: If the wizard detects a change in the campaign mapping between sessions, all of the user's prior progress and selections must be cleared to ensure a clean start.
 *
 * ### IV. Authentication and Payment Processing
 *
 * 1. **Conditional Authentication**: The wizard must direct the user to an OTP authentication step only if their record indicates they have a card on file. Otherwise, they proceed directly to payment.
 *
 * 2. **Cross-App Authentication**: If a user has successfully authenticated in the subscription flow, they must **not** be required to re-authenticate when they navigate to the `/redeem` page. The Redeem page must check for and respect the existing authenticated session.
 *
 * 3. **Payment Flow**:
 * * The payment screen must correctly display saved cards and allow the user to add a new one.
 * * All payment-related API calls must include a unique idempotency key.
 * * The UI must be updated immediately after a new card is successfully added.
 * ========================================================================
 */

// /src/pages/Home.jsx

import React, { useMemo, useState, useEffect, useCallback, useContext } from 'react';
import {
    Box,
    Typography,
    CircularProgress,
    Alert,
    Snackbar,
    Paper,
    TextField,
    Button,
    Card,
    CardContent,
    Stepper,
    Step,
    StepLabel,
    StepContent,
    FormControlLabel,
    Checkbox
} from '@mui/material';
import PhoneInput from 'react-phone-number-input/input';
import 'react-phone-number-input/style.css';


// The shared context that provides access to the XState state machine instance.
import { LayoutContext } from '@/contexts/subscriptions/SubscriptionsLayoutContext';

// Import all the individual step components that this page will render.
import StepModelSelection from '@/components/subscription/stepModelSelection.jsx';
import StepLocationSelection from '@/components/subscription/stepLocationSelection.jsx';
import StepPlanSelection from '@/components/subscription/stepPlanSelection.jsx';
import StepPlanSummary from '@/components/subscription/stepPlanSummary.jsx';
import StepContactInfo from '@/components/subscription/stepContactInfo.jsx';
import StepPayment from '@/components/subscription/stepPayment.jsx';
import StepFinalSummary from '@/components/subscription/stepFinalSummary.jsx';
import ViewAllDrinksModal from '@/components/subscription/ViewAllDrinksModal.jsx';

/**
 * Home is the central controller component for the entire subscription wizard.
 * It consumes the state from the wizard's state machine via context and is responsible
 * for rendering the correct "step" sub-component based on the current state.
 * It also manages page-level UI like modals and snackbars.
 */
export default function Home() {
    const { wizardState, sendToWizard, setShowRedeemButton } = useContext(LayoutContext);
    const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });
    const [drinksModalConfig, setDrinksModalConfig] = useState({ open: false, section: null });

    useEffect(() => {
        if (!setShowRedeemButton || !wizardState) {
            return;
        }
        
        const { originalFlowType, currentStep, currentFlowType } = wizardState.context;
        let isFirstStep = false;
        const isChangeFlow = currentFlowType && currentFlowType.startsWith('change');

        if (!isChangeFlow) {
            if (originalFlowType === 'noUtmDefault' && currentStep === 'modelSelection') {
                isFirstStep = true;
            } else if (originalFlowType === 'explicitUtmModelOnly' && currentStep === 'locationSelection') {
                isFirstStep = true;
            } else if (originalFlowType === 'explicitUtmLocOnly' && currentStep === 'modelSelection') {
                isFirstStep = true;
            } else if (originalFlowType === 'explicitUtmModelAndLoc' && currentStep === 'planSelection') {
                isFirstStep = true;
            }
        }
        
        setShowRedeemButton(isFirstStep);
        
    }, [wizardState, setShowRedeemButton]);

    useEffect(() => {
        if (!wizardState || !sendToWizard) {
            return;
        }
        
        const error = wizardState.context.error;
        if (error) {
            setSnackbar({ open: true, message: error, severity: 'error' });
            sendToWizard({ type: 'clearError' });
        }
    }, [wizardState?.context.error, sendToWizard]);
    
    if (!wizardState) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4, flexGrow: 1 }}>
                <CircularProgress />
            </Box>
        );
    }

    const { normalizedData, modelId, locationId, planId, campaignModels, campaignLocations, currentFlowType } = wizardState.context;
    const { models, locations, plans } = normalizedData;

    const availableModels = useMemo(() => {
        if (!models || !plans) return [];
        if (currentFlowType === 'changeModel') {
            if (!locationId) return models;
            const validModelIds = new Set(plans.filter(p => (p.locationIds || []).includes(locationId)).map(p => p.modelId));
            return models.filter(m => validModelIds.has(m.id));
        }
        if ((campaignModels || []).length > 0) return models.filter(m => (campaignModels || []).includes(m.id));
        if ((campaignLocations || []).length > 0) {
            const modelIds = new Set(plans.filter(p => (p.locationIds || []).some(locId => (campaignLocations || []).includes(locId))).map(p => p.modelId));
            return models.filter(m => modelIds.has(m.id));
        }
        return models;
    }, [models, plans, campaignModels, campaignLocations, currentFlowType, locationId]);

    const availableLocations = useMemo(() => {
        if (!locations || !plans) return [];
        if (currentFlowType === 'changeLocation') {
            if (!modelId) return locations;
            const validLocationIds = new Set(plans.filter(p => p.modelId === modelId).flatMap(p => p.locationIds || []));
            return locations.filter(l => validLocationIds.has(l.id));
        }
        const modelIdsToFilterBy = modelId ? [modelId] : (campaignModels || []);
        if (modelIdsToFilterBy.length === 0) {
            return (campaignLocations || []).length > 0 ? locations.filter(l => (campaignLocations || []).includes(l.id)) : locations;
        }
        const locationIds = new Set(plans.filter(p => modelIdsToFilterBy.includes(p.modelId)).flatMap(p => p.locationIds || []));
        let validLocations = locations.filter(l => locationIds.has(l.id));
        if ((campaignLocations || []).length > 0) return validLocations.filter(l => (campaignLocations || []).includes(l.id));

        console.log('Final availableLocations:', validLocations); 

        return validLocations;
    }, [locations, plans, modelId, campaignModels, campaignLocations, currentFlowType]);

    const availablePlans = useMemo(() => {
        if (!Array.isArray(plans)) {
            return [];
        }
        
        // --- THIS MAPPING WAS THE PROBLEM ---
        // It was stripping out the `benefits` property. It has now been added.
        const mappedPlans = plans.map(plan => ({
          id: plan.id,
          name: plan.name,
          price: plan.price,
          frequency: plan.frequency,
          description: plan.description,
          'Plan Type': plan['Plan Type'],
          modelId: plan.modelId,
          locationIds: plan.locationIds,
          benefits: plan.benefits // <<< THIS LINE FIXES THE ISSUE
        }));
    
        const modelsToFilter = modelId ? [modelId] : (campaignModels || []);
        const locationsToFilter = locationId ? [locationId] : (campaignLocations || []);
    
        if (modelsToFilter.length === 0 || locationsToFilter.length === 0) {
            return [];
        }
    
        return mappedPlans.filter(p =>
            modelsToFilter.includes(p.modelId) &&
            p.locationIds.some(locId => locationsToFilter.includes(locId))
        );
    
    }, [plans, modelId, locationId, campaignModels, campaignLocations]);

    const selectedModel = useMemo(() => availableModels.find(m => m.id === modelId), [availableModels, modelId]);
    const selectedLocation = useMemo(() => availableLocations.find(l => l.id === locationId), [availableLocations, locationId]);
    const selectedPlan = useMemo(() => availablePlans.find(p => p.id === planId), [availablePlans, planId]);
    
    const getPriceForModel = useCallback((modelIdToFind) => {
        if (!plans || plans.length === 0) return null;

        const formatFrequency = (freq) => {
            if (!freq) return '';
            if (freq.toLowerCase().includes('month')) return '/mo';
            if (freq.toLowerCase().includes('year')) return '/yr';
            return `/${freq}`;
        };

        let plansForModel = plans.filter(p => p.modelId === modelIdToFind);

        if (locationId) {
            plansForModel = plansForModel.filter(p => (p.locationIds || []).includes(locationId));
        }

        if (plansForModel.length === 0) return null;

        if (plansForModel.length === 1) {
            const plan = plansForModel[0];
            return { text: `$${plan.price}${formatFrequency(plan.frequency)}` };
        }

        const minPricePlan = plansForModel.reduce((min, p) => p.price < min.price ? p : min, plansForModel[0]);
        return { text: `Starting at $${minPricePlan.price}${formatFrequency(minPricePlan.frequency)}` };
    }, [plans, locationId]);

    const renderContent = () => {
        const { context } = wizardState;
        const openDrinksModal = (section = null) => setDrinksModalConfig({ open: true, section });

        if (wizardState.hasTag('showsModelSelection')) {
            return <StepModelSelection send={sendToWizard} availableModels={availableModels} getPriceForModel={getPriceForModel} currentFlowType={context.currentFlowType} onViewAllDrinks={openDrinksModal} />;
        }
        if (wizardState.hasTag('showsLocationSelection')) {
            return <StepLocationSelection send={sendToWizard} model={selectedModel} locationId={context.locationId} availableLocations={availableLocations} getPriceForModel={getPriceForModel} currentFlowType={context.currentFlowType} onViewAllDrinks={openDrinksModal} />;
        }
        if (wizardState.hasTag('showsPlanSelection')) {
            return <StepPlanSelection send={sendToWizard} planId={context.planId} availablePlans={availablePlans} currentFlowType={context.currentFlowType} onViewAllDrinks={openDrinksModal} />;
        }
        if (wizardState.hasTag('showsPlanSummary')) {
            if (!selectedPlan || !selectedModel || !selectedLocation) {
                return (
                    <Box sx={{ display: 'flex', justifyContent: 'center', p: 4, flexGrow: 1, width: '100%' }}>
                        <CircularProgress />
                    </Box>
                );
            }

            return <StepPlanSummary 
                        send={sendToWizard} 
                        plan={selectedPlan} 
                        model={selectedModel} 
                        location={selectedLocation} 
                        numberOfSubscriptions={context.numberOfSubscriptions} 
                        currentFlowType={context.currentFlowType}
                        isGift={context.isGift}
                        giftDetails={context.giftDetails}
                    />;
        }
        if (wizardState.hasTag('showsContactInfo')) {
            return <StepContactInfo 
                        send={sendToWizard} 
                        isSubmitting={wizardState.matches('displayFlow.contactInfo.submittingContact')} 
                        customerForms={context.customerForms} 
                        submittedCustomers={context.submittedCustomers} 
                        currentCustomerIndex={context.currentCustomerIndex} 
                        numberOfSubscriptions={context.numberOfSubscriptions}
                        isEditing={context.isEditingContact}
                        isGift={context.isGift}
                    />;
        }
        if (wizardState.hasTag('showsPayment')) {
            return <StepPayment send={sendToWizard} current={wizardState} onSnackbar={setSnackbar} />;
        }
        if (wizardState.hasTag('showsFinalSummary')) {
            return <StepFinalSummary 
                        plan={selectedPlan}
                        savedCards={context.savedCards} 
                        selectedSavedCardId={context.selectedSavedCardId} 
                        onNavigate={(path) => { console.log(`Navigating to ${path}`) }} 
                    />;
        }
        
        console.log("No matching UI tag found for current state:", wizardState.value);
        return null;
    };

    console.log('--- HOME COMPONENT: AVAILABLE LOCATIONS ---', availableLocations);


    return (
        <Box
            sx={{
                maxWidth: 'sm',
                width: '100%',
                mx: 'auto',
                pt: 0,
                pb: 3,
                px: 3,
                display: 'flex',
                flexDirection: 'column',
                flexGrow: 1,
            }}
        >
            <ViewAllDrinksModal 
                open={drinksModalConfig.open} 
                handleClose={() => setDrinksModalConfig({ open: false, section: null })} 
                section={drinksModalConfig.section}
            />
            
            {wizardState.matches('fetchingData') ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 4, flexGrow: 1, width: '100%' }}>
                    <CircularProgress />
                </Box>
            ) : wizardState.matches('failure') ? (
                <Alert severity="error" sx={{ flexGrow: 1, width: '100%' }}>{wizardState.context.error}</Alert>
            ) : (
                <Box sx={{ flexGrow: 1, width: '100%' }}>
                    {renderContent()}
                </Box>
            )}

            <Snackbar
                open={snackbar.open}
                autoHideDuration={6000}
                onClose={() => setSnackbar(s => ({ ...s, open: false }))}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <Alert onClose={() => setSnackbar(s => ({ ...s, open: false }))} severity={snackbar.severity} sx={{ width: '100%' }}>
                    {snackbar.message}
                </Alert>
            </Snackbar>
        </Box>
    );
}