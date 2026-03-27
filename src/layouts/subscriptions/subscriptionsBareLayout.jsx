import React from 'react';
import { Outlet } from "react-router-dom";

/**
 * SubscriptionsBareLayout - Subscriptions layout WITHOUT header/footer
 * Used when Subscriptions is embedded within Commerce app (uses Commerce header/footer)
 * Note: SubscriptionLayoutProvider is at root level (PublicRootLayout) so header can access it
 */
const SubscriptionsBareLayout = () => {
    return <Outlet />;
};

export default SubscriptionsBareLayout;
