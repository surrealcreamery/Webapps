import React from 'react';
import { Outlet } from "react-router-dom";

/**
 * CateringBareLayout - Catering layout WITHOUT header/footer
 * Used when Catering is embedded within Commerce app (uses Commerce header/footer)
 * Note: CateringLayoutProvider is now at root level (PublicRootLayout) so header can access it
 */
const CateringBareLayout = () => {
    return <Outlet />;
};

export default CateringBareLayout;
