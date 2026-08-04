import React, { useContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Box, Typography, IconButton } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import Logo from '@/assets/images/svg/logo.svg';
import { LayoutContext } from '@/contexts/events/EventsLayoutContext';
import { trackNavItemClicked, trackLogoClicked } from '@/services/analytics';

// Navigation items - cross-app nav
const NAV_ITEMS = [
    { label: 'Shop', path: 'https://www.surrealcreamery.com', external: true },
    { label: 'Events', path: '/', external: false, isCurrentApp: true },
    { label: 'Subscriptions', path: 'https://www.dollarbobaclub.com', external: true },
];

const Header = () => {
    const {
        fundraiserState,
        showLoginButton,
        showMyEventsButton,
        showLogoutButton,
        logout,
        sendToFundraiser
    } = useContext(LayoutContext);

    const isInWizard = typeof fundraiserState.value === 'object' && fundraiserState.value.wizardFlow;

    // Track the events URL so the header can show a contextual Back on the series-detail view too
    // (series selection navigates via history.pushState, which doesn't fire router events — we listen
    // to popstate and a custom 'events:nav' event dispatched by the directory on navigation).
    const [pathname, setPathname] = useState(typeof window !== 'undefined' ? window.location.pathname : '/');
    useEffect(() => {
        const update = () => setPathname(window.location.pathname);
        window.addEventListener('popstate', update);
        window.addEventListener('events:nav', update);
        return () => {
            window.removeEventListener('popstate', update);
            window.removeEventListener('events:nav', update);
        };
    }, []);
    // Series detail = /events/<slug> (not the login/dashboard sub-routes, and not the wizard).
    const seriesMatch = pathname.match(/^\/events\/([^/]+)/);
    const isSeriesDetail = !isInWizard && !!seriesMatch && !['login', 'dashboard'].includes(seriesMatch[1]);
    const showBack = isInWizard || isSeriesDetail;

    const handleBackClick = () => {
        if (isInWizard) {
            const returnTo = sessionStorage.getItem('eventDeepLinkReturn');
            if (returnTo) {
                sessionStorage.removeItem('eventDeepLinkReturn');
                sendToFundraiser({ type: 'RESET' });
                navigate(returnTo);
            } else {
                sendToFundraiser({ type: 'BACK' });
            }
        } else {
            // Series detail → back to the events home. Set URL and let the page's popstate handler
            // reset its state (parseTestEventUrl('/events') → clears the selected series).
            window.history.pushState(null, '', '/events');
            window.dispatchEvent(new PopStateEvent('popstate'));
        }
    };

    const navigate = useNavigate();
    
    const handleLogoClick = (e) => {
        e.preventDefault();
        trackLogoClicked();
        sendToFundraiser({ type: 'RESET' });
        navigate('/');
    };
    
    const handleLoginClick = () => {
        sendToFundraiser({ type: 'LOGIN_START' });
    };

    const handleDashboardClick = () => {
        console.log("Attempting to go to dashboard...");
        sendToFundraiser({ type: 'GO_TO_DASHBOARD' });
    };
    
    const handleNavClick = (item) => {
        trackNavItemClicked(item.label, item.path);
        if (item.external) {
            window.location.href = item.path;
        } else if (item.isCurrentApp) {
            navigate('/');
        } else {
            navigate(item.path);
        }
    };
    
    const buttonStyles = {
      color: 'black',
      border: '1px solid black !important',
      textTransform: 'none',
      py: '7px',
      px: '14px',
      '&:hover': {
        border: '1px solid black !important',
        backgroundColor: 'rgba(0,0,0,0.04)',
      },
    };

    return (
        <>
            {/* CSS Override for header padding */}
            <style>{`
                .header { padding-top: 0 !important; padding-bottom: 0 !important; }
            `}</style>
            
            <header className="header" role="banner" aria-label="Site header">
                {/* Navigation Bar */}
                <Box
                    component="nav"
                    aria-label="Main navigation"
                    sx={{
                        backgroundColor: '#000',
                        width: '100vw',
                        marginLeft: 'calc(-50vw + 50%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        height: 40,
                        px: 2,
                    }}
                >
                    <Box
                        component="ul"
                        sx={{
                            maxWidth: '600px',
                            margin: '0 auto',
                            display: 'flex',
                            justifyContent: 'center',
                            gap: 0.5,
                            flexWrap: 'nowrap',
                            listStyle: 'none',
                            p: 0,
                        }}
                    >
                        {NAV_ITEMS.map((item) => {
                            const isActive = item.isCurrentApp;
                            return (
                                <Box component="li" key={item.path}>
                                <Box
                                    component="button"
                                    aria-label={item.label}
                                    aria-current={isActive ? 'page' : undefined}
                                    onClick={() => handleNavClick(item)}
                                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleNavClick(item); } }}
                                    sx={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        backgroundColor: isActive ? '#fff' : 'transparent',
                                        borderRadius: '6px',
                                        cursor: 'pointer',
                                        p: '2px',
                                        border: 'none',
                                        font: 'inherit',
                                        '&:hover': {
                                            backgroundColor: isActive ? '#fff' : 'rgba(255,255,255,0.1)',
                                        },
                                        '&:focus-visible': {
                                            outline: '2px solid #1976d2',
                                            outlineOffset: '2px',
                                        },
                                    }}
                                >
                                    <Typography
                                        component="span"
                                        sx={{
                                            fontSize: '1.6rem',
                                            fontWeight: isActive ? 600 : 400,
                                            lineHeight: 1.2,
                                            whiteSpace: 'nowrap',
                                            px: 1.5,
                                            py: 0.5,
                                            color: isActive ? '#000' : '#fff',
                                        }}
                                    >
                                        {item.label}
                                    </Typography>
                                </Box>
                                </Box>
                            );
                        })}
                    </Box>
                </Box>
                
                {/* Logo and Actions Row */}
                <div className="shell">
                    <div style={{ maxWidth: '600px', margin: '0 auto' }}>
                        <div className="header__inner" style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center' }}>
                            
                            {/* Left column - Back button */}
                            <div style={{ justifySelf: 'start' }}>
                                {showBack && (
                                    <IconButton onClick={handleBackClick} aria-label="Go back" sx={{ color: 'black' }}>
                                        <ArrowBackIcon />
                                    </IconButton>
                                )}
                            </div>

                            {/* Center column - Logo */}
                            <div className="header__logo" style={{ justifySelf: 'center' }}>
                                <a href="/" onClick={handleLogoClick}>
                                    <img src={Logo} alt="Surreal Creamery" style={{ display: 'block', height: '128px', width: 'auto' }} />
                                </a>
                            </div>
                            
                            {/* Right column - Actions */}
                            <div className="header__actions" style={{ justifySelf: 'end' }}>
                                {showLoginButton && (
                                    <Button onClick={handleLoginClick} variant="outlined" sx={buttonStyles}>Log In</Button>
                                )}
                                {showMyEventsButton && (
                                    <Button onClick={handleDashboardClick} variant="outlined" sx={buttonStyles}>My Events</Button>
                                )}
                                {showLogoutButton && (
                                    <Button onClick={logout} variant="outlined" sx={buttonStyles}>Log Out</Button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </header>
        </>
    );
};

export default Header;
