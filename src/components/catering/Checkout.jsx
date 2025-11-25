import React, { useState, useEffect } from 'react';
import { 
    Box, Typography, Button, Radio, RadioGroup, FormControlLabel, 
    FormControl, Divider, CircularProgress, Alert 
} from '@mui/material';
import { format } from 'date-fns';
import { CREATE_INVOICE, PROCESS_INVOICE_URL, SQUARE_APP_ID, SQUARE_LOCATION_ID } from '@/constants/catering/cateringConstants';

// Helper function to format phone number to E.164
const formatPhoneNumberE164 = (mobileNumber) => {
    const digits = (mobileNumber || '').replace(/\D/g, '');
    if (digits.length === 10) return `+1${digits}`;
    if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
    return mobileNumber;
};

// Helper to format time from 24h to 12h
const formatTime = (time24) => {
    if (!time24) return '';
    const [hours, minutes] = time24.split(':');
    const hour = parseInt(hours);
    const period = hour >= 12 ? 'pm' : 'am';
    const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    return `${displayHour}:${minutes}${period}`;
};

export const Checkout = ({ sendToCatering, cateringState }) => {
    if (!cateringState || !cateringState.context) {
        console.error("Checkout component received invalid cateringState prop:", cateringState);
        return <Typography color="error">Error: Checkout state not available.</Typography>;
    }

    const { cart, contactInfo, fulfillmentDetails, isAuthenticated, accountId, locations } = cateringState.context;
    const { type, locationId, address, selectedDate, selectedTime } = fulfillmentDetails;

    // Payment method state
    const [paymentMethod, setPaymentMethod] = useState(''); // '', 'card', 'invoice', 'save'
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState(null);

    // Square Payment Form States
    const [isScriptLoaded, setScriptLoaded] = useState(false);
    const [isFormInitialized, setIsFormInitialized] = useState(false);
    const [cardInstance, setCardInstance] = useState(null);
    const [scriptError, setScriptError] = useState('');

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

    // Initialize Square card when card payment is selected
    useEffect(() => {
        if (!isScriptLoaded || paymentMethod !== 'card') {
            // Destroy card if switching away from card payment
            if (cardInstance) {
                cardInstance.destroy();
                setCardInstance(null);
                setIsFormInitialized(false);
            }
            return;
        }

        const initializeCard = async () => {
            try {
                console.log("[Checkout] Initializing Square payments...");
                const payments = window.Square.payments(SQUARE_APP_ID, SQUARE_LOCATION_ID);
                const card = await payments.card();
                await card.attach('#catering-card-container');
                setCardInstance(card);
                setIsFormInitialized(true);
                console.log("[Checkout] Card instance ready");
            } catch (e) {
                console.error('[Checkout] Card initialization failed', e);
                setScriptError('Failed to initialize payment form.');
            }
        };

        initializeCard();

        return () => {
            if (cardInstance) {
                cardInstance.destroy();
            }
        };
    }, [isScriptLoaded, paymentMethod]);

    // Get location details
    const selectedLocation = locations?.find(loc => loc?.['Location ID'] === locationId);

    // Calculation functions
    const getApplicableDiscount = (cartItem) => {
        if (!cartItem?.item) return null;
        const { item, quantity } = cartItem;
        if (!item?.discounts || item.discounts.length === 0 || !isAuthenticated) return null;
        const sortedDiscounts = [...item.discounts].sort((a, b) => b.minimumQuantity - a.minimumQuantity);
        return sortedDiscounts.find(d => quantity >= d.minimumQuantity) || null;
    };

    const calculateLineItemTotal = (cartItem) => {
        if (!cartItem?.item) return 0;
        let itemPrice = cartItem.item['Item Price'] || 0;
        const applicableDiscount = getApplicableDiscount(cartItem);
        if (applicableDiscount) {
            itemPrice = itemPrice - (itemPrice * applicableDiscount.discountPercentage / 100);
        }
        const modifiersTotal = Object.values(cartItem.selectedModifiers || {}).reduce((sum, mod) => {
            return sum + (mod?.['Modifier Price'] || 0);
        }, 0);
        return (itemPrice + modifiersTotal) * (cartItem.quantity || 0);
    };

    const subtotal = cart.reduce((sum, item) => sum + calculateLineItemTotal(item), 0);
    const tax = subtotal * 0.07;
    const total = subtotal + tax;
    const totalCents = Math.round(total * 100);

    // Build order line items for Square
    const buildOrderLineItems = () => {
        return cart.map(cartItem => {
            const { item, selectedModifiers, quantity } = cartItem;
            const basePrice = item['Item Price'] || 0;
            const applicableDiscount = getApplicableDiscount(cartItem);
            const finalPrice = applicableDiscount 
                ? basePrice - (basePrice * applicableDiscount.discountPercentage / 100)
                : basePrice;
            
            const modifiersTotal = Object.values(selectedModifiers || {}).reduce((sum, mod) => {
                return sum + (mod?.['Modifier Price'] || 0);
            }, 0);

            const modifierNames = Object.values(selectedModifiers || {})
                .map(mod => mod?.['Modifier Name'])
                .filter(Boolean)
                .join(', ');

            return {
                name: item['Item Name'],
                quantity: String(quantity),
                base_price_money: { amount: Math.round((finalPrice + modifiersTotal) * 100), currency: 'USD' },
                note: modifierNames || undefined
            };
        });
    };

    const buildFulfillmentNote = () => {
        const dateStr = selectedDate ? format(new Date(selectedDate), 'EEEE, MMMM do yyyy') : 'Not specified';
        const timeStr = selectedTime ? formatTime(selectedTime) : 'Not specified';
        
        if (type === 'pickup' && selectedLocation) {
            return `Pickup at ${selectedLocation['Location Name']}, ${selectedLocation.Address} on ${dateStr} at ${timeStr}`;
        } else if (type === 'delivery' && address) {
            return `Delivery to ${address.street}, ${address.city}, ${address.state} ${address.zip} on ${dateStr} at ${timeStr}`;
        }
        return '';
    };

    // Handle Place Order
    const handlePlaceOrder = async () => {
        setError(null);
        setIsProcessing(true);

        if (paymentMethod === 'card') {
            await handleCardPayment();
        } else if (paymentMethod === 'invoice') {
            await handleInvoicePayment();
        } else if (paymentMethod === 'save') {
            await handleSaveOrder();
        }
    };

    const handleCardPayment = async () => {
        if (!cardInstance || !isFormInitialized) {
            setError('Payment form not ready');
            setIsProcessing(false);
            return;
        }

        try {
            console.log('[Checkout] Tokenizing card...');
            const result = await cardInstance.tokenize();
            if (result.status !== 'OK') {
                throw new Error(result.errors?.map(e => e.message).join(' ') || 'Tokenization failed');
            }

            console.log('[Checkout] Creating invoice and order...');
            const payload = {
                order: {
                    location_id: SQUARE_LOCATION_ID,
                    line_items: buildOrderLineItems(),
                    customer_id: null
                },
                invoice: {
                    location_id: SQUARE_LOCATION_ID,
                    primary_recipient: {
                        customer_id: null,
                        given_name: contactInfo.firstName,
                        family_name: contactInfo.lastName,
                        email_address: contactInfo.email,
                        phone_number: formatPhoneNumberE164(contactInfo.mobileNumber),
                        company_name: contactInfo.organizationName || undefined
                    },
                    payment_requests: [{ request_type: "BALANCE", due_date: null, automatic_payment_source: "NONE", reminders: [] }],
                    delivery_method: "EMAIL",
                    title: "Catering Order Invoice",
                    description: buildFulfillmentNote() || "Thank you!",
                    scheduled_at: new Date().toISOString(),
                    accepted_payment_methods: { card: true, square_gift_card: false, bank_account: false, buy_now_pay_later: false, cash_app_pay: false },
                    custom_fields: [
                        { label: "Account Type", value: contactInfo.accountType || "N/A" },
                        { label: "Fulfillment Type", value: type === 'pickup' ? 'Pickup' : 'Delivery' }
                    ],
                    sale_or_service_date: new Date().toISOString().split('T')[0],
                    store_payment_method_enabled: false
                }
            };

            const invResp = await fetch(CREATE_INVOICE, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!invResp.ok) throw new Error('Invoice creation failed');
            const invData = await invResp.json();

            console.log('[Checkout] Processing payment...');
            const payResp = await fetch(PROCESS_INVOICE_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sourceId: result.token,
                    amountMoney: { amount: totalCents, currency: 'USD' },
                    invoiceId: invData.invoice?.id || invData.invoiceId,
                    orderId: invData.order?.id || invData.orderId,
                    accountId,
                    cardDetails: result.details.card,
                    locationId: SQUARE_LOCATION_ID
                })
            });
            if (!payResp.ok) throw new Error('Payment failed');

            console.log('[Checkout] Payment successful!');
            alert("Payment successful! Your order has been placed.");
            sendToCatering({ type: 'GO_TO_BROWSING' });
        } catch (error) {
            console.error('[Checkout] Payment error:', error);
            setError(error.message || 'Payment failed');
            setIsProcessing(false);
        }
    };

    const handleInvoicePayment = async () => {
        try {
            console.log('[Checkout] Generating invoice...');
            const payload = {
                order: {
                    location_id: SQUARE_LOCATION_ID,
                    line_items: buildOrderLineItems(),
                    customer_id: null
                },
                invoice: {
                    location_id: SQUARE_LOCATION_ID,
                    primary_recipient: {
                        customer_id: null,
                        given_name: contactInfo.firstName,
                        family_name: contactInfo.lastName,
                        email_address: contactInfo.email,
                        phone_number: formatPhoneNumberE164(contactInfo.mobileNumber),
                        company_name: contactInfo.organizationName || undefined
                    },
                    payment_requests: [{ request_type: "BALANCE", due_date: null, automatic_payment_source: "NONE", reminders: [] }],
                    delivery_method: "EMAIL",
                    title: "Catering Order Invoice",
                    description: buildFulfillmentNote() || "Thank you!",
                    scheduled_at: new Date().toISOString(),
                    accepted_payment_methods: { card: true, square_gift_card: false, bank_account: false, buy_now_pay_later: false, cash_app_pay: false },
                    custom_fields: [
                        { label: "Account Type", value: contactInfo.accountType || "N/A" },
                        { label: "Fulfillment Type", value: type === 'pickup' ? 'Pickup' : 'Delivery' }
                    ],
                    sale_or_service_date: new Date().toISOString().split('T')[0],
                    store_payment_method_enabled: false
                }
            };

            const invResp = await fetch(CREATE_INVOICE, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!invResp.ok) throw new Error('Invoice creation failed');

            console.log('[Checkout] Invoice generated successfully!');
            alert("Invoice has been sent to your email. You can pay using the methods listed on the invoice.");
            sendToCatering({ type: 'GO_TO_BROWSING' });
        } catch (error) {
            console.error('[Checkout] Invoice generation error:', error);
            setError(error.message || 'Failed to generate invoice');
            setIsProcessing(false);
        }
    };

    const handleSaveOrder = async () => {
        // Placeholder for save order functionality
        console.log('[Checkout] Saving order for later...');
        alert("Order saved! You can complete it later from your saved orders.");
        setIsProcessing(false);
        // TODO: Implement save order logic
    };

    return (
        <Box>
            <Typography variant="h2" component="h1" gutterBottom sx={{ fontWeight: 'bold' }}>
                Checkout
            </Typography>

            {/* Contact Information, Fulfillment Details, Date & Time - Grey bordered box */}
            <Box sx={{ border: '1px solid', borderColor: 'grey.300', borderRadius: 1, mb: 3 }}>
                {/* Contact Information */}
                <Box sx={{ p: 2 }}>
                    <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1 }}>
                        Contact Information
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        {contactInfo.email}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        {contactInfo.mobileNumber}
                    </Typography>
                </Box>

                <Divider />

                {/* Pickup Location or Delivery Address */}
                <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <Box>
                        <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1 }}>
                            {type === 'pickup' ? 'Pickup Location' : 'Delivery Address'}
                        </Typography>
                        {type === 'pickup' && selectedLocation && (
                            <>
                                <Typography variant="body2">{selectedLocation['Location Name']}</Typography>
                                <Typography variant="body2" color="text.secondary">{selectedLocation.Address}</Typography>
                            </>
                        )}
                        {type === 'delivery' && address && (
                            <>
                                <Typography variant="body2">{address.street}</Typography>
                                {address.aptSuite && <Typography variant="body2">{address.aptSuite}</Typography>}
                                <Typography variant="body2" color="text.secondary">
                                    {address.city}, {address.state} {address.zip}
                                </Typography>
                            </>
                        )}
                    </Box>
                    <Button 
                        size="small" 
                        onClick={() => sendToCatering({ type: 'GO_BACK' })}
                        sx={{ color: 'primary.main', textTransform: 'none' }}
                    >
                        Change
                    </Button>
                </Box>

                <Divider />

                {/* Date and Time */}
                <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <Box>
                        <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1 }}>
                            {type === 'pickup' ? 'Pickup' : 'Delivery'} Date & Time
                        </Typography>
                        <Typography variant="body2">
                            {selectedDate ? format(new Date(selectedDate), 'EEEE, MMMM do yyyy') : 'Not selected'}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            {selectedTime ? formatTime(selectedTime) : 'Not selected'}
                        </Typography>
                    </Box>
                    <Button 
                        size="small" 
                        onClick={() => sendToCatering({ type: 'GO_TO_DATE_SELECTION' })}
                        sx={{ color: 'primary.main', textTransform: 'none' }}
                    >
                        Change
                    </Button>
                </Box>
            </Box>

            {/* Order Summary */}
            <Box sx={{ mb: 3 }}>
                <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 2 }}>
                    Order Summary
                </Typography>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography>Subtotal</Typography>
                    <Typography>${subtotal.toFixed(2)}</Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography>Tax (7%)</Typography>
                    <Typography>${tax.toFixed(2)}</Typography>
                </Box>
                <Divider sx={{ my: 2 }} />
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="h6" sx={{ fontWeight: 'bold' }}>Total</Typography>
                    <Typography variant="h6" sx={{ fontWeight: 'bold' }}>${total.toFixed(2)}</Typography>
                </Box>
            </Box>

            {/* Payment Method Selection */}
            <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 2 }}>
                Payment Method
            </Typography>
            
            <Box sx={{ border: '1px solid', borderColor: 'grey.300', borderRadius: 1, mb: 3 }}>
                <FormControl component="fieldset" fullWidth>
                    <RadioGroup value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                        {/* Credit Card */}
                        <Box sx={{ p: 2 }}>
                            <FormControlLabel 
                                value="card" 
                                control={<Radio />} 
                                label="Credit Card" 
                            />
                            {paymentMethod === 'card' && (
                                <Box sx={{ ml: 4, mt: 2 }}>
                                    {scriptError && <Alert severity="error" sx={{ mb: 2 }}>{scriptError}</Alert>}
                                    {!isScriptLoaded && (
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                            <CircularProgress size={20} />
                                            <Typography variant="body2">Loading payment form...</Typography>
                                        </Box>
                                    )}
                                    <Box id="catering-card-container" sx={{ minHeight: '100px' }}></Box>
                                </Box>
                            )}
                        </Box>

                        <Divider />

                        {/* Pay by Invoice */}
                        <Box sx={{ p: 2 }}>
                            <FormControlLabel 
                                value="invoice" 
                                control={<Radio />} 
                                label="Pay by Invoice (Pay Later)" 
                            />
                            {paymentMethod === 'invoice' && (
                                <Box sx={{ ml: 4, mt: 2, p: 2, backgroundColor: 'grey.50', borderRadius: 1 }}>
                                    <Typography variant="body2" color="text.secondary">
                                        An invoice will be sent to your email address. You can pay using the payment methods listed on the invoice.
                                    </Typography>
                                </Box>
                            )}
                        </Box>

                        <Divider />

                        {/* Save Order */}
                        <Box sx={{ p: 2 }}>
                            <FormControlLabel 
                                value="save" 
                                control={<Radio />} 
                                label="Save This Order and Create a New Order" 
                            />
                            {paymentMethod === 'save' && (
                                <Box sx={{ ml: 4, mt: 2, p: 2, backgroundColor: 'grey.50', borderRadius: 1 }}>
                                    <Typography variant="body2" color="text.secondary">
                                        This order will be saved to your account as unpaid. You can complete it later from your saved orders.
                                    </Typography>
                                </Box>
                            )}
                        </Box>
                    </RadioGroup>
                </FormControl>
            </Box>

            {/* Error Display */}
            {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

            {/* Place Order Button */}
            <Button
                variant="contained"
                fullWidth
                sx={{ mt: 3 }}
                disabled={!paymentMethod || isProcessing}
                onClick={handlePlaceOrder}
            >
                {isProcessing ? <CircularProgress size={24} /> : 'Place Order'}
            </Button>
        </Box>
    );
};
