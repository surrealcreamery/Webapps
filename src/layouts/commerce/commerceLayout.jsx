import React from 'react';
import { Outlet } from "react-router-dom";
import Header from "@/components/header/commerce/commerceHeader";
import Footer from "@/components/footer/commerce/commerceFooter";

const CommerceLayout = () => {
    // This component's only job is to provide the page structure.
    // It should NOT contain any providers, state, or logic.
    return (
        <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
            <Header />
            <main style={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
                <Outlet />
            </main>
            <Footer />
        </div>
    );
};

export default CommerceLayout;
