import React, { useContext, useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button, Box, Typography, IconButton, Select, MenuItem, FormControl } from '@mui/material';
import ShoppingBagIcon from '@mui/icons-material/ShoppingBag';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import Logo from '@/assets/images/svg/logo.svg';
import { LayoutContext } from '@/contexts/commerce/CommerceLayoutContext';
import { useShopify } from '@/contexts/commerce/ShopifyContext_GraphQL';
import { LocationModal } from '@/components/commerce/LocationModal';
import { MenuDrawer } from '@/components/commerce/MenuDrawer';
import { getDefaultLocations } from '@/components/commerce/shopifyLocations';
import { initializeLocationSelection } from '@/components/commerce/geolocation';

// Get locations (will be replaced with API call)
const LOCATIONS = getDefaultLocations();

// Navigation items
const NAV_ITEMS = [
    { label: 'Shop', path: '/shop', external: false },
    { label: 'Events', path: 'https://events.surrealcreamery.com', external: true },
    { label: 'Subscriptions', path: 'https://www.dollarbobaclub.com', external: true },
    { label: 'Catering', path: 'https://catering.surrealcreamery.com', external: true },
];

const Header = () => {
    const { 
        showBackButton,
        goBack,
        sendToCommerce 
    } = useContext(LayoutContext);
    
    const { checkout, goToCheckout } = useShopify();
    const navigate = useNavigate();
    const location = useLocation();
    
    // Location selection state
    const [selectedLocation, setSelectedLocation] = useState(() => {
        // Check localStorage first
        return localStorage.getItem('selectedLocation') || null; // null = no location selected
    });
    const [locationModalOpen, setLocationModalOpen] = useState(false);
    const [menuDrawerOpen, setMenuDrawerOpen] = useState(false);
    
    // Determine active nav item based on current path
    const getActiveNavItem = () => {
        const currentPath = location.pathname;
        
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
        
        // Check for exact match or if path starts with nav item path (internal links only)
        const activeItem = NAV_ITEMS.find(item => 
            !item.external && (currentPath === item.path || currentPath.startsWith(item.path + '/'))
        );
        return activeItem?.path || null;
    };
    
    // Auto-detect location on first visit using IP geolocation
    useEffect(() => {
        const detectLocation = async () => {
            // Only auto-detect if no saved location
            if (!localStorage.getItem('selectedLocation')) {
                console.log('🌍 Detecting nearest store via IP geolocation...');
                const nearestStore = await initializeLocationSelection(LOCATIONS);
                if (nearestStore) {
                    console.log('📍 Nearest store detected:', nearestStore.name);
                    setSelectedLocation(nearestStore.id);
                    // Note: Not saving to localStorage yet - let user confirm by browsing
                } else {
                    console.log('⚠️ Could not detect location, prompting user to select');
                    // Set to null so user sees "Select a Location"
                    setSelectedLocation(null);
                }
            }
        };
        
        detectLocation();
    }, []); // Run once on mount
    
    // Calculate cart item count
    const totalItems = checkout?.lineItems?.reduce((total, item) => total + item.quantity, 0) || 0;
    
    const handleLogoClick = (e) => {
        e.preventDefault();
        sendToCommerce({ type: 'RESET' });
        navigate('/');
    };

    const handleCartClick = () => {
        console.log('🛒 Cart button clicked, opening cart view');
        sendToCommerce({ type: 'OPEN_CART' });
    };

    const handleBackClick = () => {
        goBack();
    };
    
    const handleLocationClick = () => {
        console.log('📍 Location button clicked - opening modal');
        setLocationModalOpen(true);
    };
    
    const handleAccountClick = () => {
        console.log('👤 Account button clicked');
        // TODO: Open account modal/page or login
    };
    
    const handleLocationChange = (locationId) => {
        setSelectedLocation(locationId);
        console.log('Selected location:', locationId);
        // Save to localStorage when user explicitly selects
        localStorage.setItem('selectedLocation', locationId);
        // TODO: Update inventory availability based on location
    };
    
    const handleNavClick = (item) => {
        if (item.external) {
            window.location.href = item.path;
        } else {
            navigate(item.path);
        }
    };
    
    const iconButtonStyles = {
        color: 'black',
        '&:hover': {
            backgroundColor: 'rgba(0,0,0,0.04)'
        }
    };
    
    const buttonStyles = {
      color: 'black',
      borderColor: 'black',
      textTransform: 'none',
      py: '7px',
      px: '14px',
      '&:hover': {
        borderColor: 'black',
        backgroundColor: 'rgba(0,0,0,0.04)',
      },
    };
    
    const activeNavPath = getActiveNavItem();

    return (
        <>
            {/* CSS Override for header padding */}
            <style>{`
                .header { padding-top: 0 !important; padding-bottom: 0 !important; }
            `}</style>
            
            <header 
                className="header" 
                role="banner" 
                aria-label="Site header"
            >
                {/* Navigation Bar - REI Style */}
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
                        flexWrap: 'wrap',
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
                                        fontSize: '1.6rem !important', 
                                        fontWeight: isActive ? 600 : 400,
                                        lineHeight: 1.2,
                                    }}
                                >
                                    {item.label}
                                </Typography>
                            </Button>
                        );
                    })}
                </Box>
            </Box>

            <div className="shell">
                <div style={{ maxWidth: '600px', margin: '0 auto' }}>
                    {/* 3-column CSS Grid layout */}
                    <div className="header__inner" style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center' }}>
                        
                        {/* Left column - Menu button */}
                        <div style={{ justifySelf: 'start', display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Button
                                variant="outlined"
                                onClick={() => setMenuDrawerOpen(true)}
                                sx={{
                                    color: 'black',
                                    borderColor: 'black',
                                    borderWidth: '1px',
                                    textTransform: 'none',
                                    padding: '7px 16px',
                                    borderRadius: '12px',
                                    height: '39px',
                                    '&:hover': {
                                        borderColor: 'black',
                                        backgroundColor: 'rgba(0,0,0,0.04)',
                                    },
                                    '& .MuiButton-label': {
                                        fontSize: '1.6rem',
                                    }
                                }}
                            >
                                <Typography sx={{ fontSize: '1.6rem !important', fontWeight: 400 }}>Menu</Typography>
                            </Button>
                        </div>

                        {/* Center column - Logo */}
                        <div className="header__logo" style={{ justifySelf: 'center' }}>
                            <a href="/" onClick={handleLogoClick}>
                                <img src={Logo} alt="Surreal Creamery Logo" style={{ display: 'block', height: '128px', width: 'auto' }} />
                            </a>
                        </div>
                        
                        {/* Right column - Cart only (Account hidden until features ready) */}
                        <div className="header__actions" style={{ justifySelf: 'end', display: 'flex', alignItems: 'center', gap: 1, minWidth: '48px' }}>
                            {/* Account Icon - Hidden for now
                            <IconButton
                                onClick={handleAccountClick}
                                aria-label="My account"
                                sx={{
                                    color: 'black',
                                    padding: '6px',
                                    '&:hover': {
                                        backgroundColor: 'rgba(0,0,0,0.04)',
                                    }
                                }}
                            >
                                <AccountCircleIcon sx={{ fontSize: 40 }} />
                            </IconButton>
                            */}
                            
                            {/* Cart Button - Only show when items in cart */}
                            {totalItems > 0 && (
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
                    
                    {/* Location Selector - Below Logo, opens modal */}
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
                    
                    {/* Location Modal */}
                    <LocationModal
                        open={locationModalOpen}
                        onClose={() => setLocationModalOpen(false)}
                        selectedLocationId={selectedLocation}
                        onSelectLocation={handleLocationChange}
                        locations={LOCATIONS}
                    />
                    
                    {/* Menu Drawer */}
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
