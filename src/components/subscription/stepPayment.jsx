// /src/components/subscription/stepPayment.jsx

import React, { useEffect, useRef, useMemo } from 'react';
import { Box, Typography, Button, CircularProgress, Radio, Card, CardContent, Divider } from '@mui/material';
import SmsIcon from '@mui/icons-material/Sms';
import EmailIcon from '@mui/icons-material/Email';
import AddIcon from '@mui/icons-material/Add';
import { isValidPhoneNumber } from 'react-phone-number-input';

import OtpInput from '@/components/subscription/otpInput.jsx';
import CardBrandIcon from '@/components/subscription/cardBrandIcon.jsx';
import SquarePaymentForm from '@/components/subscription/squarePaymentForm.jsx';

const StepPayment = ({ send, current, onSnackbar }) => {
const { context } = current;
const { customerForms, maskedPhone, savedCards, selectedSavedCardId, otpCode, planId, normalizedData, primaryCustomerId } = context;

const squareFormRef = useRef(null);

useEffect(() => {
    if (primaryCustomerId && squareFormRef.current) {
        squareFormRef.current.reinitialize();
    }
}, [primaryCustomerId]);

const plan = normalizedData?.plans?.find(p => p.id === planId);

const formattedRenewalDate = useMemo(() => {
    if (!plan) {
        return null;
    }
    const renewalDate = new Date();
    const frequencyLower = plan.frequency ? plan.frequency.toLowerCase() : '';

    // ✅ FIX: The condition now correctly checks for "year" OR "annual".
    if (frequencyLower.includes('year') || frequencyLower.includes('annual')) {
        renewalDate.setFullYear(renewalDate.getFullYear() + 1);
    } else {
        renewalDate.setMonth(renewalDate.getMonth() + 1);
    }
    return renewalDate.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });
}, [plan]);

const isProcessingPayment = current.matches({ displayFlow: { authenticationOrPayment: { payment: 'processingSavedCardPayment' } } }) ||
                             current.matches({ displayFlow: { authenticationOrPayment: { payment: 'savingNewCard' } } });
const isSending = current.matches({ displayFlow: { authenticationOrPayment: { authentication: 'sendingCode' } } });
const isVerifying = current.matches({ displayFlow: { authenticationOrPayment: { authentication: 'verifyingCode' } } });

const formatCardBrand = (brand = '') => {
    if (!brand) return 'Card';
    return brand
        .toLowerCase()
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
};

const formatFrequency = (freq = '') => {
    if (!freq) return '';
    const lowerFreq = freq.toLowerCase();
    if (lowerFreq.includes('month')) return '/mo';
    if (lowerFreq.includes('year') || lowerFreq.includes('annual')) return '/yr';
    return `/${freq}`;
};


if (current.matches({ displayFlow: { authenticationOrPayment: { authentication: 'chooseMethod' } } })) {
    return (
        <>
            <Typography variant="h1" gutterBottom>Authentication Required</Typography>
            <Typography sx={{ mb: 2 }}>Please select a method to verify your identity.</Typography>
            <Box sx={{ display: 'flex', gap: 2, flexDirection: 'column' }}>
                <Button 
                    variant="outlined" 
                    startIcon={<EmailIcon />} 
                    onClick={() => send({ type: 'SEND_CODE_EMAIL' })}
                    sx={{ justifyContent: 'flex-start', py: 1.5, textTransform: 'none', color: 'black', borderColor: 'black', '& .MuiSvgIcon-root': { color: 'black' }, '&:hover': { borderColor: 'black', backgroundColor: 'rgba(0,0,0,0.04)' } }}
                >
                    {customerForms[0].email}
                </Button>
                <Button 
                    variant="outlined" 
                    startIcon={<SmsIcon />} 
                    onClick={() => send({ type: 'SEND_CODE_SMS' })} 
                    disabled={isSending || !isValidPhoneNumber(customerForms[0].phone || '')}
                    sx={{ justifyContent: 'flex-start', py: 1.5, textTransform: 'none', color: 'black', borderColor: 'black', '& .MuiSvgIcon-root': { color: 'black' }, '&:hover': { borderColor: 'black', backgroundColor: 'rgba(0,0,0,0.04)' } }}
                >
                    {maskedPhone}
                </Button>
            </Box>
            <Button sx={{ mt: 4 }} variant="grey-back" onClick={() => send({ type: 'BACK' })} disabled={isSending}>Back</Button>
        </>
    );
}

if (isSending) {
    return <Box sx={{ textAlign: 'center' }}><CircularProgress /><Typography>Sending code...</Typography></Box>;
}

if (current.matches({ displayFlow: { authenticationOrPayment: { authentication: 'enterCode' } } }) || isVerifying) {
    return (
        <>
            <Typography variant="h5" gutterBottom>Enter Verification Code</Typography>
            <Typography sx={{ mb: 2 }}>
                A 6-digit code was sent to your {context.otpMethod === 'email' ? customerForms[0].email : maskedPhone}.
            </Typography>
            {isVerifying ?
                <Box sx={{ textAlign: 'center', my: 2 }}><CircularProgress /><Typography>Verifying code...</Typography></Box>
                :
                <OtpInput onCodeChange={code => send({ type: 'UPDATE_OTP_CODE', code })} />
            }
            <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between' }}>
                <Button variant="text" onClick={() => send({ type: 'BACK_TO_METHOD_CHOICE' })} disabled={isVerifying}>Change Method</Button>
                <Button variant="contained" onClick={() => send({ type: 'SUBMIT_CODE' })} disabled={isVerifying || otpCode.length !== 6}>Verify Code</Button>
            </Box>
        </>
    );
}

if (current.matches({ displayFlow: { authenticationOrPayment: 'fetchingCardDetails' } })) {
    return <Box sx={{ textAlign: 'center' }}><CircularProgress /><Typography>Loading your saved cards...</Typography></Box>;
}

if (current.matches({ displayFlow: { authenticationOrPayment: { payment: 'confirmSavedCard' } } })) {
    return (
        <>
            {plan && (
                <Card elevation={0} sx={{ mb: 3, backgroundColor: 'grey.50' }}>
                    <CardContent>
                        <Typography variant="h1" component="h1" gutterBottom>Order Summary</Typography>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mt: 2 }}>
                            <Typography variant="body1" component="p" sx={{ fontWeight: 'bold', flexGrow: 1, mr: 2 }}>
                                {plan.name}
                            </Typography>
                            <Typography variant="body1" component="p" sx={{ fontWeight: 'bold', flexShrink: 0 }}>
                                {`$${plan.price}${formatFrequency(plan.frequency)}`}
                            </Typography>
                        </Box>
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                            {plan.description}
                        </Typography>
                        
                        <Divider sx={{ my: 2 }} />
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Typography variant="body1" color="text.secondary">
                                First renewal on
                            </Typography>
                            <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                                {formattedRenewalDate}
                            </Typography>
                        </Box>
                    </CardContent>
                </Card>
            )}
            <Typography variant="h2" component="h2" gutterBottom>Select Your Payment Method</Typography>
            <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
                {(savedCards || []).map(card => (
                    <Button key={card.id} variant="text" onClick={() => send({ type: 'SELECT_SAVED_CARD', cardId: card.id })} sx={{ width: '100%', border: '1px solid', borderWidth: card.id === selectedSavedCardId ? '2px' : '1px', borderColor: card.id === selectedSavedCardId ? 'primary.main' : 'rgba(0, 0, 0, 0.23)', borderRadius: 2, p: 1, textTransform: 'none', color: 'text.primary', '&:hover': { backgroundColor: 'action.hover', borderColor: card.id === selectedSavedCardId ? 'primary.main' : 'rgba(0, 0, 0, 0.87)', } }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                            <Radio checked={selectedSavedCardId === card.id} />
                            <Box sx={{ width: 40, height: 25, borderRadius: '4px', overflow: 'hidden', display: 'flex', alignItems: 'center', ml: 1 }}>
                                <CardBrandIcon brand={card.card_brand} />
                            </Box>
                            <Box ml={2} sx={{ textAlign: 'left' }}>
                                <Typography variant="body1">{formatCardBrand(card.card_brand)} ending in {card.last_4}</Typography>
                                <Typography variant="body2" color="text.secondary">Expires {String(card.exp_month).padStart(2, '0')}/{card.exp_year}</Typography>
                            </Box>
                        </Box>
                    </Button>
                ))}
                 <Button variant="text" onClick={() => send({ type: 'USE_NEW_CARD' })} startIcon={<AddIcon />} sx={{ mt: 1, border: '1px solid', borderColor: 'rgba(0, 0, 0, 0.23)', color: 'primary.main', alignSelf: 'flex-start', px: 2, py: 1, '&:hover': { borderColor: 'rgba(0, 0, 0, 0.87)', backgroundColor: 'rgba(0, 0, 0, 0.04)' } }}>
                    Add Credit Card
                </Button>
            </Box>
            <Box sx={{ mt: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Button fullWidth variant="contained" onClick={() => send({ type: 'PAY_WITH_SAVED_CARD' })} disabled={!selectedSavedCardId || isProcessingPayment}>
                    {isProcessingPayment ? <CircularProgress size={24} /> : 'Subscribe'}
                </Button>
                <Button variant="grey-back" fullWidth onClick={() => send({ type: 'BACK' })}>Back</Button>
            </Box>
        </>
    );
}

if (current.matches({ displayFlow: { authenticationOrPayment: { payment: 'enterNewCard' } } })) {
    return (
        <>
            <Typography variant="h1" gutterBottom>Add Credit Card Details</Typography>
            <Box sx={{ my: 2 }}>
                <SquarePaymentForm
                    ref={squareFormRef}
                    isProcessing={isProcessingPayment}
                    onNonceReceived={(nonce) => send({ type: 'SUBMIT_NONCE', nonce })}
                    onTokenizationError={(message) => onSnackbar({ open: true, message, severity: 'error' })}
                    savedCards={savedCards}
                    onSnackbar={onSnackbar}
                />
            </Box>
            <Box sx={{ mt: 2 }}>
                <Button variant="text" onClick={() => send({ type: (savedCards || []).length > 0 ? 'BACK_TO_SAVED_CARDS' : 'BACK' })}>Back</Button>
            </Box>
        </>
    );
}

console.warn('StepPayment: No UI rendered for current state:', current.value);
return null;
};

export default StepPayment;