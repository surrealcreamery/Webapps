import React from 'react';
import { Outlet } from "react-router-dom";
import Header from "@/components/header/catering/cateringHeader";
import Footer from "@/components/footer/catering/cateringFooter";

// ✅ The import is now correct, using 'LayoutProvider'
import { LayoutProvider as CateringLayoutProvider } from '@/contexts/catering/CateringLayoutContext';

const CateringLayout = () => {
    // This component now also wraps the layout with the specific context provider.
    return (
        <CateringLayoutProvider>
            <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
                <Header />
                <main style={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
                    <Outlet />
                </main>
                <Footer />
            </div>
        </CateringLayoutProvider>
    );
};

export default CateringLayout;

