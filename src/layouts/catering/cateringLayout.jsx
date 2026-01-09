import React from 'react';
import { Outlet } from "react-router-dom";
import Header from "@/components/header/catering/cateringHeader";

// ✅ The import is now correct, using 'LayoutProvider'
import { LayoutProvider as CateringLayoutProvider } from '@/contexts/catering/CateringLayoutContext';

// Inner component - Footer is now controlled by individual pages/components
const CateringLayoutInner = () => {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
            <Header />
            <main style={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
                <Outlet />
            </main>
        </div>
    );
};

const CateringLayout = () => {
    return (
        <CateringLayoutProvider>
            <CateringLayoutInner />
        </CateringLayoutProvider>
    );
};

export default CateringLayout;

