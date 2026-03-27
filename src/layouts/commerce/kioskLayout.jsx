import React from 'react';
import { Outlet } from "react-router-dom";
import KioskHeader from "@/components/header/commerce/kioskHeader";

const KioskLayout = () => {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
            <KioskHeader />
            <main style={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
                <Outlet />
            </main>
        </div>
    );
};

export default KioskLayout;
