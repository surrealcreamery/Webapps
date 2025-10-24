import React, { useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@mui/material';
import Logo from '@/assets/images/svg/logo.svg';
import { LayoutContext } from '@/contexts/events/EventsLayoutContext';

const Header = () => {
    const { 
        showLoginButton,
        showMyEventsButton,
        showLogoutButton,
        logout, 
        sendToFundraiser 
    } = useContext(LayoutContext);

    const navigate = useNavigate();
    
    const handleLogoClick = (e) => {
        e.preventDefault();
        sendToFundraiser({ type: 'RESET' });
        navigate('/');
    };
    
    const handleLoginClick = () => {
        sendToFundraiser({ type: 'LOGIN_START' });
    };

    const handleDashboardClick = () => {
        console.log("Attempting to go to dashboard..."); // For debugging
        sendToFundraiser({ type: 'GO_TO_DASHBOARD' });
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

    return (
        <header className="header">
            <div className="shell">
                <div style={{ maxWidth: '600px', margin: '0 auto', paddingLeft: '24px', paddingRight: '24px' }}>
                    {/* ✅ This is the fix: Changed to a 3-column CSS Grid layout */}
                    <div className="header__inner" style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center' }}>
                        
                        {/* Left column for spacing. It takes up 1 fraction of the available space. */}
                        <div style={{ justifySelf: 'start' }}></div>

                        {/* Center column, automatically sized to fit the logo. */}
                        <div className="header__logo" style={{ justifySelf: 'center' }}>
                            <a href="/" onClick={handleLogoClick}>
                                <img src={Logo} alt="Your Company Logo" style={{ display: 'block', height: '128px', width: 'auto' }} />
                            </a>
                        </div>
                        
                        {/* Right column, aligned to the end. It also takes up 1 fraction of space. */}
                        <div className="header__actions" style={{ justifySelf: 'end' }}>
                            {showLoginButton && (
                                <Button onClick={handleLoginClick} variant="outlined" sx={buttonStyles}>Log In</Button>
                            )}
                            {showMyEventsButton && (
                                <Button onClick={handleDashboardClick} variant="outlined" sx={buttonStyles}>My Events</Button>
                            )}
                            {showLogoutButton && (
                                <Button variant="outlined" onClick={logout} sx={buttonStyles}>Log Out</Button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </header>
    );
};

export default Header;
