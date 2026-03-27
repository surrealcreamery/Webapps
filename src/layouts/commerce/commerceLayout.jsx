import React, { useContext } from 'react';
import { Outlet, useLocation } from "react-router-dom";
import Header from "@/components/header/commerce/commerceHeader";
import Footer from "@/components/footer/commerce/commerceFooter";
import { CateringLayoutContext } from '@/contexts/catering/CateringLayoutContext';

const CommerceLayout = () => {
    const location = useLocation();
    // Access catering context to check if we're in a packaging flow
    const cateringContext = useContext(CateringLayoutContext);
    const selectedPackaging = cateringContext?.cateringState?.context?.selectedPackaging;

    // Check if we're on the catering page
    const isOnCateringPage = location.pathname === '/catering' || location.pathname === '/catering/';

    // Check if we're on a page where Commerce.jsx renders its own footer
    const isOnDessertsPage = location.pathname === '/desserts' || location.pathname === '/desserts/' || location.pathname === '/' || location.pathname === '/shop' || location.pathname === '/shop/' || location.pathname === '/collectibles' || location.pathname === '/collectibles/' || location.pathname.startsWith('/category/') || location.pathname.startsWith('/product/');

    // Full-screen pages — hide both header and footer
    const isFullScreenPage = location.pathname === '/delivery-check';

    // Hide footer:
    // - On desserts/shop pages (footer is in the mobile swiper)
    // - On catering packaging flow
    // - On full-screen pages
    const isCheckoutPage = location.pathname === '/checkout';
    const hideFooter = isFullScreenPage || isCheckoutPage || isOnDessertsPage || (isOnCateringPage && selectedPackaging && selectedPackaging.slotCount > 0);

    // Debug logging
    console.log('[CommerceLayout] Footer visibility:', {
        isOnCateringPage,
        isOnDessertsPage,
        selectedPackaging: selectedPackaging?.name,
        slotCount: selectedPackaging?.slotCount,
        hideFooter
    });

    return (
        <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
            {!isFullScreenPage && <Header />}
            <main style={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
                <Outlet />
            </main>
            {!hideFooter && <Footer />}
        </div>
    );
};

export default CommerceLayout;
