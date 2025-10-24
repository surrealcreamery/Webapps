import React, { createContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useMachine } from '@xstate/react';
import { wizardMachine } from '@/state/subscription/subscriptionMachine';
import { useNavigate } from 'react-router-dom';

export const LayoutContext = createContext(null);

export const LayoutProvider = ({ children }) => {
    const [current, send] = useMachine(wizardMachine);
    const [showRedeemButton, setShowRedeemButton] = useState(false);
    const isAuthenticated = current.context.isReauthenticated;
    const navigate = useNavigate();

    console.log('%c[LayoutProvider] Rendering. Current state machine value:', 'color: #03a9f4', current.value);
    
    // ✅ FIX: Wrap functions in useCallback to stabilize their references
    const login = useCallback((cid) => {
        if (!cid) {
            console.error('[LayoutProvider] login() called with an invalid CID. Aborting.');
            return;
        }
        send({ type: 'LOGIN_SUCCESS', customerId: cid }); 
    }, [send]);

    const logout = useCallback(() => {
        send({ type: 'LOGOUT' });
        navigate('/');
    }, [send, navigate]);
    
    const resetWizardFlow = useCallback(() => {
        send({ type: 'RESET_FLOW' });
    }, [send]);

    // ✅ FIX: Wrap the context value object in useMemo to stabilize its reference
    const contextValue = useMemo(() => ({ 
        isAuthenticated, 
        showRedeemButton, 
        setShowRedeemButton,
        login,
        logout,
        resetWizardFlow,
        wizardState: current,
        sendToWizard: send,
    }), [isAuthenticated, showRedeemButton, login, logout, resetWizardFlow, current, send]);

    return (
        <LayoutContext.Provider value={contextValue}>
            {children}
        </LayoutContext.Provider>
    );
};