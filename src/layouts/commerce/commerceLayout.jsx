import React, { useContext, useEffect, useRef, useState } from 'react';
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { Snackbar, Alert } from '@mui/material';
import Header from "@/components/header/commerce/commerceHeader";
import Footer from "@/components/footer/commerce/commerceFooter";
import { CateringLayoutContext } from '@/contexts/catering/CateringLayoutContext';
import NotificationBanner from '@/components/commerce/NotificationBanner';
import JsonLd from '@/components/seo/JsonLd';
import { buildOrganizationSchema, buildWebSiteSchema } from '@/components/seo/schemas';

const CommerceLayout = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const keyBuffer = useRef('');
    const keyTimer = useRef(null);
    const [testSnack, setTestSnack] = useState(null);

    // Clear stale checkout confirmation when user navigates away from checkout
    useEffect(() => {
        if (location.pathname !== '/checkout' && sessionStorage.getItem('checkoutConfirmation')) {
            sessionStorage.removeItem('checkoutConfirmation');
        }
    }, [location.pathname]);

    // Secret "test" keyword toggle — type "test" anywhere to toggle test mode
    useEffect(() => {
        const onKeyDown = (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return;
            clearTimeout(keyTimer.current);
            keyBuffer.current += e.key.toLowerCase();
            keyTimer.current = setTimeout(() => { keyBuffer.current = ''; }, 1500);
            if (keyBuffer.current.endsWith('test')) {
                keyBuffer.current = '';
                const current = localStorage.getItem('testModeEnabled') === 'true';
                localStorage.setItem('testModeEnabled', String(!current));
                window.dispatchEvent(new Event('testModeChanged'));
                setTestSnack(!current ? 'Test mode enabled' : 'Test mode disabled');
            }
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, []);

    // Listen for test mode toggled from menu tap zone
    useEffect(() => {
        const handler = (e) => setTestSnack(e.detail?.message || 'Test mode toggled');
        window.addEventListener('testModeToggled', handler);
        return () => window.removeEventListener('testModeToggled', handler);
    }, []);

    // Access catering context to check if we're in a packaging flow
    const cateringContext = useContext(CateringLayoutContext);
    const selectedPackaging = cateringContext?.cateringState?.context?.selectedPackaging;

    // Check if we're on the catering page
    const isOnCateringPage = location.pathname === '/catering' || location.pathname === '/catering/';

    // Check if we're on a page where Commerce.jsx renders its own footer
    const isOnDessertsPage = location.pathname === '/desserts' || location.pathname === '/desserts/' || location.pathname === '/' || location.pathname === '/shop' || location.pathname === '/shop/' || location.pathname === '/collectibles' || location.pathname === '/collectibles/' || location.pathname.startsWith('/category/') || location.pathname.startsWith('/product/');

    // Full-screen pages — hide both header and footer
    const isFullScreenPage = location.pathname === '/delivery-check';

    // Subscriptions has its own header/footer
    const isSubscriptionsPage = location.pathname.startsWith('/subscriptions');

    // Hide footer:
    // - On desserts/shop pages (footer is in the mobile swiper)
    // - On catering packaging flow
    // - On full-screen pages
    const isCheckoutPage = location.pathname === '/checkout';
    const hideFooter = isFullScreenPage || isCheckoutPage || isSubscriptionsPage || isOnDessertsPage || (isOnCateringPage && selectedPackaging && selectedPackaging.slotCount > 0);

    // Debug logging
    console.log('[CommerceLayout] Footer visibility:', {
        isOnCateringPage,
        isOnDessertsPage,
        selectedPackaging: selectedPackaging?.name,
        slotCount: selectedPackaging?.slotCount,
        hideFooter
    });

    return (
        <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', minWidth: 0 }}>
            <JsonLd data={buildOrganizationSchema()} />
            <JsonLd data={buildWebSiteSchema()} />
            <NotificationBanner />
            {!isFullScreenPage && !isSubscriptionsPage && <Header />}
            <main style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflowX: 'hidden' }}>
                <Outlet />
            </main>
            {!hideFooter && <Footer />}
            <Snackbar open={!!testSnack} autoHideDuration={2000} onClose={() => setTestSnack(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
                <Alert severity="info" variant="filled" onClose={() => setTestSnack(null)}>{testSnack}</Alert>
            </Snackbar>
        </div>
    );
};

export default CommerceLayout;
