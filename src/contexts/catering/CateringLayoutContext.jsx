import React, { createContext, useMemo } from 'react';
import { useMachine } from '@xstate/react';
import { cateringMachine } from '@/state/catering/cateringMachine';

export const CateringLayoutContext = createContext(null);

export const LayoutProvider = ({ children }) => {
    const [cateringState, sendToCatering] = useMachine(cateringMachine);

    // ✅ FIX: The context value is wrapped in useMemo to stabilize its reference.
    // This prevents unnecessary re-renders in consumer components and ensures
    // they always have the latest state and dispatcher function.
    const contextValue = useMemo(() => ({
        cateringState,
        sendToCatering
    }), [cateringState, sendToCatering]);

    // Log for debugging
    console.log('%c[CateringLayoutContext] Rendering. Current state:', 'color: #03a9f4', cateringState.value);

    return (
        <CateringLayoutContext.Provider value={contextValue}>
            {children}
        </CateringLayoutContext.Provider>
    );
};

