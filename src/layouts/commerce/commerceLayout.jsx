import React, { useContext } from 'react';
import { Outlet } from "react-router-dom";
import Header from "@/components/header/commerce/commerceHeader";
import Footer from "@/components/footer/commerce/commerceFooter";
import { CateringLayoutContext } from '@/contexts/catering/CateringLayoutContext';

const CommerceLayout = () => {
    // Access catering context to check if we're in a packaging flow
    const cateringContext = useContext(CateringLayoutContext);
    const selectedPackaging = cateringContext?.cateringState?.context?.selectedPackaging;

    // Hide footer when in catering packaging flow (Cookie Tray, Cake Jar Box, etc.)
    const hideFooter = selectedPackaging && selectedPackaging.slotCount > 0;

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
