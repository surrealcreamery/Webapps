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
            // If loading a product URL, clear stale modal state so the URL's product takes over
            if (window.location.pathname.startsWith('/product/')) {
                parsed.context.selectedProductId = null;
                parsed.context.showProductModal = false;
                parsed.context.feedActive = false;
                parsed.value = { commerce: 'idle' };
            }
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

    // ===== ACTIVE TEXT COLOR (for swiper pages) =====
    // This allows the current product's text color to be passed to header components
    const [activeTextColor, setActiveTextColor] = useState('black');

    // ===== KIOSK CART COUNT (for header badge in paired kiosk mode) =====
    const [kioskCartCount, setKioskCartCount] = useState(0);

    // ===== KIOSK VIEW MODE (slideshow vs grid) =====
    const [kioskViewMode, setKioskViewMode] = useState('slideshow');

    // ===== LOCAL CART COUNT (for header badge in normal web mode) =====
    const [cartCount, setCartCount] = useState(0);

    // ===== PRODUCT DETAIL MODE =====
    // When true, header hides nav bar and shows close button instead of Menu
    // Always start false — Commerce.jsx will set it when entering product detail
    const [isProductDetail, setIsProductDetail] = useState(false);
    const [onCloseProductDetail, setOnCloseProductDetail] = useState(null);

    // ===== EFFECTIVE PATH OVERRIDE =====
    // When set, header uses this instead of location.pathname for nav highlighting.
    // Used when replaceState updates the URL but React Router doesn't know about it.
    const [effectivePath, setEffectivePath] = useState(null);

    useEffect(() => {
        // Show back button on product pages (/product/:id)
        const isProductPage = location.pathname.startsWith('/product/');
        setShowBackButton(isProductPage);
    }, [location.pathname]);

    // Auto-clear effectivePath when React Router navigates to a non-product page.
    // This handles edge cases like browser back/forward that bypass handleCloseProduct.
    useEffect(() => {
        if (effectivePath && !location.pathname.startsWith('/product/')) {
            setEffectivePath(null);
        }
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
        navigate('/desserts');
    }, [sendToCommerce, navigate]);

    const contextValue = useMemo(() => ({
        // State & Send
        commerceState,
        sendToCommerce,

        // UI state for header
        showBackButton,

        // Active text color for swiper pages (set by Commerce, read by Header)
        activeTextColor,
        setActiveTextColor,

        // Product detail mode (hides nav, turns Menu into X)
        isProductDetail,
        setIsProductDetail,
        onCloseProductDetail,
        setOnCloseProductDetail,

        // Kiosk cart count (for header badge)
        kioskCartCount,
        setKioskCartCount,

        // Kiosk view mode (slideshow vs grid)
        kioskViewMode,
        setKioskViewMode,

        // Local cart count (for header badge in normal web mode)
        cartCount,
        setCartCount,

        // Effective path override (for header nav when replaceState bypasses React Router)
        effectivePath,
        setEffectivePath,

        // Navigation helpers
        goBack,
        resetFlow,
    }), [
        commerceState,
        sendToCommerce,
        showBackButton,
        activeTextColor,
        isProductDetail,
        onCloseProductDetail,
        kioskCartCount,
        kioskViewMode,
        cartCount,
        effectivePath,
        goBack,
        resetFlow,
    ]);

    return (
        <LayoutContext.Provider value={contextValue}>
            {children}
        </LayoutContext.Provider>
    );
};
