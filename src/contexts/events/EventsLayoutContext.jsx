import React, { createContext, useEffect, useState, useCallback, useMemo } from 'react';
import { useMachine } from '@xstate/react';
import { eventsMachine } from '@/state/events/eventsMachine';
import { useNavigate } from 'react-router-dom';

export const LayoutContext = createContext({});

const FUNDRAISER_STORAGE_KEY = 'fundraiser-wizard-state';
const CACHE_VERSION_KEY = 'fundraiser-cache-version';
const CURRENT_CACHE_VERSION = '6'; // Increment this when state structure changes

// A wizard-only snapshot that directory/dashboard states never overwrite. The main
// snapshot above always holds the machine's *current* state, so visiting the directory
// (e.g. via a hard nav to /events/<location>) clobbers any in-progress registration.
// This second slot survives that, so returning to a registration step — browser back,
// a re-typed URL, a reload — can restore the exact step with its selections/form.
// Written on each in-progress wizard step; cleared only when the wizard resolves.
const WIZARD_PROGRESS_KEY = 'fundraiser-wizard-progress';
// URL paths that represent an in-progress registration step (captures the eventId).
const WIZARD_STEP_RE = /^\/events\/([^/]+)\/(location|schedule|date|time|contact|payment|verify)\/?$/;

export const LayoutProvider = ({ children }) => {
    // 0. Version check - clear cache if version mismatch
    const storedVersion = localStorage.getItem(CACHE_VERSION_KEY);
    if (storedVersion !== CURRENT_CACHE_VERSION) {
        console.log('=== CACHE VERSION MISMATCH - CLEARING OLD CACHE ===');
        console.log('Stored version:', storedVersion, 'Current version:', CURRENT_CACHE_VERSION);
        localStorage.removeItem(FUNDRAISER_STORAGE_KEY);
        localStorage.removeItem(WIZARD_PROGRESS_KEY);
        localStorage.setItem(CACHE_VERSION_KEY, CURRENT_CACHE_VERSION);
    }

    // 1. Rehydration Logic: Safely read, validate, and reconstruct the state.
    // Prefer the wizard-only snapshot when the URL is a registration step whose event
    // matches the saved progress. This lets browser-back / a re-typed URL / a reload
    // return to an in-progress step even though visiting the directory has since
    // overwritten the main snapshot with a directory state.
    let persistedStateJSON = localStorage.getItem(FUNDRAISER_STORAGE_KEY);
    try {
        const wizMatch = window.location.pathname.match(WIZARD_STEP_RE);
        if (wizMatch) {
            const progJSON = localStorage.getItem(WIZARD_PROGRESS_KEY);
            const prog = progJSON ? JSON.parse(progJSON) : null;
            if (prog?.value?.wizardFlow && prog?.context?.selectedEventId === wizMatch[1]) {
                persistedStateJSON = progJSON;
            }
        }
    } catch (e) {
        // Ignore and fall back to the main snapshot.
    }
    let rehydratedState;

    try {
        const parsed = persistedStateJSON ? JSON.parse(persistedStateJSON) : undefined;
        console.log('=== REHYDRATING STATE FROM LOCALSTORAGE ===');
        console.log('Parsed value:', parsed?.value);
        console.log('Parsed selectedEventId:', parsed?.context?.selectedEventId);
        console.log('Parsed fundraiserEvents count:', parsed?.context?.fundraiserEvents?.length || 0);

        // If parsed data exists, reconstruct a valid XState State object from it
        if (parsed && parsed.value && parsed.context) {
            // Clear transient/session-scoped data — not meant to persist across page loads
            parsed.context.duplicateNotice = false;
            parsed.context.sessionToken = null;
            parsed.context.lastSessionCreatedAt = null;
            rehydratedState = eventsMachine.resolveState(parsed);
            console.log('Rehydrated state value:', rehydratedState?.value);
        }
        console.log('============================================');
    } catch (e) {
        console.error("Failed to parse or resolve persisted state, clearing cache and starting fresh.", e);
        // Clear the corrupted cache
        localStorage.removeItem(FUNDRAISER_STORAGE_KEY);
        rehydratedState = undefined;
    }
    
    // 2. Initialize the machine with the correctly rehydrated state object.
    const [fundraiserState, sendToFundraiser, actorRef] = useMachine(eventsMachine, {
        snapshot: rehydratedState,
    });

    // 3. Subscription Logic: Save state changes, but skip transient invoke states
    //    that re-trigger API calls (like session creation) on rehydration.
    const TRANSIENT_STATES = [
        'userDashboard.ensureSession',
        'userDashboard.creatingSessionInline',
        'userDashboard.loadingEvents',
        'loginFlow.creatingSession',
        'loginFlow.sendingOtp',
        'loginFlow.verifyingOtp',
    ];
    useEffect(() => {
        if (!actorRef) return;
        const subscription = actorRef.subscribe((snapshot) => {
            if (snapshot.matches('failure')) {
                localStorage.removeItem(FUNDRAISER_STORAGE_KEY);
                localStorage.removeItem(WIZARD_PROGRESS_KEY);
                return;
            }
            // Don't persist transient invoke states — they re-trigger API calls on rehydration
            const isTransient = TRANSIENT_STATES.some(s => snapshot.matches(s));
            if (isTransient) return;
            const stateToPersist = {
                value: snapshot.value,
                context: snapshot.context,
            };
            localStorage.setItem(FUNDRAISER_STORAGE_KEY, JSON.stringify(stateToPersist));

            // Maintain the wizard-only snapshot (see WIZARD_PROGRESS_KEY). Save every
            // in-progress step *past* the landing (so an empty landing view doesn't create
            // a resumable draft); drop it once the registration succeeds. Notably we do NOT
            // clear it on entering the directory, so returning to the step can restore it.
            if (snapshot.matches({ wizardFlow: 'success' })) {
                localStorage.removeItem(WIZARD_PROGRESS_KEY);
            } else if (
                snapshot.matches('wizardFlow') &&
                !snapshot.matches({ wizardFlow: 'eventLanding' }) &&
                snapshot.context?.selectedEventId
            ) {
                localStorage.setItem(WIZARD_PROGRESS_KEY, JSON.stringify(stateToPersist));
            }
        });
        return () => subscription.unsubscribe();
    }, [actorRef]);


    const isAuthenticated = fundraiserState?.context?.isAuthenticated;
    const navigate = useNavigate();

    // Handle the /login route — check both standalone and embedded paths.
    useEffect(() => {
        const path = window.location.pathname;
        if ((path === '/login' || path === '/events/login') && !isAuthenticated) {
            sendToFundraiser({ type: 'LOGIN_START' });
        }
    }, [isAuthenticated, sendToFundraiser]);
    
    const [showLoginButton, setShowLoginButton] = useState(false);
    const [showMyEventsButton, setShowMyEventsButton] = useState(false);
    const [showLogoutButton, setShowLogoutButton] = useState(false);

    // Custom back handler — allows pages like BookASpace to provide their own back button behavior
    const [customBackHandler, setCustomBackHandler] = useState(null);
    
    const logout = useCallback(() => {
        sendToFundraiser({ type: 'LOGOUT' });
        navigate('/');
    }, [sendToFundraiser, navigate]);
    
    const resetWizardFlow = useCallback(() => {
        sendToFundraiser({ type: 'RESET' });
    }, [sendToFundraiser]);

    useEffect(() => {
        if (!fundraiserState) return;
        
        const isDirectoryPage = fundraiserState.matches('directory');
        const onDashboard = fundraiserState.matches('userDashboard');

        setShowLoginButton(!isAuthenticated && isDirectoryPage);
        setShowMyEventsButton(isAuthenticated && isDirectoryPage);
        setShowLogoutButton(onDashboard);

    }, [fundraiserState, isAuthenticated]);

    const contextValue = useMemo(() => ({
        fundraiserState,
        sendToFundraiser,
        isAuthenticated,
        logout,
        resetWizardFlow,
        showLoginButton,
        showMyEventsButton,
        showLogoutButton,
        customBackHandler,
        setCustomBackHandler,
    }), [
        fundraiserState,
        sendToFundraiser,
        isAuthenticated,
        logout,
        resetWizardFlow,
        showLoginButton,
        showMyEventsButton,
        showLogoutButton,
        customBackHandler,
    ]);

    return (
        <LayoutContext.Provider value={contextValue}>
            {children}
        </LayoutContext.Provider>
    );
};

