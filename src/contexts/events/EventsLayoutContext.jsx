import React, { createContext, useEffect, useState, useCallback, useMemo } from 'react';
import { useMachine } from '@xstate/react';
import { eventsMachine } from '@/state/events/eventsMachine';
import { useNavigate } from 'react-router-dom';

export const LayoutContext = createContext({});

const FUNDRAISER_STORAGE_KEY = 'fundraiser-wizard-state';
const CACHE_VERSION_KEY = 'fundraiser-cache-version';
const CURRENT_CACHE_VERSION = '2'; // Increment this when state structure changes

export const LayoutProvider = ({ children }) => {
    // 0. Version check - clear cache if version mismatch
    const storedVersion = localStorage.getItem(CACHE_VERSION_KEY);
    if (storedVersion !== CURRENT_CACHE_VERSION) {
        console.log('=== CACHE VERSION MISMATCH - CLEARING OLD CACHE ===');
        console.log('Stored version:', storedVersion, 'Current version:', CURRENT_CACHE_VERSION);
        localStorage.removeItem(FUNDRAISER_STORAGE_KEY);
        localStorage.setItem(CACHE_VERSION_KEY, CURRENT_CACHE_VERSION);
    }

    // 1. Rehydration Logic: Safely read, validate, and reconstruct the state.
    const persistedStateJSON = localStorage.getItem(FUNDRAISER_STORAGE_KEY);
    let rehydratedState;

    try {
        const parsed = persistedStateJSON ? JSON.parse(persistedStateJSON) : undefined;
        console.log('=== REHYDRATING STATE FROM LOCALSTORAGE ===');
        console.log('Parsed value:', parsed?.value);
        console.log('Parsed selectedEventId:', parsed?.context?.selectedEventId);
        console.log('Parsed fundraiserEvents count:', parsed?.context?.fundraiserEvents?.length || 0);

        // If parsed data exists, reconstruct a valid XState State object from it
        if (parsed && parsed.value && parsed.context) {
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

    // 3. Subscription Logic: Automatically save every state change.
    useEffect(() => {
        if (!actorRef) return;
        const subscription = actorRef.subscribe((snapshot) => {
            if (snapshot.matches('failure')) {
                localStorage.removeItem(FUNDRAISER_STORAGE_KEY);
                return;
            }
            // Persist only the serializable parts of the state
            const stateToPersist = {
                value: snapshot.value,
                context: snapshot.context,
            };
            localStorage.setItem(FUNDRAISER_STORAGE_KEY, JSON.stringify(stateToPersist));
        });
        return () => subscription.unsubscribe();
    }, [actorRef]);


    const isAuthenticated = fundraiserState?.context?.isAuthenticated;
    const navigate = useNavigate();

    // ✅ This is the fix: A new useEffect to handle the /login route.
    useEffect(() => {
        // When the component first loads, check the browser's URL path.
        if (window.location.pathname === '/login' && !isAuthenticated) {
            // If the user is on the /login page and isn't already logged in,
            // send the event to the state machine to start the login flow.
            sendToFundraiser({ type: 'LOGIN_START' });
        }
    }, [isAuthenticated, sendToFundraiser]); // Dependencies ensure this runs on load and if auth status changes.
    
    const [showLoginButton, setShowLoginButton] = useState(false);
    const [showMyEventsButton, setShowMyEventsButton] = useState(false);
    const [showLogoutButton, setShowLogoutButton] = useState(false);
    
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
    }), [
        fundraiserState, 
        sendToFundraiser, 
        isAuthenticated, 
        logout, 
        resetWizardFlow, 
        showLoginButton,
        showMyEventsButton,
        showLogoutButton
    ]);

    return (
        <LayoutContext.Provider value={contextValue}>
            {children}
        </LayoutContext.Provider>
    );
};

