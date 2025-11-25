import React, { useEffect, useState, forwardRef, useImperativeHandle } from 'react';
import { Box, Button, CircularProgress, Alert, Typography } from '@mui/material';
import { SQUARE_APP_ID, SQUARE_LOCATION_ID } from '@/constants/catering/cateringConstants';

const CateringSquarePaymentForm = forwardRef(({ 
    onPaymentSuccess, 
    onPaymentError, 
    isProcessing, 
    orderTotal,
    buttonText = 'Pay Now'
}, ref) => {
    const [scriptError, setScriptError] = useState('');
    const [isScriptLoaded, setScriptLoaded] = useState(false);
    const [isFormInitialized, setIsFormInitialized] = useState(false);
    const [cardInstance, setCardInstance] = useState(null);

    // Load Square payment script
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

    // Initialize Square card payment form
    useEffect(() => {
        if (!isScriptLoaded) return;

        const initializeAndAttachCard = async () => {
            setIsFormInitialized(false);
            const payments = window.Square.payments(SQUARE_APP_ID, SQUARE_LOCATION_ID);

            if (cardInstance) {
                await cardInstance.destroy();
            }

            try {
                console.log("[CateringSquarePaymentForm] Initializing card instance...");
                const card = await payments.card();
                await card.attach('#catering-card-container');
                
                // Auto-focus on card number field
                await card.focus('cardNumber');

                setCardInstance(card);
                setIsFormInitialized(true);
                console.log("[CateringSquarePaymentForm] Card instance attached and ready");
            } catch (e) {
                console.error('[CateringSquarePaymentForm] Initializing Card failed', e);
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

    // Handle payment tokenization
    const handlePayment = async () => {
        if (!cardInstance) {
            onPaymentError('Payment form is not ready.');
            return;
        }

        try {
            console.log("[CateringSquarePaymentForm] Tokenizing card...");
            const result = await cardInstance.tokenize();
            
            if (result.status === 'OK') {
                console.log("[CateringSquarePaymentForm] Tokenization successful");
                // Pass the token and card details to parent
                onPaymentSuccess({
                    token: result.token,
                    cardDetails: result.details.card
                });
            } else {
                const errorMessage = result.errors 
                    ? result.errors.map(err => err.message).join(' ') 
                    : 'Tokenization failed.';
                console.error('[CateringSquarePaymentForm] Tokenization failed:', errorMessage);
                onPaymentError(errorMessage);
            }
        } catch (e) {
            console.error('[CateringSquarePaymentForm] Payment error:', e);
            onPaymentError(e.message || 'Payment processing failed.');
        }
    };

    // Expose handlePayment to parent via ref
    useImperativeHandle(ref, () => ({
        processPayment: handlePayment
    }));

    return (
        <Box sx={{ maxWidth: 'sm', mx: 'auto', mt: 2 }}>
            {/* Order Total Display */}
            {orderTotal && (
                <Box sx={{ mb: 2, p: 2, backgroundColor: 'grey.100', borderRadius: 1 }}>
                    <Typography variant="h6" align="center">
                        Total: ${(orderTotal / 100).toFixed(2)}
                    </Typography>
                </Box>
            )}

            {/* Loading State */}
            {!isFormInitialized && !scriptError && (
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                    <CircularProgress />
                </Box>
            )}

            {/* Error State */}
            {scriptError && (
                <Alert severity="error" sx={{ mb: 2 }}>
                    {scriptError}
                </Alert>
            )}

            {/* Square Card Form Container */}
            <Box 
                sx={{ 
                    display: isScriptLoaded ? 'block' : 'none', 
                    opacity: isFormInitialized ? 1 : 0, 
                    transition: 'opacity 0.3s',
                    mb: 2
                }}
            >
                <div 
                    id="catering-card-container" 
                    style={{ minHeight: '120px' }}
                />
            </Box>

            {/* Payment Button */}
            {isFormInitialized && !scriptError && (
                <Button 
                    variant="contained" 
                    fullWidth 
                    onClick={handlePayment} 
                    disabled={isProcessing}
                    sx={{ mt: 2 }}
                >
                    {isProcessing ? (
                        <CircularProgress size={24} color="inherit" />
                    ) : (
                        buttonText
                    )}
                </Button>
            )}
        </Box>
    );
});

CateringSquarePaymentForm.displayName = 'CateringSquarePaymentForm';

export default CateringSquarePaymentForm;
