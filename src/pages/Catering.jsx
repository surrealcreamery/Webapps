import React, { useEffect, useContext } from 'react';
import {
    Box,
    Typography,
    CircularProgress,
    Alert,
    Container,
    Button
} from '@mui/material';
import { CateringLayoutContext } from '@/contexts/catering/CateringLayoutContext';

// Import all the view components
import { CateringCartDrawer } from '@/components/catering/CateringCartDrawer';
import { DateSelectionView } from '@/components/catering/DateSelectionView';
import { ItemDetailView } from '@/components/catering/ItemDetailView';
import { ModifierSelectionView } from '@/components/catering/ModifierSelectionView';
import { ItemListView } from '@/components/catering/ItemListView';
import { CategoryListView } from '@/components/catering/CategoryListView';
import { QuantityAndDiscountView } from '@/components/catering/QuantityAndDiscountView';
import { Checkout } from '@/components/catering/Checkout';

// Import auth components
import { ContactForm } from '@/components/catering/ContactForm';
import { AccountOTPChoice } from '@/components/catering/AccountOTPChoice';
import AccountOTPInput from '@/components/catering/AccountOTPInput';
import { UpdateAccountWithOrganizationNameAccountType } from '@/components/catering/UpdateAccountWithOrganizationNameAccountType';
import { ResolvingCateringMatch } from '@/components/catering/ResolvingCateringMatch';

// Import Login Flow components
import { LoginForm } from '@/components/catering/LoginForm';
import { ResolvingCateringLoginMatch } from '@/components/catering/ResolvingCateringLoginMatch';
import { OrdersView } from '@/components/catering/OrdersView';


export default function CateringMenu() {
    const { cateringState, sendToCatering } = useContext(CateringLayoutContext);
    const {
        menu, cart, selectedCategory, editingItem, error,
        isAuthenticated, contactInfo, loginContactInfo,
        formErrors, otpChannel, accountId, cartDrawerOpen
    } = cateringState.context;

    const handleCloseCartDrawer = () => {
        sendToCatering({ type: 'CLOSE_CART_DRAWER' });
    };

    console.log('%c[CateringMenu Page] Rendering. State is:', 'color: #16a34a', JSON.stringify(cateringState.value));

    // Effect to scroll to top on every state transition
    useEffect(() => {
        window.scrollTo(0, 0);
    }, [cateringState.value]);

    useEffect(() => {
        if (cateringState.matches('booting')) {
             // sendToCatering({ type: 'FETCH_MENU' }); // Likely not needed
        }
    }, [sendToCatering, cateringState]);

    const renderContent = () => {
        // Loading state
        if (cateringState.matches('loadingMenu')) {
            return (
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 4, minHeight: '80vh', alignItems: 'center' }}>
                    <CircularProgress />
                </Box>
            );
        }

        // Show global error, but ignore errors in specific states where error is handled locally
        if (error && 
            !cateringState.matches('loginFlow.awaitingAuthentication.enteringOtp') &&
            !cateringState.matches('loginFlow.enteringLoginContactInfo')
        ) {
            return <Alert severity="error" sx={{ m: 2 }}>{error}</Alert>;
        }

        // Date selection view
        if (cateringState.matches('selectingDate')) {
            return <DateSelectionView sendToCatering={sendToCatering} cateringState={cateringState} />;
        }

        // --- GUEST CHECKOUT FLOW ---
        if (cateringState.matches('guestCheckoutFlow.enteringContactInfo')) {
            return (
                <ContactForm
                    contactInfo={contactInfo}
                    formErrors={formErrors}
                    onFieldChange={(e) => sendToCatering({ type: 'UPDATE_FIELD', field: e.target.name, value: e.target.value })}
                    onSubmit={() => sendToCatering({ type: 'SUBMIT_CONTACT' })}
                    onBack={() => sendToCatering({ type: 'GO_BACK' })}
                />
            );
        }
        
        if (cateringState.matches('guestCheckoutFlow.checkingAccountStatus')) {
            return (
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 4, minHeight: '80vh', alignItems: 'center' }}>
                    <CircularProgress />
                    <Typography sx={{ml: 2}}>Checking account...</Typography>
                </Box>
            );
        }
        
        if (cateringState.matches('guestCheckoutFlow.savingCart')) {
            return (
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 4, minHeight: '80vh', alignItems: 'center' }}>
                    <CircularProgress />
                    <Typography sx={{ml: 2}}>Saving your order...</Typography>
                </Box>
            );
        }
        
        if (cateringState.matches('guestCheckoutFlow.creatingAccount')) {
            return (
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 4, minHeight: '80vh', alignItems: 'center' }}>
                    <CircularProgress />
                    <Typography sx={{ml: 2}}>Creating account...</Typography>
                </Box>
            );
        }
        
        if (cateringState.matches('guestCheckoutFlow.selectingAccount')) {
            return (
                <ResolvingCateringMatch
                    context={cateringState}
                    send={sendToCatering}
                />
            );
        }
        
        if (cateringState.matches('guestCheckoutFlow.enteringOrgAndAccountType')) {
            return (
                <UpdateAccountWithOrganizationNameAccountType
                    sendToCatering={sendToCatering}
                    cateringState={cateringState}
                />
            );
        }
        
        if (cateringState.matches('guestCheckoutFlow.updatingOrgAndAccountType')) {
             return (
                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', p: 4, flexDirection: 'column', gap: 2 }}>
                    <CircularProgress />
                    <Typography>Updating account details...</Typography>
                </Box>
            );
        }
        
        // --- LOGIN FLOW ---
        if (cateringState.matches('loginFlow.enteringLoginContactInfo')) {
            return (
                <LoginForm
                    sendToCatering={sendToCatering}
                    onBack={() => sendToCatering({ type: 'GO_BACK' })}
                    error={error}
                    cateringState={cateringState}
                />
            );
        }
        
        if (cateringState.matches('loginFlow.checkingLoginAccountStatus')) {
            return (
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 4, minHeight: '80vh', alignItems: 'center' }}>
                    <CircularProgress />
                    <Typography sx={{ml: 2}}>Checking account...</Typography>
                </Box>
            );
        }
        
        if (cateringState.matches('loginFlow.creatingAccount')) {
            return (
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 4, minHeight: '80vh', alignItems: 'center' }}>
                    <CircularProgress />
                    <Typography sx={{ml: 2}}>Creating account...</Typography>
                </Box>
            );
        }
        
        if (cateringState.matches('loginFlow.awaitingAuthentication.choosingMethod')) {
            return (
                <AccountOTPChoice
                    contactInfo={loginContactInfo}
                    onChooseEmail={() => { sendToCatering({ type: 'CHOOSE_EMAIL' }); }}
                    onChooseSms={() => { sendToCatering({ type: 'CHOOSE_SMS' }); }}
                    onBack={() => { sendToCatering({ type: 'BACK' }); }}
                />
            );
        }
        
        if (cateringState.matches('loginFlow.awaitingAuthentication.sendingOtp')) {
            return (
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 4, minHeight: '80vh', alignItems: 'center' }}>
                    <CircularProgress />
                    <Typography sx={{ml: 2}}>Sending verification code...</Typography>
                </Box>
            );
        }
        
        if (cateringState.matches('loginFlow.awaitingAuthentication.verifyingOtp') ||
            cateringState.matches('loginFlow.awaitingAuthentication.enteringOtp')) {
            return (
                <AccountOTPInput
                    contactInfo={loginContactInfo}
                    otpChannel={otpChannel}
                    isVerifying={cateringState.matches('loginFlow.awaitingAuthentication.verifyingOtp')}
                    error={error}
                    onSubmitOtp={(otp) => { sendToCatering({ type: 'SUBMIT_OTP', otp }); }}
                    onBack={() => { sendToCatering({ type: 'BACK' }); }}
                />
            );
        }
        
        if (cateringState.matches('loginFlow.selectingLoginAccount')) {
            console.log('%c[Catering.jsx] ✅✅✅ Rendering ResolvingCateringLoginMatch ✅✅✅', 'color: #00ff00; font-size: 18px; font-weight: bold;');
            console.log('%c[Catering.jsx] potentialAccounts:', 'color: #00ff00;', cateringState.context.potentialAccounts);
            return (
                <ResolvingCateringLoginMatch
                    context={cateringState}
                    send={sendToCatering}
                />
            );
        }

        // --- MENU & ITEM FLOW ---
        if (cateringState.matches('browsing.editingItem')) {
            if (!editingItem) {
                 console.error("Attempted to render ModifierSelectionView with null item.");
                 return <Typography color="error">Error: Item data missing.</Typography>;
            }
            return <ModifierSelectionView item={editingItem} sendToCatering={sendToCatering} />;
        }
        
        if (cateringState.matches('browsing.selectingQuantity')) {
            if (!editingItem || !cateringState.context.tempSelectedModifiers) {
                 console.error("Attempted to render QuantityAndDiscountView with null item or missing modifiers.");
                 return <Typography color="error">Error: Item data missing.</Typography>;
            }
            return (
                <QuantityAndDiscountView
                    item={editingItem}
                    selectedModifiers={cateringState.context.tempSelectedModifiers}
                    sendToCatering={sendToCatering}
                    isAuthenticated={isAuthenticated}
                />
            );
        }
        
        if (cateringState.matches('browsing.viewingItemDetails')) {
            if (!editingItem) {
                 console.error("Attempted to render ItemDetailView with null item.");
                 return <Typography color="error">Error: Item data missing.</Typography>;
            }
            return (
                <ItemDetailView
                    item={editingItem}
                    sendToCatering={sendToCatering}
                    isAuthenticated={isAuthenticated}
                />
            );
        }
        
        if (cateringState.matches('browsing.browsingItems')) {
            if (!menu[selectedCategory] || !menu[selectedCategory].items) {
                console.warn("Browsing items but category data is missing for:", selectedCategory);
                return (
                    <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                        <CircularProgress />
                    </Box>
                );
            }
            return (
                <ItemListView 
                    items={menu[selectedCategory].items} 
                    categoryName={selectedCategory} 
                    sendToCatering={sendToCatering} 
                />
            );
        }
        
        if (cateringState.matches('browsing.browsingCategories')) {
            return <CategoryListView menu={menu} sendToCatering={sendToCatering} />;
        }

        // --- PLACEHOLDER STATES ---
        if (cateringState.matches('checkoutPlaceholder')) {
            return <Checkout sendToCatering={sendToCatering} cateringState={cateringState} />;
        }
        
        if (cateringState.matches('viewingOrders')) {
             return (
                 <OrdersView 
                     accountId={accountId}
                     sendToCatering={sendToCatering}
                 />
             );
        }

        // Fallback
        console.error("Unhandled state reached:", JSON.stringify(cateringState.value));
        return (
            <Typography>
                Something went wrong. Current state: {JSON.stringify(cateringState.value)}
            </Typography>
        );
    };

    return (
        <>
            <Container maxWidth="sm" sx={{ pt: 0, pb: 4 }}>
                {renderContent()}
            </Container>

            {/* Cart Drawer Overlay */}
            <CateringCartDrawer
                open={cartDrawerOpen}
                onClose={handleCloseCartDrawer}
                cart={cart}
                sendToCatering={sendToCatering}
                cateringState={cateringState}
            />
        </>
    );
}
