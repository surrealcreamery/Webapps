import React from 'react';
import { Outlet } from "react-router-dom";

/**
 * EventsBareLayout - Events layout WITHOUT header/footer
 * Used when Events is embedded within Commerce app (uses Commerce header/footer)
 * Note: EventsLayoutProvider is at root level (PublicRootLayout) so header can access it
 */
const EventsBareLayout = () => {
    return <Outlet />;
};

export default EventsBareLayout;
