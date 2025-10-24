import React, { useContext } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@mui/material';
import Logo from '@/assets/images/svg/dbc_logo.svg';
import { LayoutContext } from '@/contexts/subscriptions/SubscriptionsLayoutContext';

const Header = () => {
    console.log('%c[Header] Component Rendering...', 'background: #4b5563; color: white');

    const { isAuthenticated, showRedeemButton, logout, resetWizardFlow } = useContext(LayoutContext);
    const navigate = useNavigate();
    const location = useLocation();

    const onRedeemPage = location.pathname === '/redeem';

    console.log({
        source: '[Header] State received from context',
        isAuthenticated,
        showRedeemButton,
        onRedeemPage,
        currentPath: location.pathname
    });
    
    const handleLogoClick = (e) => {
        e.preventDefault();
        console.log('[Header] Logo clicked.');
        if (resetWizardFlow) {
            resetWizardFlow();
        }
        navigate('/');
    };
    
    const handleLogout = () => {
        console.log('[Header] Logout button clicked.');
        if (logout) {
            logout();
        }
        navigate('/');
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

    const isRightButtonVisible = (isAuthenticated && onRedeemPage) || showRedeemButton;

    return (
        <header className="header" style={{ paddingTop: '20px', paddingBottom: '20px' }}>
            <div className="shell">
                <div style={{ maxWidth: '600px', margin: '0 auto', paddingLeft: '24px', paddingRight: '24px' }}>
                    <div className="header__inner" style={{ display: 'flex', alignItems: 'center' }}>
                        <div style={{ flex: 1 }}>
                           {isRightButtonVisible && (
                                <div style={{ visibility: 'hidden' }}>
                                    <Button variant="outlined" sx={buttonStyles}>Placeholder</Button>
                                </div>
                           )}
                        </div>

                        <div className="header__logo" style={{ flexShrink: 0 }}>
                            <a href="/" onClick={handleLogoClick}>
                                <img src={Logo} alt="Your Company Logo" style={{ display: 'block', height: '128px', width: 'auto' }} />
                            </a>
                        </div>
                        
                        <div className="header__actions" style={{ flex: 1, display: 'flex', justifyContent: 'flex-end' }}>
                            {(() => {
                                if (isAuthenticated && onRedeemPage) {
                                    console.log('%c[Header] Decision: Rendering Logout Button', 'color: green');
                                    return (
                                        <Button variant="outlined" onClick={handleLogout} sx={buttonStyles}>Logout</Button>
                                    );
                                } 
                                if (showRedeemButton) {
                                    console.log('%c[Header] Decision: Rendering Redeem Button', 'color: green');
                                    return (
                                        <Button variant="outlined" href="/redeem" sx={buttonStyles}>Redeem</Button>
                                    );
                                }
                                console.log('%c[Header] Decision: Rendering NO button.', 'color: red');
                                return null;
                            })()}
                        </div>
                    </div>
                </div>
            </div>
        </header>
    );
};

export default Header;