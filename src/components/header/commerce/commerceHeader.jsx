import React, { useContext, useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button, Box, Typography, IconButton, Avatar } from '@mui/material';
import ShoppingBagIcon from '@mui/icons-material/ShoppingBag';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import Logo from '@/assets/images/svg/logo.svg';
import { LayoutContext } from '@/contexts/commerce/CommerceLayoutContext';
import { useShopify } from '@/contexts/commerce/ShopifyContext_GraphQL';
import { CateringLayoutContext } from '@/contexts/catering/CateringLayoutContext';
import { LocationModal } from '@/components/commerce/LocationModal';
import { getDefaultLocations } from '@/components/commerce/shopifyLocations';
import { initializeLocationSelection } from '@/components/commerce/geolocation';

// Get locations (will be replaced with API call)
const LOCATIONS = getDefaultLocations();

// Navigation items
const NAV_ITEMS = [
    { label: 'Shop', path: '/shop', external: false },
    { label: 'Events', path: 'https://events.surrealcreamery.com', external: true },
    { label: 'Subscriptions', path: 'https://www.dollarbobaclub.com', external: true },
    { label: 'Catering', path: '/catering', external: false },
];

// Helper function to get initials from contact info
const getInitials = (contactInfo) => {
    if (!contactInfo) return '?';
    const firstName = contactInfo?.firstName || '';
    const lastName = contactInfo?.lastName || '';
    const firstInitial = firstName.charAt(0).toUpperCase();
    const lastInitial = lastName.charAt(0).toUpperCase();

    if (firstInitial && lastInitial) return `${firstInitial}${lastInitial}`;
    if (firstInitial) return firstInitial;
    if (contactInfo?.email) return contactInfo.email.charAt(0).toUpperCase();
    return '?';
};

const Header = () => {
    const navigate = useNavigate();
    const location = useLocation();

    // Commerce context (always available)
    const {
        showBackButton: commerceShowBackButton,
        goBack: commerceGoBack,
        sendToCommerce
    } = useContext(LayoutContext);
    const { checkout } = useShopify();

    // Catering context (only available on /catering routes)
    const cateringContext = useContext(CateringLayoutContext);

    // Determine if we're in catering mode
    const isCateringMode = location.pathname.startsWith('/catering');

    // Extract catering state if available
    const cateringState = cateringContext?.cateringState;
    const sendToCatering = cateringContext?.sendToCatering;
    const cateringCart = cateringState?.context?.cart || [];
    const isAuthenticated = cateringState?.context?.isAuthenticated || false;
    const contactInfo = cateringState?.context?.contactInfo;

    // Location selection state
    const [selectedLocation, setSelectedLocation] = useState(() => {
        return localStorage.getItem('selectedLocation') || null;
    });
    const [locationModalOpen, setLocationModalOpen] = useState(false);

    // Determine active nav item based on current path
    const getActiveNavItem = () => {
        const currentPath = location.pathname;

        // Catering paths
        if (currentPath.startsWith('/catering')) {
            return '/catering';
        }

        // Shop includes root, desserts and merchandise
        if (currentPath === '/' ||
            currentPath === '/shop' ||
            currentPath.startsWith('/shop/') ||
            currentPath === '/desserts' ||
            currentPath.startsWith('/desserts/') ||
            currentPath === '/merchandise' ||
            currentPath.startsWith('/merchandise/')) {
            return '/shop';
        }

        const activeItem = NAV_ITEMS.find(item =>
            !item.external && (currentPath === item.path || currentPath.startsWith(item.path + '/'))
        );
        return activeItem?.path || null;
    };

    // Auto-detect location on first visit
    useEffect(() => {
        const detectLocation = async () => {
            if (!localStorage.getItem('selectedLocation')) {
                const nearestStore = await initializeLocationSelection(LOCATIONS);
                if (nearestStore) {
                    setSelectedLocation(nearestStore.id);
                }
            }
        };
        detectLocation();
    }, []);

    // Calculate cart item counts
    const commerceCartCount = checkout?.lineItems?.reduce((total, item) => total + item.quantity, 0) || 0;
    const cateringCartCount = cateringCart.reduce((sum, item) => sum + item.quantity, 0);
    const totalItems = isCateringMode ? cateringCartCount : commerceCartCount;

    // Determine which back button behavior to use
    // Catering uses breadcrumbs instead of back button
    const shouldShowBackButton = isCateringMode ? false : commerceShowBackButton;

    // Determine if we should show account button (catering only for now)
    const showAccountButton = isCateringMode &&
        !cateringState?.matches('viewingCart') &&
        !cateringState?.matches('checkoutPlaceholder') &&
        !cateringState?.matches('guestCheckoutFlow') &&
        !cateringState?.matches('loginFlow') &&
        !cateringState?.matches('viewingOrders');

    // Check if on orders page (for log out button)
    const isOnOrdersPage = isCateringMode && cateringState?.matches('viewingOrders');

    // Determine if cart should be shown
    const showCartButton = isCateringMode
        ? !cateringState?.matches('viewingCart') &&
          !cateringState?.matches('checkoutPlaceholder') &&
          !cateringState?.matches('guestCheckoutFlow') &&
          !cateringState?.matches('loginFlow') &&
          !cateringState?.matches('viewingOrders') &&
          totalItems > 0
        : totalItems > 0;

    // Show location selector in commerce mode, or in catering mode only on the availability page
    const showLocationSelector = !isCateringMode || cateringState?.context?.showingAvailabilityPage;

    const handleLogoClick = (e) => {
        e.preventDefault();
        if (isCateringMode && sendToCatering) {
            sendToCatering({ type: 'GO_TO_BROWSING' });
        } else {
            sendToCommerce({ type: 'RESET' });
            navigate('/');
        }
    };

    const handleCartClick = () => {
        if (isCateringMode && sendToCatering) {
            sendToCatering({ type: 'VIEW_CART' });
        } else {
            sendToCommerce({ type: 'OPEN_CART' });
        }
    };

    const handleBackClick = () => {
        if (isCateringMode && sendToCatering) {
            sendToCatering({ type: 'GO_BACK' });
        } else {
            commerceGoBack();
        }
    };

    const handleAccountClick = () => {
        if (isCateringMode && sendToCatering) {
            sendToCatering({ type: 'VIEW_ACCOUNT' });
        }
    };

    const handleLogOut = () => {
        if (sendToCatering) {
            sendToCatering({ type: 'RESET' });
        }
    };

    const handleLocationClick = () => {
        setLocationModalOpen(true);
    };

    const handleLocationChange = (locationId) => {
        setSelectedLocation(locationId);
        localStorage.setItem('selectedLocation', locationId);
    };

    const handleNavClick = (item) => {
        if (item.external) {
            window.location.href = item.path;
        } else {
            // Reset catering state when navigating away from catering
            if (isCateringMode && !item.path.startsWith('/catering')) {
                // Navigating away from catering to commerce
                navigate(item.path);
            } else if (!isCateringMode && item.path.startsWith('/catering')) {
                // Navigating from commerce to catering
                navigate(item.path);
            } else {
                navigate(item.path);
            }
        }
    };

    const activeNavPath = getActiveNavItem();
    const userInitials = isAuthenticated ? getInitials(contactInfo) : '';
    const avatarSize = 40;

    return (
        <>
            <style>{`
                .header { padding-top: 0 !important; padding-bottom: 0 !important; }
            `}</style>

            <header
                className="header"
                role="banner"
                aria-label="Site header"
            >
                {/* Navigation Bar - hide for catering */}
                {!isCateringMode && (
                    <Box
                        component="nav"
                        role="navigation"
                        aria-label="Main navigation"
                        sx={{
                            backgroundColor: '#000',
                            width: '100vw',
                            marginLeft: 'calc(-50vw + 50%)',
                            py: 1,
                            px: 2,
                        }}
                    >
                        <Box
                            sx={{
                                maxWidth: '600px',
                                margin: '0 auto',
                                display: 'flex',
                                justifyContent: 'center',
                                gap: 0.5,
                                flexWrap: 'nowrap',
                            }}
                        >
                            {NAV_ITEMS.map((item) => {
                                const isActive = !item.external && activeNavPath === item.path;
                                return (
                                    <Button
                                        key={item.path}
                                        onClick={() => handleNavClick(item)}
                                        sx={{
                                            color: isActive ? '#000' : '#fff',
                                            backgroundColor: isActive ? '#fff' : 'transparent',
                                            textTransform: 'none',
                                            px: 1.5,
                                            py: 0.5,
                                            borderRadius: '4px',
                                            minWidth: 'auto',
                                            lineHeight: 1.2,
                                            '&:hover': {
                                                backgroundColor: isActive ? '#fff' : 'rgba(255,255,255,0.1)',
                                            },
                                        }}
                                    >
                                        <Typography
                                            sx={{
                                                fontSize: { xs: '1.4rem !important', sm: '1.6rem !important' },
                                                fontWeight: isActive ? 600 : 400,
                                                lineHeight: 1.2,
                                                whiteSpace: 'nowrap',
                                            }}
                                        >
                                            {item.label}
                                        </Typography>
                                    </Button>
                                );
                            })}
                        </Box>
                    </Box>
                )}

                <div className="shell">
                    <div style={{ maxWidth: '600px', margin: '0 auto' }}>
                        {/* 3-column CSS Grid layout */}
                        <div className="header__inner" style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center' }}>

                            {/* Left column - placeholder for grid alignment */}
                            <div style={{ justifySelf: 'start', display: 'flex', alignItems: 'center', gap: 8 }}>
                            </div>

                            {/* Center column - Logo */}
                            <div className="header__logo" style={{ justifySelf: 'center' }}>
                                <a href="/" onClick={handleLogoClick}>
                                    <img src={Logo} alt="Surreal Creamery Logo" style={{ display: 'block', height: '128px', width: 'auto' }} />
                                </a>
                            </div>

                            {/* Right column - Account and Cart */}
                            <div className="header__actions" style={{ justifySelf: 'end', display: 'flex', alignItems: 'center', gap: 8, minWidth: '48px' }}>

                                {/* Log Out button (catering orders page) */}
                                {isOnOrdersPage && (
                                    <Button
                                        variant="outlined"
                                        onClick={handleLogOut}
                                        sx={{
                                            color: 'black',
                                            borderColor: 'black',
                                            backgroundColor: 'white',
                                            textTransform: 'none',
                                            fontWeight: 'bold',
                                            padding: '6px 16px',
                                            '&:hover': {
                                                borderColor: 'black',
                                                backgroundColor: 'rgba(0, 0, 0, 0.04)',
                                            }
                                        }}
                                    >
                                        Log Out
                                    </Button>
                                )}

                                {/* Account Icon/Avatar (catering) */}
                                {showAccountButton && (
                                    <IconButton color="inherit" onClick={handleAccountClick} aria-label="Account">
                                        {isAuthenticated ? (
                                            <Avatar
                                                sx={{
                                                    backgroundColor: 'black',
                                                    color: 'white',
                                                    width: avatarSize,
                                                    height: avatarSize,
                                                    fontSize: '1.7rem',
                                                }}
                                            >
                                                {userInitials}
                                            </Avatar>
                                        ) : (
                                            <AccountCircleIcon sx={{ fontSize: avatarSize, color: 'black' }} />
                                        )}
                                    </IconButton>
                                )}

                                {/* Cart Button */}
                                {showCartButton && (
                                    <Button
                                        variant="contained"
                                        onClick={handleCartClick}
                                        aria-label="View Cart"
                                        sx={{
                                            backgroundColor: 'black',
                                            color: 'white',
                                            borderRadius: '50px',
                                            textTransform: 'none',
                                            padding: '6px 16px',
                                            boxShadow: 'none',
                                            '&:hover': {
                                                backgroundColor: '#333',
                                                boxShadow: 'none',
                                            }
                                        }}
                                    >
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                            <ShoppingBagIcon sx={{ color: 'white' }} />
                                            <Typography variant="body1" sx={{ fontWeight: 'bold', color: 'white' }}>
                                                {totalItems}
                                            </Typography>
                                        </Box>
                                    </Button>
                                )}
                            </div>
                        </div>

                        {/* Location Selector - Only in commerce mode */}
                        {showLocationSelector && (
                            <Box
                                sx={{
                                    mt: 0,
                                    mb: 2,
                                    display: 'flex',
                                    justifyContent: 'center',
                                    cursor: 'pointer'
                                }}
                                onClick={handleLocationClick}
                            >
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <Typography variant="body1" sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}>
                                        {selectedLocation
                                            ? LOCATIONS.find(loc => loc.id === selectedLocation)?.name
                                            : 'Select a Location'
                                        }
                                    </Typography>
                                    <KeyboardArrowDownIcon sx={{ fontSize: 24, color: 'text.secondary' }} />
                                </Box>
                            </Box>
                        )}

                        {/* Location Modal */}
                        <LocationModal
                            open={locationModalOpen}
                            onClose={() => setLocationModalOpen(false)}
                            selectedLocationId={selectedLocation}
                            onSelectLocation={handleLocationChange}
                            locations={LOCATIONS}
                        />

                    </div>
                </div>
            </header>
        </>
    );
};

export default Header;
