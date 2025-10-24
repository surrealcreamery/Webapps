import React, { useEffect, useState, forwardRef, useImperativeHandle } from 'react';
import { Box, Button, CircularProgress, Alert } from '@mui/material';
import { SQUARE_APP_ID, SQUARE_LOCATION_ID } from '@/constants/subscriptions/subscriptionsConstants';

const SquarePaymentForm = forwardRef(({ onNonceReceived, onTokenizationError, isProcessing, savedCards, onSnackbar }, ref) => {
    const [scriptError, setScriptError] = useState('');
    const [isScriptLoaded, setScriptLoaded] = useState(false);
    const [isFormInitialized, setIsFormInitialized] = useState(false);
    const [cardInstance, setCardInstance] = useState(null);

    useEffect(() => {
        if (window.Square) {
            setScriptLoaded(true);
            return;
        }
        const script = document.createElement('script');
        script.src = 'https://web.squarecdn.com/v1/square.js';
        script.async = true;
        script.onload = () => setScriptLoaded(true);
        script.onerror = () => setScriptError('Failed to load payment script.');
        document.body.appendChild(script);
        return () => {
            if (script.parentNode) document.body.removeChild(script);
        };
    }, []);

    useEffect(() => {
        if (!isScriptLoaded) return;

        const initializeAndAttachCard = async () => {
            setIsFormInitialized(false);
            const payments = window.Square.payments(SQUARE_APP_ID, SQUARE_LOCATION_ID);

            if (cardInstance) {
                await cardInstance.destroy();
            }

            try {
                console.log("[SquarePaymentForm] Initializing new card instance...");
                const card = await payments.card();
                await card.attach('#card-payment-form-container');
                
                // ✅ FIX: Explicitly set focus on the card number field after attaching.
                await card.focus('cardNumber');

                setCardInstance(card);
                setIsFormInitialized(true);
            } catch (e) {
                console.error('Initializing Card failed', e);
                setScriptError('Failed to initialize payment form.');
            }
        };

        initializeAndAttachCard();

        return () => {
            if (cardInstance) {
                cardInstance.destroy();
            }
        };
    }, [isScriptLoaded]);

    const handlePayment = async () => {
        if (!cardInstance) {
            onTokenizationError('Payment form is not ready.');
            return;
        }
        try {
            const result = await cardInstance.tokenize();
            if (result.status === 'OK') {
                const newCardDetails = result.details.card;
                const isDuplicate = (savedCards || []).some(existingCard => 
                    existingCard?.last_4 === newCardDetails?.last4 &&
                    existingCard?.card_brand?.toUpperCase() === newCardDetails?.brand?.toUpperCase() &&
                    String(existingCard?.exp_month) === String(newCardDetails?.expMonth) &&
                    String(existingCard?.exp_year) === String(newCardDetails?.expYear)
                );

                if (isDuplicate) {
                    onSnackbar({ open: true, message: 'This credit card is already saved to your account.', severity: 'warning' });
                    return; 
                }
                onNonceReceived(result.token);
            } else {
                const errorMessage = result.errors ? result.errors.map(err => err.message).join(' ') : 'Tokenization failed.';
                onTokenizationError(errorMessage);
            }
        } catch (e) {
            onTokenizationError(e.message);
        }
    };
    
    return (
        <Box sx={{ maxWidth: 'sm', mx: 'auto' }}>
            {!isFormInitialized && !scriptError && <CircularProgress />}
            {scriptError && <Alert severity="error">{scriptError}</Alert>}
            <Box sx={{ display: isScriptLoaded ? 'block' : 'none', opacity: isFormInitialized ? 1 : 0, transition: 'opacity 0.3s' }}>
                <div id="card-payment-form-container" style={{ minHeight: '56px' }}></div>
            </Box>
            {isFormInitialized && !scriptError && (
                <Button variant="contained" fullWidth onClick={handlePayment} disabled={isProcessing} sx={{ mt: 2 }}>
                    {isProcessing ? <CircularProgress size={24} /> : 'Save Card'}
                </Button>
            )}
        </Box>
    );
});

export default SquarePaymentForm;