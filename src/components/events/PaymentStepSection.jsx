import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Box, Typography, Button, Alert, CircularProgress, Stack, Radio, RadioGroup, FormControlLabel, Divider, TextField } from '@mui/material';
import { PaymentForm, CreditCard } from 'react-square-web-payments-sdk';
import { Card as EvervaultCard, themes as evervaultThemes } from '@evervault/react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { LOYALTY_API_URL } from '@/constants/events/eventsConstants';
import { AddOnsStepSection } from '@/components/events/AddOnsStepSection';

const CHECKOUT_API_URL = 'https://viif6favb73jr3pm2ph6qcten40ethnp.lambda-url.us-east-1.on.aws';

// ─── Square Card Form ───
function SquareCardForm({ onCardData, isProcessing, squareAppId, squareLocationId }) {
    const [error, setError] = useState(null);

    const handleTokenize = useCallback((token) => {
        if (token.status === 'OK') {
            setError(null);
            onCardData({ paymentNonce: token.token });
        } else {
            setError(token.errors?.[0]?.message || 'Card tokenization failed. Please try again.');
        }
    }, [onCardData]);

    return (
        <Box>
            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
            <PaymentForm
                applicationId={squareAppId}
                locationId={squareLocationId}
                cardTokenizeResponseReceived={handleTokenize}
            >
                <CreditCard
                    buttonProps={{
                        isLoading: isProcessing,
                        css: {
                            backgroundColor: '#000',
                            '&:hover': { backgroundColor: '#222' },
                            fontSize: '16px',
                            fontWeight: 600,
                        },
                    }}
                >
                    {isProcessing ? 'Processing...' : 'Pay & Register'}
                </CreditCard>
            </PaymentForm>
        </Box>
    );
}

// ─── Evervault Card Theme ───
const evCardTheme = evervaultThemes.minimal({
    styles: {
        ':root': { '--icon-offset': '39px' },
        input: {
            height: '50px',
            fontSize: '16px',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            border: '1px solid rgba(0,0,0,0.23)',
            boxShadow: 'none',
            '&:focus': { borderColor: '#000' },
        },
        label: {
            fontSize: '14px',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        },
        '.field[ev-valid=false] input': { borderColor: '#d32f2f' },
    },
});

// Catches a hard render throw from the Evervault card (e.g. its provider never initialized) and
// signals the parent to fall back to the underlying processor's native form.
class EvervaultErrorBoundary extends React.Component {
    constructor(props) { super(props); this.state = { crashed: false }; }
    static getDerivedStateFromError() { return { crashed: true }; }
    componentDidCatch(err) { try { console.error('[EvervaultCard] render error', err?.message); } catch (_) {} this.props.onError?.(); }
    render() { return this.state.crashed ? null : this.props.children; }
}

// ─── Evervault Card Form (with graceful fallback) ───
// Evervault's app-key fetch can fail on some machines (ad blockers / corporate filters / clock skew
// blocking js.evervault.com). When it does, we detect it (onError, a hard crash, or a readiness
// timeout) and fall back to the SAME underlying processor's native card form — the checkout backend
// charges whatever credential it receives (Stripe token or Square nonce), so payment still completes.
function EvervaultCardForm({ onCardData, isProcessing, fallbackKind, stripePublishableKey, squareAppId, squareLocationId }) {
    const [cardState, setCardState] = useState(null);
    const [error, setError] = useState(null);
    const [evPhase, setEvPhase] = useState('loading'); // 'loading' | 'ready' | 'failed'

    // If Evervault hasn't signaled ready within the window, treat it as failed and fall back.
    useEffect(() => {
        if (evPhase !== 'loading') return undefined;
        const t = setTimeout(() => setEvPhase((p) => (p === 'loading' ? 'failed' : p)), 6500);
        return () => clearTimeout(t);
    }, [evPhase]);

    const handleChange = useCallback((state) => {
        setCardState(state);
        if (error) setError(null);
    }, [error]);

    const handlePay = useCallback(() => {
        if (!cardState) {
            setError('Please enter your card details.');
            return;
        }
        const card = cardState.card || cardState;
        if (!card.number) {
            setError('Please enter your card number.');
            return;
        }
        if (!card.cvc) {
            setError('Please enter your CVC.');
            return;
        }
        setError(null);
        onCardData({ encryptedCard: card });
    }, [cardState, onCardData]);

    // Evervault failed — render the underlying processor's native form instead.
    if (evPhase === 'failed') {
        const canStripe = fallbackKind === 'stripe' && !!stripePublishableKey;
        const canSquare = fallbackKind === 'square' && !!squareAppId && !!squareLocationId;
        return (
            <Box>
                <Alert severity="info" sx={{ mb: 2 }}>
                    Our secure card form couldn&apos;t load on this device — using standard card entry instead.
                </Alert>
                {canStripe && <StripeCardForm onCardData={onCardData} isProcessing={isProcessing} stripePublishableKey={stripePublishableKey} />}
                {canSquare && <SquareCardForm onCardData={onCardData} isProcessing={isProcessing} squareAppId={squareAppId} squareLocationId={squareLocationId} />}
                {!canStripe && !canSquare && (
                    <Alert severity="error">
                        Card entry is unavailable on this device (a browser extension or network may be blocking it). Please try a
                        different browser or network, or contact us to complete your registration.
                    </Alert>
                )}
            </Box>
        );
    }

    return (
        <Box>
            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
            {evPhase === 'loading' && (
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                    Loading secure card form…
                </Typography>
            )}
            <EvervaultErrorBoundary onError={() => setEvPhase('failed')}>
                <Box sx={{ mb: 2 }}>
                    <EvervaultCard
                        theme={evCardTheme}
                        icons={true}
                        onChange={handleChange}
                        onReady={() => setEvPhase('ready')}
                        onError={() => setEvPhase('failed')}
                        fields={['number', 'expiry', 'cvc']}
                    />
                </Box>
            </EvervaultErrorBoundary>
            <Button
                variant="contained"
                fullWidth
                size="large"
                onClick={handlePay}
                disabled={isProcessing || evPhase !== 'ready'}
                sx={{ bgcolor: '#000', '&:hover': { bgcolor: '#222' }, fontSize: '16px', fontWeight: 600, height: 48 }}
            >
                {isProcessing ? <CircularProgress size={24} color="inherit" /> : 'Pay & Register'}
            </Button>
        </Box>
    );
}

// ─── Stripe Card Form (inner) ───
function StripeCardFormInner({ onCardData, isProcessing }) {
    const stripe = useStripe();
    const elements = useElements();
    const [error, setError] = useState(null);

    const handlePay = useCallback(async () => {
        if (!stripe || !elements) return;
        setError(null);
        const cardElement = elements.getElement(CardElement);
        const { error: stripeError, token } = await stripe.createToken(cardElement);
        if (stripeError) {
            setError(stripeError.message);
            return;
        }
        onCardData({ stripeToken: token.id });
    }, [stripe, elements, onCardData]);

    return (
        <Box>
            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
            <Box sx={{
                mb: 2, border: '1px solid rgba(0,0,0,0.23)', borderRadius: '4px',
                px: '14px', height: 50,
                '&:focus-within': { borderColor: '#000' },
                '& .StripeElement': { lineHeight: '50px' },
            }}>
                <CardElement options={{
                    style: {
                        base: {
                            fontSize: '16px',
                            lineHeight: '50px',
                            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                            color: '#000',
                            '::placeholder': { color: '#aab7c4' },
                        },
                        invalid: { color: '#d32f2f' },
                    },
                }} />
            </Box>
            <Button
                variant="contained"
                fullWidth
                size="large"
                onClick={handlePay}
                disabled={isProcessing || !stripe}
                sx={{ bgcolor: '#000', '&:hover': { bgcolor: '#222' }, fontSize: '16px', fontWeight: 600, height: 48 }}
            >
                {isProcessing ? <CircularProgress size={24} color="inherit" /> : 'Pay & Register'}
            </Button>
        </Box>
    );
}

function StripeCardForm({ onCardData, isProcessing, stripePublishableKey }) {
    const stripePromise = useMemo(
        () => stripePublishableKey ? loadStripe(stripePublishableKey) : null,
        [stripePublishableKey]
    );

    if (!stripePromise) {
        return <Alert severity="error">Stripe is not configured. Please contact support.</Alert>;
    }

    return (
        <Elements stripe={stripePromise}>
            <StripeCardFormInner onCardData={onCardData} isProcessing={isProcessing} />
        </Elements>
    );
}

// ─── Main PaymentStepSection ───
// US states with NO state sales tax — mirror the server guard so the payment page never DISPLAYS a
// phantom tax for these even if a rate is missing/misconfigured. (AK omitted: local-option taxes.)
const ZERO_TAX_STATES = new Set(['DE', 'MT', 'NH', 'OR']);

export const PaymentStepSection = ({ currentEvent, paymentMethod, paymentError, squareLocationId, locationTaxRate, locationState, selectedDate, selectedLocationId, onSelectPaymentMethod, onSubmit, onAddOnsChange, onBack }) => {
    // Resolve per-stop pricing for tentpole events
    let admissionFeeCents = currentEvent?.['Admission Fee Cents'] || currentEvent?.admissionFeeCents || 0;
    let pointsCost = currentEvent?.['Points Cost'] || currentEvent?.pointsCost || 0;
    let upsellBundles = currentEvent?.registrationUpsellBundles || currentEvent?.['Registration Upsell Bundles'] || [];
    if ((currentEvent?.type === 'Tentpole') && Array.isArray(currentEvent?.schedule) && selectedDate) {
        const selDate = (selectedDate || '').substring(0, 10);
        const stop = currentEvent.schedule.find(s => s.date === selDate && s.locationId === selectedLocationId)
            || currentEvent.schedule.find(s => s.date === selDate);
        if (stop) {
            const stopFee = stop.admissionFeeCents || stop['Admission Fee Cents'] || 0;
            const stopPts = stop.pointsCost || stop['Points Cost'] || 0;
            if (stopFee > 0) admissionFeeCents = stopFee;
            if (stopPts > 0) pointsCost = stopPts;
            if (Array.isArray(stop.registrationUpsellBundles) && stop.registrationUpsellBundles.length) upsellBundles = stop.registrationUpsellBundles;
        }
    }
    const hasDollarPrice = admissionFeeCents > 0;
    // Per-location sales-tax rate (decimal) from the locations feed; fall back to NJ 6.625% only if the
    // location has no rate on file. The server still computes the authoritative charge per location.
    // Guard: a no-sales-tax state (DE, etc.) always shows 0% regardless of feed/fallback — mirrors the
    // server clamp so Newark DE can never display a phantom tax even if its rate is missing.
    const rawRate = (locationTaxRate != null && !isNaN(Number(locationTaxRate))) ? Number(locationTaxRate) : 0.06625;
    const TAX_RATE = ZERO_TAX_STATES.has(String(locationState || '').toUpperCase()) ? 0 : rawRate;
    const taxRateLabel = `${+(TAX_RATE * 100).toFixed(4)}%`;
    const hasPointsPrice = pointsCost > 0;
    const hasBothOptions = hasDollarPrice && hasPointsPrice;

    // Auto-select when there's only one option
    const defaultMethod = paymentMethod || (hasBothOptions ? '' : hasDollarPrice ? 'card' : hasPointsPrice ? 'points' : '');
    const [selectedMethod, setSelectedMethod] = useState(defaultMethod);
    const [isProcessing, setIsProcessing] = useState(false);
    // Registration add-ons apply to card payment only (server ignores them for points). Their cents
    // feed the preview; the server re-derives the authoritative price.
    const [addOnCents, setAddOnCents] = useState(0);
    const effectiveAddOnCents = selectedMethod === 'card' ? addOnCents : 0;
    const subtotalCents = admissionFeeCents + effectiveAddOnCents;
    const taxCents = hasDollarPrice ? Math.round(subtotalCents * TAX_RATE) : 0;
    const totalCents = subtotalCents + taxCents;
    // Clear add-on selection if the user switches away from card.
    useEffect(() => {
        if (selectedMethod !== 'card' && addOnCents !== 0) { setAddOnCents(0); onAddOnsChange?.([]); }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedMethod]);
    const [loyaltyPhone, setLoyaltyPhone] = useState('');
    const [loyaltyBalance, setLoyaltyBalance] = useState(null);
    const [loyaltyLoading, setLoyaltyLoading] = useState(false);
    const [loyaltyError, setLoyaltyError] = useState('');

    // Checkout config state
    const [checkoutConfig, setCheckoutConfig] = useState(null);
    const [configLoading, setConfigLoading] = useState(true);
    const [configError, setConfigError] = useState('');

    // Fetch checkout config on mount
    useEffect(() => {
        if (!hasDollarPrice) {
            setConfigLoading(false);
            return;
        }
        let cancelled = false;
        (async () => {
            try {
                const res = await fetch(CHECKOUT_API_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'getCheckoutConfig', environment: window.location.hostname.includes('beta') ? 'beta' : 'production' }),
                });
                const data = await res.json();
                const result = typeof data.body === 'string' ? JSON.parse(data.body) : data;
                if (!cancelled) setCheckoutConfig(result);
            } catch (err) {
                if (!cancelled) setConfigError('Failed to load payment configuration.');
            } finally {
                if (!cancelled) setConfigLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [hasDollarPrice]);

    const handleMethodChange = (e) => {
        const method = e.target.value;
        setSelectedMethod(method);
        if (method !== 'card') {
            onSelectPaymentMethod(method, null);
        }
    };

    // Unified card data callback — receives { paymentNonce } or { stripeToken } or { encryptedCard }
    const handleCardData = useCallback((cardData) => {
        setIsProcessing(true);
        onSelectPaymentMethod('card', cardData);
        setTimeout(() => {
            onSubmit();
            setIsProcessing(false);
        }, 50);
    }, [onSelectPaymentMethod, onSubmit]);

    const handleLoyaltyLookup = async () => {
        if (!loyaltyPhone || !LOYALTY_API_URL) return;
        setLoyaltyLoading(true);
        setLoyaltyError('');
        try {
            const digits = loyaltyPhone.replace(/\D/g, '');
            const phone = digits.length === 10 ? `+1${digits}` : digits.length === 11 && digits.startsWith('1') ? `+${digits}` : loyaltyPhone;
            const res = await fetch(LOYALTY_API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'getConsumerLoyalty', phone }),
            });
            const data = await res.json();
            if (data?.balance != null) {
                setLoyaltyBalance(data.balance);
                if (data.balance < pointsCost) {
                    setLoyaltyError(`Insufficient points. You have ${data.balance} points but need ${pointsCost}.`);
                } else {
                    onSelectPaymentMethod('points', null);
                }
            } else {
                setLoyaltyError('No loyalty account found for this phone number.');
            }
        } catch (err) {
            setLoyaltyError('Failed to look up loyalty account.');
        } finally {
            setLoyaltyLoading(false);
        }
    };

    const handlePointsSubmit = () => {
        onSubmit();
    };

    // Determine effective Square location: event location's Square ID > config default
    const effectiveSquareLocationId = squareLocationId || checkoutConfig?.squareLocationId || '';
    const effectiveSquareAppId = checkoutConfig?.squareAppId || '';

    // Render the correct card form based on checkout config
    const renderCardForm = () => {
        if (configLoading) {
            return (
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                    <CircularProgress size={24} />
                </Box>
            );
        }
        if (configError || !checkoutConfig) {
            return <Alert severity="error">{configError || 'Payment configuration unavailable.'}</Alert>;
        }

        const pm = checkoutConfig.paymentMethod;

        if (pm === 'square_web_sdk') {
            return (
                <SquareCardForm
                    onCardData={handleCardData}
                    isProcessing={isProcessing}
                    squareAppId={effectiveSquareAppId}
                    squareLocationId={effectiveSquareLocationId}
                />
            );
        }

        if (pm === 'stripe') {
            return (
                <StripeCardForm
                    onCardData={handleCardData}
                    isProcessing={isProcessing}
                    stripePublishableKey={checkoutConfig.stripePublishableKey}
                />
            );
        }

        if (pm === 'evervault_stripe' || pm === 'evervault_square') {
            return (
                <EvervaultCardForm
                    onCardData={handleCardData}
                    isProcessing={isProcessing}
                    fallbackKind={pm === 'evervault_square' ? 'square' : 'stripe'}
                    stripePublishableKey={checkoutConfig.stripePublishableKey}
                    squareAppId={effectiveSquareAppId}
                    squareLocationId={effectiveSquareLocationId}
                />
            );
        }

        return <Alert severity="error">Unsupported payment method configured.</Alert>;
    };

    return (
        <Box>
            <Typography variant="h2" component="h2" gutterBottom>
                Payment
            </Typography>
            {hasDollarPrice && selectedMethod === 'card' && upsellBundles.length > 0 && (
                <AddOnsStepSection
                    bundles={upsellBundles}
                    onChange={(sel) => {
                        setAddOnCents((sel || []).reduce((s, a) => s + (a.priceCents || 0), 0));
                        onAddOnsChange?.(sel);
                    }}
                />
            )}
            {hasDollarPrice && (
                <Box sx={{ mb: 3 }}>
                    <Stack spacing={0.5}>
                        <Stack direction="row" justifyContent="space-between">
                            <Typography variant="body1" color="text.secondary">Registration fee</Typography>
                            <Typography variant="body1" color="text.secondary">${(admissionFeeCents / 100).toFixed(2)}</Typography>
                        </Stack>
                        {effectiveAddOnCents > 0 && (
                            <Stack direction="row" justifyContent="space-between">
                                <Typography variant="body1" color="text.secondary">Add-ons</Typography>
                                <Typography variant="body1" color="text.secondary">${(effectiveAddOnCents / 100).toFixed(2)}</Typography>
                            </Stack>
                        )}
                        <Stack direction="row" justifyContent="space-between">
                            <Typography variant="body2" color="text.secondary">Tax ({taxRateLabel})</Typography>
                            <Typography variant="body2" color="text.secondary">${(taxCents / 100).toFixed(2)}</Typography>
                        </Stack>
                        <Divider sx={{ my: 0.5 }} />
                        <Stack direction="row" justifyContent="space-between">
                            <Typography variant="body1" fontWeight={600}>Total</Typography>
                            <Typography variant="body1" fontWeight={600}>${(totalCents / 100).toFixed(2)}</Typography>
                        </Stack>
                    </Stack>
                    {hasPointsPrice && (
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                            Or pay with {pointsCost} loyalty points
                        </Typography>
                    )}
                </Box>
            )}
            {!hasDollarPrice && hasPointsPrice && (
                <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                    {pointsCost} loyalty points
                </Typography>
            )}

            {hasBothOptions && (
                <RadioGroup value={selectedMethod} onChange={handleMethodChange}>
                    <FormControlLabel value="card" control={<Radio />} label="Pay with Card" />
                    <FormControlLabel value="points" control={<Radio />} label="Pay with Loyalty Points" />
                </RadioGroup>
            )}

            {paymentError && <Alert severity="error" sx={{ mt: 1, mb: 1 }}>{paymentError}</Alert>}

            {/* Card payment form */}
            {selectedMethod === 'card' && (
                <Box sx={{ mt: 2, mb: 2 }}>
                    {renderCardForm()}
                </Box>
            )}

            {/* Points payment — lookup */}
            {selectedMethod === 'points' && (
                <Box sx={{ mt: 2, mb: 2 }}>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                        Enter your phone number to look up your loyalty account.
                    </Typography>
                    <Stack direction="row" spacing={1} alignItems="flex-start">
                        <TextField
                            label="Phone Number"
                            value={loyaltyPhone}
                            onChange={(e) => setLoyaltyPhone(e.target.value)}
                            size="small"
                            sx={{ flex: 1 }}
                        />
                        <Button
                            variant="outlined"
                            onClick={handleLoyaltyLookup}
                            disabled={loyaltyLoading || !loyaltyPhone}
                        >
                            {loyaltyLoading ? <CircularProgress size={20} /> : 'Look Up'}
                        </Button>
                    </Stack>
                    {loyaltyBalance != null && !loyaltyError && (
                        <Alert severity="success" sx={{ mt: 1 }}>
                            Balance: {loyaltyBalance} points. {pointsCost} points will be deducted.
                        </Alert>
                    )}
                    {loyaltyError && <Alert severity="error" sx={{ mt: 1 }}>{loyaltyError}</Alert>}
                </Box>
            )}

            {/* Only show bottom buttons for points (card forms have their own submit button) */}
            {selectedMethod !== 'card' && (
                <>
                    <Divider sx={{ my: 2 }} />
                    <Stack direction="row" spacing={2}>
                        <Button variant="text" onClick={onBack}>Back</Button>
                        <Button
                            variant="contained"
                            onClick={handlePointsSubmit}
                            disabled={
                                !selectedMethod ||
                                (selectedMethod === 'points' && (loyaltyBalance == null || loyaltyBalance < pointsCost))
                            }
                            fullWidth
                        >
                            Pay & Register
                        </Button>
                    </Stack>
                </>
            )}

            {/* Back button only for card (submit is inside the card form) */}
            {selectedMethod === 'card' && (
                <>
                    <Divider sx={{ my: 2 }} />
                    <Button variant="text" onClick={onBack}>Back</Button>
                </>
            )}

            {/* No method selected yet — show back button */}
            {!selectedMethod && (
                <>
                    <Divider sx={{ my: 2 }} />
                    <Button variant="text" onClick={onBack}>Back</Button>
                </>
            )}
        </Box>
    );
};
