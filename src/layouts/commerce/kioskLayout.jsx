import React from 'react';
import { Outlet } from "react-router-dom";
import Header from "@/components/header/commerce/commerceHeader";
import SkipToContent from '@/components/skip-to-content/skip-to-content';

const KioskLayout = () => {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
            <SkipToContent />
            <Header />
            <main id="skip-to-content" style={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
                <Outlet />
            </main>
        </div>
    );
};

export default KioskLayout;
