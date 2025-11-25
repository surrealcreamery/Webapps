import React, { useRef, useState } from 'react';
import { Box, Typography, Button, Alert, CircularProgress } from '@mui/material';
import CateringSquarePaymentForm from './CateringSquarePaymentForm';
import { CREATE_INVOICE, PROCESS_INVOICE_URL } from '@/constants/catering/cateringConstants';

export const CateringCheckout = ({ cart, accountId, contactInfo, onCheckoutComplete }) => {
    const paymentFormRef = useRef();
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(false);

    // Calculate order total (in cents)
    const orderTotal = cart.reduce((total, item) => {
        return total + (item.price * item.quantity * 100); // Convert to cents
    }, 0);

    const handlePaymentSuccess = async (paymentData) => {
        setIsProcessing(true);
        setError(null);

        try {
            console.log('[CateringCheckout] Payment token received:', paymentData.token);
            
            // Step 1: Create invoice in Square
            const invoiceResponse = await fetch(CREATE_INVOICE, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    accountId,
                    cart,
                    contactInfo,
                    orderTotal: orderTotal / 100, // Convert back to dollars
                })
            });

            if (!invoiceResponse.ok) {
                throw new Error('Failed to create invoice');
            }

            const invoiceData = await invoiceResponse.json();
            console.log('[CateringCheckout] Invoice created:', invoiceData);

            // Step 2: Process payment with Square
            const paymentResponse = await fetch(PROCESS_INVOICE_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sourceId: paymentData.token,
                    amountMoney: {
                        amount: orderTotal,
                        currency: 'USD'
                    },
                    invoiceId: invoiceData.invoiceId,
                    orderId: invoiceData.orderId,
                    accountId,
                    cardDetails: paymentData.cardDetails
                })
            });

            if (!paymentResponse.ok) {
                throw new Error('Payment processing failed');
            }

            const paymentResult = await paymentResponse.json();
            console.log('[CateringCheckout] Payment processed:', paymentResult);

            setSuccess(true);
            
            // Call completion callback after a brief delay to show success message
            setTimeout(() => {
                onCheckoutComplete(paymentResult);
            }, 2000);

        } catch (err) {
            console.error('[CateringCheckout] Checkout error:', err);
            setError(err.message || 'Failed to process payment. Please try again.');
            setIsProcessing(false);
        }
    };

    const handlePaymentError = (errorMessage) => {
        console.error('[CateringCheckout] Payment error:', errorMessage);
        setError(errorMessage);
        setIsProcessing(false);
    };

    if (success) {
        return (
            <Box sx={{ textAlign: 'center', py: 4 }}>
                <Alert severity="success" sx={{ mb: 2 }}>
                    Payment successful! Your order has been placed.
                </Alert>
                <CircularProgress />
                <Typography sx={{ mt: 2 }}>Processing your order...</Typography>
            </Box>
        );
    }

    return (
        <Box>
            <Typography variant="h2" gutterBottom>
                Payment
            </Typography>

            {/* Order Summary */}
            <Box sx={{ mb: 3, p: 2, backgroundColor: 'grey.50', borderRadius: 1 }}>
                <Typography variant="h6" gutterBottom>Order Summary</Typography>
                {cart.map((item, index) => (
                    <Box key={index} sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                        <Typography>
                            {item.name} × {item.quantity}
                        </Typography>
                        <Typography>
                            ${(item.price * item.quantity).toFixed(2)}
                        </Typography>
                    </Box>
                ))}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 2, pt: 2, borderTop: '1px solid', borderColor: 'grey.300' }}>
                    <Typography variant="h6">Total</Typography>
                    <Typography variant="h6">
                        ${(orderTotal / 100).toFixed(2)}
                    </Typography>
                </Box>
            </Box>

            {/* Error Display */}
            {error && (
                <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
                    {error}
                </Alert>
            )}

            {/* Square Payment Form */}
            <CateringSquarePaymentForm
                ref={paymentFormRef}
                onPaymentSuccess={handlePaymentSuccess}
                onPaymentError={handlePaymentError}
                isProcessing={isProcessing}
                orderTotal={orderTotal}
                buttonText={`Pay $${(orderTotal / 100).toFixed(2)}`}
            />

            {/* Back Button */}
            <Button
                variant="outlined"
                fullWidth
                onClick={() => onCheckoutComplete(null)}
                disabled={isProcessing}
                sx={{ mt: 2 }}
            >
                Back to Cart
            </Button>
        </Box>
    );
};
