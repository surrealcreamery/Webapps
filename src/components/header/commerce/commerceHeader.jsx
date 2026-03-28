import React, { useContext, useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Button, Box, Typography, IconButton, Avatar, ToggleButtonGroup, ToggleButton } from '@mui/material';
import ShoppingBagIcon from '@mui/icons-material/ShoppingBag';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import CloseIcon from '@mui/icons-material/Close';
import Logo from '@/assets/images/svg/logo.svg';
import { LayoutContext } from '@/contexts/commerce/CommerceLayoutContext';
import { CateringLayoutContext } from '@/contexts/catering/CateringLayoutContext';
import { LayoutContext as EventsLayoutContext } from '@/contexts/events/EventsLayoutContext';
import { LocationModal } from '@/components/commerce/LocationModal';
import { MenuDrawer } from '@/components/commerce/MenuDrawer';
import { getDefaultLocations } from '@/components/commerce/shopifyLocations';
import { initializeLocationSelection } from '@/components/commerce/geolocation';

const LOCATIONS_URL = 'https://data.surrealcreamery.com/locations.json';

// Navigation items
const NAV_ITEMS = [
    { label: 'Shop', path: '/shop', external: false },
    { label: 'Events', path: '/events', external: false },
    { label: 'Subscriptions', path: '/subscriptions', external: false },
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

    // Fetch locations from published JSON
    const [locations, setLocations] = useState(() => getDefaultLocations());
    const [locationsLoaded, setLocationsLoaded] = useState(false);
    useEffect(() => {
        fetch(LOCATIONS_URL)
            .then(res => res.json())
            .then(data => {
                if (Array.isArray(data) && data.length > 0) {
                    setLocations(data);
                }
                setLocationsLoaded(true);
            })
            .catch(err => {
                console.warn('[Header] Failed to fetch locations, using defaults:', err.message);
                setLocationsLoaded(true);
            });
    }, []);

    // Commerce context (always available)
    const {
        showBackButton: commerceShowBackButton,
        goBack: commerceGoBack,
        sendToCommerce,
        activeTextColor = 'black',
        isProductDetail = false,
        setIsProductDetail,
        onCloseProductDetail,
        kioskCartCount = 0,
        cartCount = 0,
        effectivePath = null,
    } = useContext(LayoutContext);

    // Debug log
    useEffect(() => {
        console.log('[Header] activeTextColor changed to:', activeTextColor);
    }, [activeTextColor]);

    // Catering context (only available on /catering routes)
    const cateringContext = useContext(CateringLayoutContext);

    // Events context (only available on /events routes)
    const eventsContext = useContext(EventsLayoutContext);

    // Determine if we're in catering or events mode
    const isCateringMode = location.pathname.startsWith('/catering');
    const isEventsMode = location.pathname.startsWith('/events');
    const isCheckoutPage = location.pathname === '/checkout';

    // Extract catering state if available
    const cateringState = cateringContext?.cateringState;
    const sendToCatering = cateringContext?.sendToCatering;
    const cateringCart = cateringState?.context?.cart || [];
    const isCateringAuthenticated = cateringState?.context?.isAuthenticated || false;
    const contactInfo = cateringState?.context?.contactInfo;

    // Extract events state if available
    const eventsState = eventsContext?.fundraiserState;
    const sendToEvents = eventsContext?.sendToFundraiser;
    const isEventsAuthenticated = eventsContext?.isAuthenticated || false;
    const eventsLogout = eventsContext?.logout;
    const showEventsLoginButton = eventsContext?.showLoginButton;
    const showEventsMyEventsButton = eventsContext?.showMyEventsButton;
    const showEventsLogoutButton = eventsContext?.showLogoutButton;

    // Unified auth state for display
    const isAuthenticated = isCateringMode ? isCateringAuthenticated : isEventsAuthenticated;

    // Location selection state
    const [selectedLocation, setSelectedLocation] = useState(() => {
        return localStorage.getItem('selectedLocation') || null;
    });
    const [locationModalOpen, setLocationModalOpen] = useState(false);
    const [menuDrawerOpen, setMenuDrawerOpen] = useState(false);

    // Determine active nav item based on current path
    const getActiveNavItem = () => {
        const currentPath = effectivePath || location.pathname;

        // Events paths
        if (currentPath.startsWith('/events')) {
            return '/events';
        }

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
            currentPath === '/collectibles' ||
            currentPath.startsWith('/collectibles/')) {
            return '/shop';
        }

        const activeItem = NAV_ITEMS.find(item =>
            !item.external && (currentPath === item.path || currentPath.startsWith(item.path + '/'))
        );
        return activeItem?.path || null;
    };

    // Auto-detect location on first visit (only after real locations are fetched)
    useEffect(() => {
        if (!locationsLoaded || !locations.length) return;
        const detectLocation = async () => {
            if (localStorage.getItem('selectedLocation')) return;
            try {
                console.log('[Header] Auto-detecting location...', locations.length, 'stores available');
                const nearestStore = await initializeLocationSelection(locations);
                const storeId = nearestStore?.id || locations[0].id;
                console.log('[Header] Selected store:', storeId, nearestStore?.distance ? `(${nearestStore.distanceText} away)` : '(fallback)');
                localStorage.setItem('selectedLocation', storeId);
                setSelectedLocation(storeId);
                window.dispatchEvent(new CustomEvent('locationChanged', { detail: { locationId: storeId } }));
            } catch (err) {
                console.error('[Header] Auto-detect failed, using first location:', err);
                const fallbackId = locations[0].id;
                localStorage.setItem('selectedLocation', fallbackId);
                setSelectedLocation(fallbackId);
                window.dispatchEvent(new CustomEvent('locationChanged', { detail: { locationId: fallbackId } }));
            }
        };
        detectLocation();
    }, [locationsLoaded, locations]);

    // Calculate cart item counts
    const commerceCartCount = kioskCartCount > 0 ? kioskCartCount : cartCount;
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

    // Show commerce account button on shop pages (not catering, events, checkout, subscriptions, or product detail)
    const isSubscriptionsMode = location.pathname.startsWith('/subscriptions');
    const isAccountPage = location.pathname === '/account';
    const showCommerceAccountButton = !isCateringMode && !isEventsMode && !isCheckoutPage && !isSubscriptionsMode && !isProductDetail && !isAccountPage;

    // Check if on orders page (for log out button)
    const isOnOrdersPage = isCateringMode && cateringState?.matches('viewingOrders');

    // Determine if cart should be shown (not in events mode - events has no cart)
    const showCartButton = !isEventsMode && !isProductDetail && (isCateringMode
        ? !cateringState?.matches('viewingCart') &&
          !cateringState?.matches('checkoutPlaceholder') &&
          !cateringState?.matches('guestCheckoutFlow') &&
          !cateringState?.matches('loginFlow') &&
          !cateringState?.matches('viewingOrders') &&
          totalItems > 0
        : !isAccountPage && totalItems > 0);

    // Show location selector in commerce mode, or in catering mode only on the availability page
    // Hide in events mode and account page
    const showLocationSelector = !isEventsMode && !isCheckoutPage && !isAccountPage && (!isCateringMode || cateringState?.context?.showingAvailabilityPage);

    const handleLogoClick = (e) => {
        e.preventDefault();
        if (isEventsMode && sendToEvents) {
            sendToEvents({ type: 'RESET' });
            navigate('/events');
        } else if (isCateringMode && sendToCatering) {
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
        window.dispatchEvent(new CustomEvent('locationChanged', { detail: { locationId } }));
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
    const navPath = effectivePath || location.pathname;
    const isShopSubcategory = activeNavPath === '/shop' && (
        navPath.startsWith('/desserts') || navPath.startsWith('/collectibles')
    );
    const SHOP_SUBCATEGORIES = [
        { label: 'Desserts', path: '/desserts' },
        { label: 'Collectibles', path: '/collectibles' },
    ];
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
                style={{
                    position: 'relative',
                    zIndex: 100,
                    transition: 'color 0.4s ease, border-color 0.4s ease, filter 0.4s ease',
                }}
            >
                {/* Navigation Bar - hidden in product detail */}
                <Box
                    component="nav"
                    role="navigation"
                    aria-label="Main navigation"
                    sx={{
                        backgroundColor: '#000',
                        width: '100vw',
                        display: (isProductDetail || isEventsMode || isCheckoutPage || isAccountPage) ? 'none' : 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginLeft: 'calc(-50vw + 50%)',
                        height: 40,
                        px: 2,
                    }}
                >
                    <Box
                        sx={{
                            maxWidth: '600px',
                            margin: '0 auto',
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center',
                            gap: 0.5,
                            flexWrap: 'nowrap',
                            overflow: 'hidden',
                        }}
                    >
                        {/* Shop pill — expands to contain toggle group when in subcategory */}
                        <Box
                            onClick={() => !isShopSubcategory && handleNavClick({ label: 'Shop', path: '/shop', external: false })}
                            sx={{
                                display: 'flex',
                                alignItems: 'center',
                                backgroundColor: (isShopSubcategory || activeNavPath === '/shop') ? '#fff' : 'transparent',
                                borderRadius: '6px',
                                cursor: !isShopSubcategory ? 'pointer' : 'default',
                                overflow: 'hidden',
                                p: '2px',
                                transition: 'background-color 0.25s ease',
                                '&:hover': !isShopSubcategory ? {
                                    backgroundColor: activeNavPath === '/shop' ? '#fff' : 'rgba(255,255,255,0.1)',
                                } : {},
                            }}
                        >
                            <Typography
                                onClick={(e) => { if (isShopSubcategory) { e.stopPropagation(); navigate('/desserts'); } }}
                                sx={{
                                    fontSize: { xs: '1.4rem', sm: '1.6rem' },
                                    fontWeight: 600,
                                    lineHeight: 1.2,
                                    whiteSpace: 'nowrap',
                                    px: 1.5,
                                    py: 0.5,
                                    color: (isShopSubcategory || activeNavPath === '/shop') ? '#000' : '#fff',
                                    cursor: isShopSubcategory ? 'pointer' : 'inherit',
                                    transition: 'color 0.25s ease',
                                    '&:hover': isShopSubcategory ? { opacity: 0.6 } : {},
                                }}
                            >
                                Shop
                            </Typography>
                            <AnimatePresence initial={false}>
                                {isShopSubcategory && (
                                    <motion.div
                                        key="shop-toggle"
                                        initial={effectivePath ? false : { width: 0, opacity: 0 }}
                                        animate={{ width: 'auto', opacity: 1 }}
                                        exit={{ width: 0, opacity: 0 }}
                                        transition={{ duration: effectivePath ? 0 : 0.25, ease: [0.4, 0, 0.2, 1] }}
                                        style={{ overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center' }}
                                    >
                                        <ToggleButtonGroup
                                            value={navPath.startsWith('/collectibles') ? '/collectibles' : '/desserts'}
                                            exclusive
                                            sx={{
                                                borderRadius: '4px',
                                                bgcolor: '#000',
                                                p: '2px',
                                                gap: '2px',
                                                '& .MuiToggleButtonGroup-grouped': {
                                                    border: 'none',
                                                },
                                            }}
                                        >
                                            {SHOP_SUBCATEGORIES.map((sub) => (
                                                <ToggleButton
                                                    key={sub.path}
                                                    value={sub.path}
                                                    onClick={() => navigate(sub.path)}
                                                    sx={{
                                                        textTransform: 'none',
                                                        color: '#fff',
                                                        px: 1.5,
                                                        py: '3px',
                                                        minHeight: 0,
                                                        lineHeight: 1.2,
                                                        fontSize: { xs: '1.4rem', sm: '1.6rem' },
                                                        whiteSpace: 'nowrap',
                                                        borderRadius: '3px !important',
                                                        '&.Mui-selected': {
                                                            bgcolor: '#fff',
                                                            color: '#000',
                                                            fontWeight: 600,
                                                            '&:hover': { bgcolor: '#fff' },
                                                        },
                                                        '&:hover': { bgcolor: 'rgba(255,255,255,0.15)' },
                                                    }}
                                                >
                                                    {sub.label}
                                                </ToggleButton>
                                            ))}
                                        </ToggleButtonGroup>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </Box>

                        {/* Other nav items — collapse when in subcategory */}
                        <AnimatePresence initial={false}>
                            {!isShopSubcategory && NAV_ITEMS.filter(item => item.path !== '/shop').map((item) => {
                                const isActive = !item.external && activeNavPath === item.path;
                                return (
                                    <motion.div
                                        key={item.path}
                                        initial={{ width: 0, opacity: 0 }}
                                        animate={{ width: 'auto', opacity: 1 }}
                                        exit={{ width: 0, opacity: 0 }}
                                        transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
                                        style={{ overflow: 'hidden', flexShrink: 0 }}
                                    >
                                        <Box
                                            onClick={() => handleNavClick(item)}
                                            sx={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                backgroundColor: isActive ? '#fff' : 'transparent',
                                                borderRadius: '6px',
                                                cursor: 'pointer',
                                                p: '2px',
                                                '&:hover': {
                                                    backgroundColor: isActive ? '#fff' : 'rgba(255,255,255,0.1)',
                                                },
                                            }}
                                        >
                                            <Typography sx={{
                                                fontSize: { xs: '1.4rem', sm: '1.6rem' },
                                                fontWeight: isActive ? 600 : 400,
                                                lineHeight: 1.2,
                                                whiteSpace: 'nowrap',
                                                px: 1.5,
                                                py: 0.5,
                                                color: isActive ? '#000' : '#fff',
                                            }}>
                                                {item.label}
                                            </Typography>
                                        </Box>
                                    </motion.div>
                                );
                            })}
                        </AnimatePresence>
                    </Box>
                </Box>

                <div className="shell">
                    <div style={{ maxWidth: '600px', margin: '0 auto' }}>
                        {/* 3-column CSS Grid layout */}
                        <div className="header__inner" style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center' }}>

                            {/* Left column - Menu button or Close button in product detail */}
                            <div style={{ justifySelf: 'start', display: 'flex', alignItems: 'center', gap: 8 }}>
                                {!isCateringMode && !isEventsMode && !isCheckoutPage && !isAccountPage && (
                                    isProductDetail ? null : (
                                        <Button
                                            onClick={() => setMenuDrawerOpen(true)}
                                            variant="outlined"
                                            sx={{
                                                color: `${activeTextColor} !important`,
                                                border: `1px solid ${activeTextColor} !important`,
                                                backgroundColor: 'transparent !important',
                                                textTransform: 'none',
                                                fontFamily: 'Outfit, sans-serif',
                                                fontWeight: 600,
                                                fontSize: '1.4rem',
                                                px: 2,
                                                py: 0.5,
                                                borderRadius: 2,
                                                transition: 'color 0.4s ease, border-color 0.4s ease',
                                                '&:hover': {
                                                    border: `1px solid ${activeTextColor} !important`,
                                                    backgroundColor: activeTextColor === 'white' || activeTextColor === '#ffffff'
                                                        ? 'rgba(255,255,255,0.1) !important'
                                                        : 'rgba(0,0,0,0.05) !important',
                                                },
                                            }}
                                        >
                                            Menu
                                        </Button>
                                    )
                                )}
                            </div>

                            {/* Center column - Logo and Location (hidden in product detail mode) */}
                            <div className="header__logo" style={{ justifySelf: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                {!isProductDetail && (
                                    <>
                                        <a href="/" onClick={handleLogoClick}>
                                            <img
                                                src={Logo}
                                                alt="Surreal Creamery Logo"
                                                style={{
                                                    display: 'block',
                                                    height: '128px',
                                                    width: 'auto',
                                                    filter: (activeTextColor === 'white' || activeTextColor === '#ffffff') ? 'brightness(0) invert(1)' : 'none',
                                                    transition: 'filter 0.4s ease'
                                                }}
                                            />
                                        </a>
                                        {/* Location Selector - directly under logo */}
                                        {showLocationSelector && (
                                            <Box
                                                role="button"
                                                tabIndex={0}
                                                aria-label={`Change store location. Currently: ${selectedLocation ? locations.find(loc => loc.id === selectedLocation)?.name : 'none selected'}`}
                                                aria-haspopup="dialog"
                                                sx={{
                                                    mt: -3,
                                                    display: 'flex',
                                                    justifyContent: 'center',
                                                    cursor: 'pointer',
                                                    '&:focus-visible': {
                                                        outline: '2px solid #1976d2',
                                                        outlineOffset: 2,
                                                        borderRadius: 1,
                                                    },
                                                }}
                                                onClick={handleLocationClick}
                                                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleLocationClick(); } }}
                                            >
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                    <Typography variant="body1" sx={{ fontWeight: 600, whiteSpace: 'nowrap', fontSize: '1.6rem', color: activeTextColor, transition: 'color 0.4s ease' }}>
                                                        {(selectedLocation && locations.find(loc => loc.id === selectedLocation)?.name) || 'Select a Location'}
                                                    </Typography>
                                                    <KeyboardArrowDownIcon aria-hidden="true" sx={{ fontSize: 22, color: activeTextColor === 'white' || activeTextColor === '#ffffff' ? 'rgba(255,255,255,0.7)' : 'text.secondary', transition: 'color 0.4s ease' }} />
                                                </Box>
                                            </Box>
                                        )}
                                    </>
                                )}
                            </div>

                            {/* Right column - Account and Cart (hidden on checkout) */}
                            <div className="header__actions" style={{ justifySelf: 'end', display: isCheckoutPage ? 'none' : 'flex', alignItems: 'center', gap: 8, minWidth: '48px' }}>

                                {/* Events: Login button */}
                                {isEventsMode && showEventsLoginButton && (
                                    <Button
                                        onClick={() => sendToEvents?.({ type: 'LOGIN_START' })}
                                        variant="outlined"
                                        sx={{
                                            color: `${activeTextColor} !important`,
                                            border: `1px solid ${activeTextColor} !important`,
                                            backgroundColor: 'transparent !important',
                                            textTransform: 'none',
                                            fontFamily: 'Outfit, sans-serif',
                                            fontWeight: 600,
                                            fontSize: '1.4rem',
                                            px: 2,
                                            py: 0.5,
                                            borderRadius: 2,
                                            transition: 'color 0.4s ease, border-color 0.4s ease',
                                            '&:hover': {
                                                border: `1px solid ${activeTextColor} !important`,
                                                backgroundColor: activeTextColor === 'white' || activeTextColor === '#ffffff'
                                                    ? 'rgba(255,255,255,0.1) !important'
                                                    : 'rgba(0,0,0,0.05) !important',
                                            },
                                        }}
                                    >
                                        Log In
                                    </Button>
                                )}

                                {/* Events: My Events button */}
                                {isEventsMode && showEventsMyEventsButton && (
                                    <Button
                                        variant="outlined"
                                        onClick={() => sendToEvents?.({ type: 'GO_TO_DASHBOARD' })}
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
                                        My Events
                                    </Button>
                                )}

                                {/* Events: Logout button */}
                                {isEventsMode && showEventsLogoutButton && (
                                    <Button
                                        variant="outlined"
                                        onClick={eventsLogout}
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

                                {/* Account page: Log Out button */}
                                {isAccountPage && sessionStorage.getItem('accountSession') && (
                                    <Button
                                        variant="outlined"
                                        onClick={() => {
                                            sessionStorage.removeItem('accountSession');
                                            window.dispatchEvent(new CustomEvent('accountLogout'));
                                        }}
                                        sx={{
                                            color: 'black', borderColor: 'black', textTransform: 'none', fontWeight: 600,
                                            padding: '6px 16px',
                                            '&:hover': { borderColor: 'black', backgroundColor: 'rgba(0,0,0,0.04)' },
                                        }}
                                    >
                                        Log Out
                                    </Button>
                                )}

                                {/* Account Icon (commerce - shop pages) */}
                                {showCommerceAccountButton && (
                                    <IconButton
                                        onClick={() => navigate('/account')}
                                        aria-label="Account"
                                        sx={{ color: activeTextColor, transition: 'color 0.4s ease' }}
                                    >
                                        <AccountCircleIcon sx={{ fontSize: 32 }} />
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

                        {/* Location Modal */}
                        <LocationModal
                            open={locationModalOpen}
                            onClose={() => setLocationModalOpen(false)}
                            selectedLocationId={selectedLocation}
                            onSelectLocation={handleLocationChange}
                            locations={locations}
                        />

                        {/* Menu Drawer - for Shop pages */}
                        <MenuDrawer
                            open={menuDrawerOpen}
                            onClose={() => setMenuDrawerOpen(false)}
                        />

                    </div>
                </div>
            </header>
        </>
    );
};

export default Header;
