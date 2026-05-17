import React from 'react';
import { Outlet } from "react-router-dom";
import Header from "@/components/header/commerce/commerceHeader";

const KioskLayout = () => {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
            <Header />
            <main style={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
                <Outlet />
            </main>
        </div>
    );
};

export default KioskLayout;
