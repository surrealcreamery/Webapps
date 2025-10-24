import React, { useEffect, useContext } from 'react';
import { Box, Typography, CircularProgress, Alert, Container } from '@mui/material';
import { CateringLayoutContext } from '@/contexts/catering/CateringLayoutContext';

// Import all the view components
import { CartView } from '@/components/catering/CartView';
import { ItemDetailView } from '@/components/catering/ItemDetailView';
import { ModifierSelectionView } from '@/components/catering/ModifierSelectionView';
import { ItemListView } from '@/components/catering/ItemListView';
import { CategoryListView } from '@/components/catering/CategoryListView';
import { QuantityAndDiscountView } from '@/components/catering/QuantityAndDiscountView';
// Import new auth components with corrected paths
import { ContactForm } from '@/components/catering/ContactForm';
import { AccountOTPChoice } from '@/components/catering/AccountOTPChoice'; 
// ✅ FIX: Changed to a default import (no curly braces) to match the export
import AccountOTPInput from '@/components/catering/AccountOTPInput'; 
import { ResolvingPartialMatch } from '@/components/catering/ResolvingPartialMatch';


export default function CateringMenu() {
    const { cateringState, sendToCatering } = useContext(CateringLayoutContext);
    const { 
        menu, cart, selectedCategory, editingItem, error, 
        isAuthenticated, contactInfo, formErrors, otpChannel,
        potentialAccounts, selectedPartialMatch // Get new context values
    } = cateringState.context;

    console.log('%c[CateringMenu Page] Rendering. State is:', 'color: #16a34a', cateringState.value);

    useEffect(() => {
        // Only fetch menu if it hasn't been fetched
        if (cateringState.matches('booting')) {
             sendToCatering({ type: 'FETCH_MENU' });
        }
    }, [sendToCatering, cateringState]);

    const renderContent = () => {
        if (cateringState.matches('loadingMenu')) {
            return <Box sx={{ display: 'flex', justifyContent: 'center', p: 4, minHeight: '80vh', alignItems: 'center' }}><CircularProgress /></Box>;
        }

        if (error) {
            return <Alert severity="error" sx={{ m: 2 }}>{error}</Alert>;
        }

        if (cateringState.matches('viewingCart')) {
            // ✅ Pass the full cateringState to the CartView
            return <CartView cart={cart} sendToCatering={sendToCatering} cateringState={cateringState} />;
        }
        
        // --- AUTHENTICATION FLOW ---
        if (cateringState.matches('authenticationFlow.enteringContactInfo')) {
            return <ContactForm 
                        contactInfo={contactInfo}
                        formErrors={formErrors}
                        onFieldChange={(e) => {
                            console.log('[CateringMenu Page] Event: UPDATE_FIELD');
                            sendToCatering({ type: 'UPDATE_FIELD', field: e.target.name, value: e.target.value });
                        }}
                        onSubmit={() => {
                            console.log('[CateringMenu Page] Event: SUBMIT_CONTACT');
                            sendToCatering({ type: 'SUBMIT_CONTACT' });
                        }}
                        onBack={() => {
                            console.log('[CateringMenu Page] Event: GO_BACK (from contact form)');
                            sendToCatering({ type: 'GO_BACK' });
                        }}
                    />
        }
        
        if (cateringState.matches('authenticationFlow.selectingAccount')) {
            return <ResolvingPartialMatch
                        // Pass the full state object as the 'context' prop
                        context={cateringState} 
                        send={sendToCatering}
                    />;
        }
        
         if (cateringState.matches('authenticationFlow.awaitingAuthentication.choosingMethod')) {
            return <AccountOTPChoice
                        contactInfo={contactInfo}
                        onChooseEmail={() => {
                            console.log('[CateringMenu Page] Event: CHOOSE_EMAIL');
                            sendToCatering({ type: 'CHOOSE_EMAIL' });
                        }}
                        onChooseSms={() => {
                            console.log('[CateringMenu Page] Event: CHOOSE_SMS');
                            sendToCatering({ type: 'CHOOSE_SMS' });
                        }}
                        onBack={() => {
                            // ✅ FIX: Corrected typo in console log
                            console.log('[CateringMenu Page] Event: BACK (from OTP choice)');
                            sendToCatering({ type: 'BACK' });
                        }}
                    />
        }
        if (cateringState.matches('authenticationFlow.awaitingAuthentication.sendingOtp') || cateringState.matches('authenticationFlow.awaitingAuthentication.verifyingOtp') || cateringState.matches('authenticationFlow.awaitingAuthentication.enteringOtp')) {
            return <AccountOTPInput
                        contactInfo={contactInfo}
                        otpChannel={otpChannel}
                        isVerifying={cateringState.matches('authenticationFlow.awaitingAuthentication.verifyingOtp')}
                        error={error}
                        onSubmitOtp={(otp) => {
                            console.log('[CateringMenu Page] Event: SUBMIT_OTP');
                            sendToCatering({ type: 'SUBMIT_OTP', otp });
                        }}
                        onBack={() => {
                            console.log('[CateringMenu Page] Event: BACK (from OTP input)');
                            sendToCatering({ type: 'BACK' });
                        }}
                    />
        }
        
        // --- MENU & ITEM FLOW ---
        if (cateringState.matches('browsing.editingItem')) {
            return <ModifierSelectionView item={editingItem} sendToCatering={sendToCatering} />;
        }
        
        if (cateringState.matches('browsing.selectingQuantity')) {
            return <QuantityAndDiscountView
                        item={editingItem}
                        selectedModifiers={cateringState.context.tempSelectedModifiers}
                        sendToCatering={sendToCatering}
                        isAuthenticated={isAuthenticated}
                    />;
        }

        if (cateringState.matches('browsing.viewingItemDetails')) {
            return <ItemDetailView 
                        item={editingItem} 
                        sendToCatering={sendToCatering} 
                        isAuthenticated={isAuthenticated} 
                    />;
        }

        if (cateringState.matches('browsing.browsingItems')) {
            if (!menu[selectedCategory] || !menu[selectedCategory].items) {
                return <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>;
            }
            return <ItemListView items={menu[selectedCategory].items} categoryName={selectedCategory} sendToCatering={sendToCatering} />;
        }

        if (cateringState.matches('browsing.browsingCategories')) {
            return <CategoryListView menu={menu} sendToCatering={sendToCatering} />;
        }

        return <Typography>Something went wrong. Current state: {JSON.stringify(cateringState.value)}</Typography>;
    };

    return (
        <Container maxWidth="sm" sx={{ pt: 0, pb: 4 }}>
            {renderContent()}
        </Container>
    );
}

