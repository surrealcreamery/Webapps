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

    // Show footer ONLY on /catering main page when no packaging is selected
    // Hide footer when in catering packaging flow (Cookie Tray, Cake Jar Box, etc.)
    const hideFooter = isOnCateringPage && selectedPackaging && selectedPackaging.slotCount > 0;

    // Debug logging
    console.log('[CommerceLayout] Footer visibility:', {
        isOnCateringPage,
        selectedPackaging: selectedPackaging?.name,
        slotCount: selectedPackaging?.slotCount,
        hideFooter
    });

    return (
        <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
            <Header />
            <main style={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
                <Outlet />
            </main>
            {!hideFooter && <Footer />}
        </div>
    );
};

export default CommerceLayout;
