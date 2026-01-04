import React, { createContext, useEffect, useState, useCallback, useMemo } from 'react';
import { useMachine } from '@xstate/react';
import { commerceMachine } from '@/state/commerce/commerceMachine';
import { useNavigate, useLocation } from 'react-router-dom';

export const LayoutContext = createContext({});

const COMMERCE_STORAGE_KEY = 'commerce-state';

export const LayoutProvider = ({ children }) => {
    // 1. Rehydration Logic: Safely read, validate, and reconstruct the state.
    const persistedStateJSON = localStorage.getItem(COMMERCE_STORAGE_KEY);
    let rehydratedState;

    try {
        const parsed = persistedStateJSON ? JSON.parse(persistedStateJSON) : undefined;
        // If parsed data exists, reconstruct a valid XState State object from it
        if (parsed && parsed.value && parsed.context) {
            rehydratedState = commerceMachine.resolveState(parsed);
        }
    } catch (e) {
        console.error("Failed to parse or resolve persisted state, starting fresh.", e);
    }
    
    // 2. Initialize the machine with the correctly rehydrated state object.
    const [commerceState, sendToCommerce, actorRef] = useMachine(commerceMachine, {
        snapshot: rehydratedState,
    });

    // 3. Subscription Logic: Automatically save every state change.
    useEffect(() => {
        if (!actorRef) return;
        const subscription = actorRef.subscribe((snapshot) => {
            // Don't persist error states
            if (snapshot.matches('failure')) {
                localStorage.removeItem(COMMERCE_STORAGE_KEY);
                return;
            }
            // Persist only the serializable parts of the state
            const stateToPersist = {
                value: snapshot.value,
                context: snapshot.context,
            };
            localStorage.setItem(COMMERCE_STORAGE_KEY, JSON.stringify(stateToPersist));
        });
        return () => subscription.unsubscribe();
    }, [actorRef]);

    const navigate = useNavigate();
    const location = useLocation();

    // ===== HEADER BUTTON VISIBILITY =====
    const [showBackButton, setShowBackButton] = useState(false);

    useEffect(() => {
        // Show back button on product pages (/product/:id)
        const isProductPage = location.pathname.startsWith('/product/');
        setShowBackButton(isProductPage);
    }, [location.pathname]);

    // ===== NAVIGATION HELPERS =====
    const goBack = useCallback(() => {
        // Go back in history
        sendToCommerce({ type: 'BACK' });
        navigate(-1);
    }, [sendToCommerce, navigate]);

    const resetFlow = useCallback(() => {
        sendToCommerce({ type: 'RESET' });
        localStorage.removeItem(COMMERCE_STORAGE_KEY);
        navigate('/');
    }, [sendToCommerce, navigate]);

    const contextValue = useMemo(() => ({ 
        // State & Send
        commerceState, 
        sendToCommerce,
        
        // UI state for header
        showBackButton,
        
        // Navigation helpers
        goBack,
        resetFlow,
    }), [
        commerceState, 
        sendToCommerce,
        showBackButton,
        goBack,
        resetFlow,
    ]);

    return (
        <LayoutContext.Provider value={contextValue}>
            {children}
        </LayoutContext.Provider>
    );
};
