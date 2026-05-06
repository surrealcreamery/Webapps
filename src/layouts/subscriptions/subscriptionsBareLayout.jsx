import React from 'react';
import { Outlet } from "react-router-dom";
import Header from "@/components/header/subscriptions/subscriptionsHeader";
import Footer from "@/components/footer/subscriptions/subscriptionsFooter";

/**
 * SubscriptionsBareLayout - Subscriptions with its own DBC header/footer
 * Used when Subscriptions is embedded within Commerce app
 * Note: SubscriptionLayoutProvider is at root level (PublicRootLayout) so header can access it
 */
const SubscriptionsBareLayout = () => {
    return (
        <>
            <Header />
            <Outlet />
            <Footer />
        </>
    );
};

export default SubscriptionsBareLayout;
