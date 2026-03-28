import React, { useState, useEffect, useRef, useCallback, useMemo, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, Button, TextField, CircularProgress, Alert, Divider,
  Stack, Paper, Chip, ToggleButtonGroup, ToggleButton, Collapse, InputAdornment, Skeleton,
  useMediaQuery, useTheme, Checkbox, FormControlLabel, Radio,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import PlaceIcon from '@mui/icons-material/Place';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import CreditCardIcon from '@mui/icons-material/CreditCard';
import LockIcon from '@mui/icons-material/Lock';
import EmailIcon from '@mui/icons-material/Email';
import { parsePhoneNumber } from 'libphonenumber-js';
import { PaymentForm, CreditCard } from 'react-square-web-payments-sdk';
import { Card as EvervaultCard, themes as evervaultThemes } from '@evervault/react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import useCart from '@/hooks/useCart';
import { useCheckout } from '@/components/commerce/CheckoutContext';
import { useShopify } from '@/contexts/commerce/ShopifyContext_GraphQL';

const PackageViewer3D = React.lazy(() => import('@/components/commerce/PackageViewer3D'));

const SQUARE_APP_ID = 'sq0idp-A1843GRqcXFxz2UUacyJXA';
const SQUARE_LOCATION_ID = 'TBFZCF69MMCE1';

const CHECKOUT_API_URL = 'https://viif6favb73jr3pm2ph6qcten40ethnp.lambda-url.us-east-1.on.aws';
const SHIPPING_API_URL = 'https://thugumzwi4445lq5q7qhnjfwoe0mrwjl.lambda-url.us-east-1.on.aws';
const LOCATIONS_URL = 'https://data.surrealcreamery.com/locations.json';
const GOOGLE_MAPS_API_KEY = 'AIzaSyBo0VtpHTnsl_iy68nHBt5hi6vPdBtcmpo';

const TIP_OPTIONS = [0, 200, 300, 500]; // cents

const SHIPPING_ACTIONS = ['getShippingRates', 'checkDeliveryAvailability', 'validateDeliveryAddress'];

function callApi(action, data = {}) {
  const url = SHIPPING_ACTIONS.includes(action) ? SHIPPING_API_URL : CHECKOUT_API_URL;
  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...data }),
  }).then(async res => {
    const json = await res.json();
    const result = typeof json.body === 'string' ? JSON.parse(json.body) : json;
    if (!res.ok || result.error) throw new Error(result.error || 'Request failed');
    return result;
  });
}

// ─── Payment Card Form (Square Web Payments SDK) ───
function PaymentCardForm({ onCardData, isProcessing, squareAppId, squareLocationId }) {
  const [error, setError] = useState(null);

  const handleTokenize = useCallback((token, buyer) => {
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
        applicationId={squareAppId || SQUARE_APP_ID}
        locationId={squareLocationId || SQUARE_LOCATION_ID}
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
          {isProcessing ? 'Processing...' : 'Place Order'}
        </CreditCard>
      </PaymentForm>
    </Box>
  );
}

// ─── Evervault Card Theme (mimics Square Web SDK look) ───
const evCardTheme = evervaultThemes.minimal({
  styles: {
    ':root': {
      '--icon-offset': '39px',
    },
    input: {
      height: '50px',
      fontSize: '16px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      border: '1px solid rgba(0,0,0,0.23)',
      boxShadow: 'none',
      '&:focus': {
        borderColor: '#000',
      },
    },
    label: {
      fontSize: '14px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    },
    '.field[ev-valid=false] input': {
      borderColor: '#d32f2f',
    },
  },
});

// ─── Evervault Card Form ───
function EvervaultCardForm({ onCardData, isProcessing }) {
  const [cardState, setCardState] = useState(null);
  const [error, setError] = useState(null);

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

  return (
    <Box>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      <Box sx={{ mb: 2 }}>
        <EvervaultCard
          theme={evCardTheme}
          icons={true}
          onChange={handleChange}
          fields={['number', 'expiry', 'cvc']}
        />
      </Box>
      <Button
        variant="contained"
        fullWidth
        size="large"
        onClick={handlePay}
        disabled={isProcessing}
        sx={{
          bgcolor: '#000',
          '&:hover': { bgcolor: '#222' },
          fontSize: '16px',
          fontWeight: 600,
          height: 48,
        }}
      >
        {isProcessing ? <CircularProgress size={24} color="inherit" /> : 'Place Order'}
      </Button>
    </Box>
  );
}

// ─── Stripe Card Form (Stripe Elements) ───
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
        sx={{
          bgcolor: '#000',
          '&:hover': { bgcolor: '#222' },
          fontSize: '16px',
          fontWeight: 600,
          height: 48,
        }}
      >
        {isProcessing ? <CircularProgress size={24} color="inherit" /> : 'Place Order'}
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

// ─── Order Summary Panel (shared between desktop right column and mobile expandable) ───
function OrderSummaryPanel({ cart, checkoutOrderCalc, calcLoading, calcError, fetchOrderCalc,
  fulfillmentMethods, checkoutTip, displayTotal, fmtCents,
  checkoutPromoCode, promoInput, setPromoInput, handleApplyPromo, handleRemovePromo, promoError,
  tipMode, handleTipChange, TIP_OPTIONS: tipOptions, customTip, setCustomTip, handleCustomTipBlur,
}) {
  return (
    <>
      {/* Line items */}
      {cart.map((item, idx) => (
        <Box key={item.id}>
          {idx > 0 && <Divider />}
          <Stack direction="row" spacing={2} sx={{ py: 1.5 }}>
            <Box sx={{ position: 'relative', flexShrink: 0 }}>
              {item.image && (
                <Box
                  component="img"
                  src={item.image}
                  alt={item.name}
                  sx={{ width: 56, height: 56, borderRadius: 1, objectFit: 'cover' }}
                />
              )}
              {item.quantity > 1 && (
                <Box sx={{
                  position: 'absolute', top: -6, right: -6,
                  bgcolor: 'grey.600', color: 'white', borderRadius: '50%',
                  width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.75rem', fontWeight: 700,
                }}>
                  {item.quantity}
                </Box>
              )}
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{ fontSize: '1.6rem', fontWeight: 600 }} noWrap>
                {item.name}
              </Typography>
              {item.variantName && (
                <Typography sx={{ fontSize: '1.6rem', color: 'text.secondary' }}>{item.variantName}</Typography>
              )}
              {item.modifiers?.length > 0 && (
                <Typography variant="caption" color="text.secondary" display="block">
                  {item.modifiers.map(m => m.name || m.value).join(', ')}
                </Typography>
              )}
            </Box>
            <Typography sx={{ fontSize: '1.6rem', fontWeight: 600, whiteSpace: 'nowrap', alignSelf: 'center' }}>
              {item.isFreeGift ? 'FREE' : `$${(item.unitPrice * item.quantity).toFixed(2)}`}
            </Typography>
          </Stack>
        </Box>
      ))}

      <Divider sx={{ my: 2 }} />

      {/* Promo code */}
      <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
        {checkoutPromoCode ? (
          <Chip label={checkoutPromoCode} onDelete={handleRemovePromo} color="success" variant="outlined" />
        ) : (
          <>
            <TextField
              label="Discount code"
              size="small"
              value={promoInput}
              onChange={e => setPromoInput(e.target.value)}
              sx={{ flex: 1 }}
            />
            <Button variant="outlined" onClick={handleApplyPromo} disabled={!promoInput.trim()}
              sx={{ height: 40, alignSelf: 'center' }}>
              Apply
            </Button>
          </>
        )}
      </Stack>
      {promoError && <Alert severity="error" sx={{ mb: 2 }}>{promoError}</Alert>}

      {/* Totals */}
      {calcLoading ? (
        <CircularProgress size={24} sx={{ display: 'block', mx: 'auto', my: 2 }} />
      ) : calcError ? (
        <Alert severity="error" sx={{ mb: 1 }}>
          {calcError}
          <Button size="small" onClick={() => fetchOrderCalc()} sx={{ ml: 1 }}>Retry</Button>
        </Alert>
      ) : checkoutOrderCalc ? (
        <Stack spacing={0.5} sx={{ '& .MuiTypography-root': { fontSize: '1.6rem' } }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Typography color="text.secondary">
              Subtotal · {cart.reduce((s, i) => s + i.quantity, 0)} items
            </Typography>
            <Typography>{fmtCents(checkoutOrderCalc.subtotal)}</Typography>
          </Box>
          {checkoutOrderCalc.discount > 0 && (
            <Box sx={{ display: 'flex', justifyContent: 'space-between', color: '#4caf50' }}>
              <Typography>Discount</Typography>
              <Typography>-{fmtCents(checkoutOrderCalc.discount)}</Typography>
            </Box>
          )}
          {checkoutOrderCalc.deliveryFee > 0 && (
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography color="text.secondary">
                {fulfillmentMethods.includes('delivery') && fulfillmentMethods.includes('shipping')
                  ? 'Delivery + Shipping'
                  : fulfillmentMethods.includes('shipping') ? 'Shipping' : 'Delivery Fee'}
              </Typography>
              <Typography>{fmtCents(checkoutOrderCalc.deliveryFee)}</Typography>
            </Box>
          )}
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Typography color="text.secondary">Tax</Typography>
            <Typography>{fmtCents(checkoutOrderCalc.tax)}</Typography>
          </Box>
          {checkoutTip > 0 && (
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography color="text.secondary">Tip</Typography>
              <Typography>{fmtCents(checkoutTip)}</Typography>
            </Box>
          )}
          <Divider sx={{ my: 1 }} />
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Typography fontWeight={700}>Total</Typography>
            <Typography fontWeight={700}>{fmtCents(displayTotal)}</Typography>
          </Box>
        </Stack>
      ) : (
        <CircularProgress size={24} sx={{ display: 'block', mx: 'auto', my: 2 }} />
      )}
    </>
  );
}

// ─── Main CheckoutPage ───
export default function CheckoutPage() {
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { cart, cartId, getSubtotal, clearCart } = useCart();
  const { testModeEnabled } = useShopify();
  const {
    checkoutCustomer, setCheckoutCustomer,
    checkoutFulfillment, setCheckoutFulfillment,
    checkoutOrderCalc, setCheckoutOrderCalc,
    checkoutPromoCode, setCheckoutPromoCode,
    checkoutTip, setCheckoutTip,
    checkoutConfirmation, setCheckoutConfirmation,
    otpSessionToken, setOtpSessionToken,
    authenticatedCustomerId, setAuthenticatedCustomerId,
    savedAddresses, setSavedAddresses,
    savedPaymentMethods, setSavedPaymentMethods,
    resetCheckout,
  } = useCheckout();

  const [error, setError] = useState(null);
  const [mobileOrderExpanded, setMobileOrderExpanded] = useState(false);

  // Contact info (restore from sessionStorage on revisit)
  const savedCheckout = useMemo(() => {
    try { return JSON.parse(sessionStorage.getItem('checkoutContact') || '{}'); } catch { return {}; }
  }, []);
  const [email, setEmail] = useState(savedCheckout.email || '');
  const [phone, setPhone] = useState(savedCheckout.phone || '');
  const [firstName, setFirstName] = useState(savedCheckout.firstName || '');
  const [lastName, setLastName] = useState(savedCheckout.lastName || '');

  // Contact gate
  const [contactVerified, setContactVerified] = useState(false);
  const [customerMatch, setCustomerMatch] = useState(null);
  const [customerLoading, setCustomerLoading] = useState(false);

  // OTP sign-in
  const [otpStep, setOtpStep] = useState(null); // null | 'prompt' | 'sending' | 'input' | 'verifying' | 'verified'
  const [otpCode, setOtpCode] = useState('');
  const [otpError, setOtpError] = useState(null);
  const [otpCooldown, setOtpCooldown] = useState(0);

  // Saved data selectors
  const [selectedSavedAddressId, setSelectedSavedAddressId] = useState(null); // null = new address
  const [selectedSavedPaymentId, setSelectedSavedPaymentId] = useState(null); // null = new card

  // Post-checkout save
  const [saveNewAddress, setSaveNewAddress] = useState(true);
  const [saveNewCard, setSaveNewCard] = useState(true);
  const [newAddressLabel, setNewAddressLabel] = useState('Home');

  // Address (shared for delivery + shipping) — restore from sessionStorage on revisit
  const savedAddress = useMemo(() => {
    try { return JSON.parse(sessionStorage.getItem('checkoutAddress') || '{}'); } catch { return {}; }
  }, []);
  const [addressFields, setAddressFields] = useState(savedAddress.fields || { address1: '', address2: '', city: '', provinceCode: '', zip: '' });
  const [addressInput, setAddressInput] = useState(savedAddress.input || '');
  const [addressSuggestions, setAddressSuggestions] = useState([]);
  const [useManualAddress, setUseManualAddress] = useState(false);
  const [addressValidated, setAddressValidated] = useState(!!savedAddress.fields?.address1);

  // Delivery check result
  const [deliveryResult, setDeliveryResult] = useState(null);
  const [deliveryChecking, setDeliveryChecking] = useState(false);

  // Shipping rates (ShipEngine dynamic rates)
  const [shippingRates, setShippingRates] = useState([]);
  const [shippingRatesLoading, setShippingRatesLoading] = useState(false);
  const [binPacking, setBinPacking] = useState([]);
  const [selectedShippingTierId, setSelectedShippingTierId] = useState(null);

  // Google Maps refs
  const autocompleteServiceRef = useRef(null);
  const placesServiceRef = useRef(null);
  const sessionTokenRef = useRef(null);

  // Review / tip
  const [promoInput, setPromoInput] = useState('');
  const [promoError, setPromoError] = useState(null);
  const [customTip, setCustomTip] = useState('');
  const [tipMode, setTipMode] = useState('preset');
  const [calcLoading, setCalcLoading] = useState(false);
  const [calcError, setCalcError] = useState(null);

  // Payment
  const [paymentProcessing, setPaymentProcessing] = useState(false);
  const [paymentConfig, setPaymentConfig] = useState(null);
  const [configLoading, setConfigLoading] = useState(true);

  // Locations
  const [locations, setLocations] = useState([]);

  // Derived
  const fulfillmentMethods = useMemo(() =>
    [...new Set(cart.map(i => i.fulfillmentMethod || 'pickup'))],
  [cart]);

  const needsShippingAddress = fulfillmentMethods.includes('shipping');
  const needsDeliveryAddress = fulfillmentMethods.includes('delivery');
  const needsAddress = needsShippingAddress || needsDeliveryAddress;

  const [selectedLocationSlug, setSelectedLocationSlug] = useState(() =>
    localStorage.getItem('selectedLocation') || '');

  const selectedLocation = useMemo(() =>
    locations.find(l => l.id === selectedLocationSlug), [locations, selectedLocationSlug]);

  const savedDeliveryAddress = useMemo(() => {
    try {
      const saved = localStorage.getItem('deliveryAddress');
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  }, []);

  useEffect(() => {
    fetch(LOCATIONS_URL).then(r => r.json()).then(setLocations).catch(() => {});
  }, []);

  useEffect(() => {
    callApi('getCheckoutConfig')
      .then(setPaymentConfig)
      .catch(() => setPaymentConfig({ paymentMethod: 'square_web_sdk' }))
      .finally(() => setConfigLoading(false));
  }, []);

  useEffect(() => {
    if (cart.length === 0 && !checkoutConfirmation) {
      navigate('/desserts', { replace: true });
    }
  }, [cart, checkoutConfirmation, navigate]);

  // ─── Order calculation ───
  const buildCalcPayload = useCallback(() => ({
    cartItems: cart.map(item => ({
      sku: item.sku, variantSku: item.variantSku, name: item.name, variantName: item.variantName,
      clientPrice: item.unitPrice, quantity: item.quantity, modifiers: item.modifiers || [],
      isFreeGift: item.isFreeGift || false, discountId: item.discountId || null,
    })),
    pickupLocation: selectedLocationSlug,
    fulfillmentMethods,
    deliveryAddress: addressFields.address1 ? addressFields : (savedDeliveryAddress || undefined),
    shipdayDeliveryFee: deliveryResult?.deliveryFee ?? savedDeliveryAddress?.shipdayDeliveryFee ?? undefined,
    selectedShippingTierId: selectedShippingTierId || undefined,
    shippingRateAmount: shippingRates.find(r => r.id === selectedShippingTierId)?.rate ?? undefined,
    shippingRateName: shippingRates.find(r => r.id === selectedShippingTierId)?.name ?? undefined,
    tipAmountCents: 0,
    promoCode: checkoutPromoCode || undefined,
  }), [cart, selectedLocationSlug, fulfillmentMethods, addressFields, savedDeliveryAddress, deliveryResult, selectedShippingTierId, shippingRates, checkoutPromoCode]);

  const fetchOrderCalc = useCallback(async (overrides = {}) => {
    setCalcLoading(true);
    setCalcError(null);
    try {
      const payload = { ...buildCalcPayload(), ...overrides };
      const result = await callApi('calculateSquareOrder', payload);
      setCheckoutOrderCalc(result);
    } catch (err) {
      console.error('[fetchOrderCalc]', err);
      setCalcError(err.message || 'Failed to calculate order');
    }
    setCalcLoading(false);
  }, [buildCalcPayload, setCheckoutOrderCalc]);

  // Order calc fires after contact verification (not on mount)
  useEffect(() => {
    if (contactVerified && checkoutPromoCode !== undefined && cart.length > 0) fetchOrderCalc();
  }, [checkoutPromoCode]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load Google Maps script
  useEffect(() => {
    if (!needsAddress) return;
    if (window.google?.maps) return;
    const existing = document.querySelector('script[src*="maps.googleapis.com/maps/api/js"]');
    if (existing) return;
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places`;
    script.async = true;
    document.head.appendChild(script);
  }, [needsAddress]);

  // Init autocomplete services
  useEffect(() => {
    if (!needsAddress) return;
    const init = () => {
      if (!window.google?.maps?.places) return;
      autocompleteServiceRef.current = new window.google.maps.places.AutocompleteService();
      const div = document.createElement('div');
      placesServiceRef.current = new window.google.maps.places.PlacesService(div);
      sessionTokenRef.current = new window.google.maps.places.AutocompleteSessionToken();
    };
    if (window.google?.maps?.places) { init(); return; }
    const interval = setInterval(() => {
      if (window.google?.maps?.places) { init(); clearInterval(interval); }
    }, 200);
    return () => clearInterval(interval);
  }, [needsAddress]);

  // Hide Google's pac-container dropdown (we render our own)
  useEffect(() => {
    if (!needsAddress) return;
    const style = document.createElement('style');
    style.textContent = '.pac-container { display: none !important; }';
    document.head.appendChild(style);
    return () => style.remove();
  }, [needsAddress]);

  // Pre-fill address from savedDeliveryAddress for delivery items
  useEffect(() => {
    if (needsDeliveryAddress && savedDeliveryAddress) {
      setAddressFields({
        address1: savedDeliveryAddress.address1 || '',
        address2: savedDeliveryAddress.address2 || '',
        city: savedDeliveryAddress.city || '',
        provinceCode: savedDeliveryAddress.provinceCode || '',
        zip: savedDeliveryAddress.zip || '',
      });
      setAddressInput(`${savedDeliveryAddress.address1}, ${savedDeliveryAddress.city}, ${savedDeliveryAddress.provinceCode} ${savedDeliveryAddress.zip}`);
      setAddressValidated(true);
      // Pre-fill delivery result if available from saved
      if (savedDeliveryAddress.shipdayDeliveryFee != null) {
        setDeliveryResult({
          available: true,
          deliveryFee: savedDeliveryAddress.shipdayDeliveryFee,
          estimatedMinutes: savedDeliveryAddress.estimatedMinutes,
        });
      }
    }
  }, [needsDeliveryAddress, savedDeliveryAddress]);

  // Persist contact info to sessionStorage
  useEffect(() => {
    if (email || firstName || lastName || phone) {
      sessionStorage.setItem('checkoutContact', JSON.stringify({ email, phone, firstName, lastName }));
    }
  }, [email, phone, firstName, lastName]);

  // Persist address to sessionStorage
  useEffect(() => {
    if (addressFields.address1) {
      sessionStorage.setItem('checkoutAddress', JSON.stringify({ fields: addressFields, input: addressInput }));
    }
  }, [addressFields, addressInput]);

  // Auto-verify contact on return if previously filled
  useEffect(() => {
    if (savedCheckout.email && savedCheckout.firstName && savedCheckout.lastName) {
      setContactVerified(true);
      if (cart.length > 0) fetchOrderCalc();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch dynamic shipping rates from ShipEngine after address is confirmed
  useEffect(() => {
    if (!needsShippingAddress || !addressValidated || !addressFields.zip) return;
    let cancelled = false;
    (async () => {
      setShippingRatesLoading(true);
      try {
        const result = await callApi('getShippingRates', {
          shipTo: { address1: addressFields.address1, city: addressFields.city, provinceCode: addressFields.provinceCode, zip: addressFields.zip },
          locationSlug: selectedLocationSlug || undefined,
          cartItems: cart.map(item => ({ sku: item.sku, variantSku: item.variantSku, quantity: item.quantity })),
        });
        if (cancelled) return;
        const rates = result.rates || [];
        setBinPacking(result.binPacking || []);
        setShippingRates(rates);
        if (rates.length > 0) {
          setSelectedShippingTierId(rates[0].id);
        } else {
          // Fallback to static tiers
          if (paymentConfig?.shippingTiers?.length > 0) {
            setSelectedShippingTierId(paymentConfig.shippingTiers[0].id);
          }
        }
      } catch (err) {
        console.warn('[getShippingRates] Failed, falling back to static tiers:', err);
        if (!cancelled && paymentConfig?.shippingTiers?.length > 0) {
          setSelectedShippingTierId(paymentConfig.shippingTiers[0].id);
        }
      }
      if (!cancelled) setShippingRatesLoading(false);
    })();
    return () => { cancelled = true; };
  }, [needsShippingAddress, addressValidated, addressFields.zip]); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-trigger order calc when shipping tier changes
  useEffect(() => {
    if (selectedShippingTierId && cart.length > 0) {
      const selectedRate = shippingRates.find(r => r.id === selectedShippingTierId);
      fetchOrderCalc({
        selectedShippingTierId,
        ...(selectedRate ? { shippingRateAmount: selectedRate.rate, shippingRateName: selectedRate.name } : {}),
      });
    }
  }, [selectedShippingTierId]); // eslint-disable-line react-hooks/exhaustive-deps

  const displayTotal = (checkoutOrderCalc?.total || 0) + checkoutTip;
  const totalItems = cart.reduce((s, i) => s + i.quantity, 0);

  const handleApplyPromo = () => {
    const code = promoInput.trim().toUpperCase();
    if (!code) return;
    setCheckoutPromoCode(code);
    setPromoError(null);
  };

  const handleRemovePromo = () => {
    setCheckoutPromoCode('');
    setPromoInput('');
    setPromoError(null);
  };

  const handleTipChange = (_, val) => {
    if (val === 'custom') {
      setTipMode('custom');
    } else if (val !== null) {
      setTipMode('preset');
      setCheckoutTip(val);
      setCustomTip('');
    }
  };

  const handleCustomTipBlur = () => {
    const cents = Math.round(parseFloat(customTip || '0') * 100);
    setCheckoutTip(cents >= 0 ? cents : 0);
  };

  // ─── Address autocomplete handlers ───
  const handleAddressInputChange = useCallback((value) => {
    setAddressInput(value);
    setAddressValidated(false);
    if (value.length < 3 || !autocompleteServiceRef.current) {
      setAddressSuggestions([]);
      return;
    }
    autocompleteServiceRef.current.getPlacePredictions(
      { input: value, componentRestrictions: { country: 'us' }, types: ['address'], sessionToken: sessionTokenRef.current },
      (predictions) => setAddressSuggestions(predictions || []),
    );
  }, []);

  const handleSelectAddressSuggestion = useCallback((suggestion) => {
    setAddressSuggestions([]);
    setAddressInput(suggestion.description);
    if (!placesServiceRef.current) return;
    placesServiceRef.current.getDetails(
      { placeId: suggestion.place_id, fields: ['address_components'], sessionToken: sessionTokenRef.current },
      (place) => {
        if (!place?.address_components) return;
        const comps = place.address_components;
        const get = (type, short) => {
          const c = comps.find(c => c.types.includes(type));
          return c ? (short ? c.short_name : c.long_name) : '';
        };
        const addr = {
          address1: `${get('street_number')} ${get('route')}`.trim(),
          address2: '',
          city: get('locality') || get('sublocality_level_1'),
          provinceCode: get('administrative_area_level_1', true),
          zip: get('postal_code'),
        };
        setAddressFields(addr);
        setAddressValidated(true);
        // Reset session token for next prediction cycle
        sessionTokenRef.current = new window.google.maps.places.AutocompleteSessionToken();
        // Auto-check delivery availability for delivery items
        if (needsDeliveryAddress) checkDeliveryForAddress(addr);
      },
    );
  }, [needsDeliveryAddress]); // eslint-disable-line react-hooks/exhaustive-deps

  const checkDeliveryForAddress = useCallback(async (addr) => {
    setDeliveryChecking(true);
    setDeliveryResult(null);
    try {
      const result = await callApi('checkDeliveryAvailability', {
        deliveryAddress: addr,
        pickupLocation: selectedLocationSlug,
      });
      // If a different location is closer, switch to it
      if (result.available && result.switchedLocation && result.storeId) {
        setSelectedLocationSlug(result.storeId);
        localStorage.setItem('selectedLocation', result.storeId);
        window.dispatchEvent(new CustomEvent('locationChanged', { detail: { locationId: result.storeId } }));
      }
      setDeliveryResult(result);
      // Re-calc order with the delivery fee
      if (result.available && result.deliveryFee != null) {
        fetchOrderCalc({ shipdayDeliveryFee: result.deliveryFee, selectedShippingTierId });
      }
    } catch (err) {
      setDeliveryResult({ available: false, message: err.message });
    }
    setDeliveryChecking(false);
  }, [selectedLocationSlug, fetchOrderCalc, selectedShippingTierId]);

  const fmtCents = (c) => `$${(c / 100).toFixed(2)}`;

  const formatPhone = (value) => {
    const digits = value.replace(/\D/g, '').slice(0, 10);
    if (digits.length <= 3) return digits.length ? `(${digits}` : '';
    if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  };
  const subtotalCents = Math.round(getSubtotal() * 100);

  // ─── Contact gate: Continue handler ───
  const handleContactContinue = useCallback(async () => {
    if (!firstName.trim() || !lastName.trim()) {
      setError('First and last name are required.');
      return;
    }
    if (!email.trim() || !/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError('A valid email address is required.');
      return;
    }
    setError(null);
    setCustomerLoading(true);
    try {
      let formattedPhone = '';
      if (phone.trim()) {
        try {
          const parsed = parsePhoneNumber(phone.trim(), 'US');
          if (parsed?.isValid()) formattedPhone = parsed.format('E.164');
        } catch {}
      }
      const result = await callApi('checkoutCustomerMatch', {
        email: email.trim(),
        phone: formattedPhone || undefined,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
      });
      setCustomerMatch(result);
      // Store resolved customer identity
      if (result.customerId) {
        setAuthenticatedCustomerId(result.customerId);
        console.log('[checkoutCustomerMatch] Resolved customer:', result.customerId, 'account:', result.accountId);
      }
      if (result.customers?.length > 1) {
        console.log('[checkoutCustomerMatch] Multiple accounts found:', JSON.stringify(result, null, 2));
      }
      // Show OTP sign-in prompt only when customer has saved data
      if (result.otpChallengeAvailable) {
        setOtpStep('prompt');
      }
    } catch (err) {
      console.warn('[checkoutCustomerMatch] Error:', err);
      setCustomerMatch({ matchType: 'none', customers: [] });
    }
    setContactVerified(true);
    setCustomerLoading(false);
    // Trigger order calculation now that contact is verified
    if (cart.length > 0) fetchOrderCalc();
  }, [firstName, lastName, email, phone, cart, fetchOrderCalc]);

  const handleEditContact = useCallback(() => {
    setContactVerified(false);
    setCustomerMatch(null);
    setOtpStep(null);
    setOtpCode('');
    setOtpError(null);
  }, []);

  // ─── OTP sign-in handlers ───
  const handleSendOtp = useCallback(async () => {
    setOtpStep('sending');
    setOtpError(null);
    try {
      await callApi('sendCheckoutOtp', { to: email.trim(), channel: 'email' });
      setOtpStep('input');
      setOtpCooldown(60);
    } catch (err) {
      setOtpError(err.message || 'Failed to send verification code');
      setOtpStep('prompt');
    }
  }, [email]);

  const handleVerifyOtp = useCallback(async () => {
    if (otpCode.length !== 6) {
      setOtpError('Please enter the 6-digit code');
      return;
    }
    setOtpStep('verifying');
    setOtpError(null);
    try {
      const result = await callApi('verifyCheckoutOtp', { to: email.trim(), code: otpCode });
      if (!result.success) {
        setOtpError(result.message || 'Invalid code');
        setOtpStep('input');
        return;
      }
      setOtpSessionToken(result.sessionToken);
      setAuthenticatedCustomerId(result.customerId);

      // Fetch saved addresses + payment methods
      try {
        const profile = await callApi('getCustomerCheckoutProfile', { sessionToken: result.sessionToken });
        setSavedAddresses(profile.addresses || []);
        setSavedPaymentMethods(profile.savedPaymentMethods || []);
      } catch (profileErr) {
        console.warn('[OTP] Could not fetch profile:', profileErr);
      }

      setOtpStep('verified');
    } catch (err) {
      setOtpError(err.message || 'Verification failed');
      setOtpStep('input');
    }
  }, [email, otpCode, setOtpSessionToken, setAuthenticatedCustomerId, setSavedAddresses, setSavedPaymentMethods]);

  const handleSkipOtp = useCallback(() => {
    setOtpStep(null);
    setOtpCode('');
    setOtpError(null);
  }, []);

  // OTP cooldown timer
  useEffect(() => {
    if (otpCooldown <= 0) return;
    const timer = setTimeout(() => setOtpCooldown(c => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [otpCooldown]);

  // ─── Validate contact & submit payment ───
  const validateAndPay = useCallback((nonce) => {
    if (!firstName.trim() || !lastName.trim()) {
      setError('First and last name are required.');
      return false;
    }
    if (!email.trim() || !/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError('A valid email address is required.');
      return false;
    }
    if (needsAddress) {
      if (!addressFields.address1 || !addressFields.city || !addressFields.provinceCode || !addressFields.zip) {
        setError('Please fill in all required address fields.');
        return false;
      }
    }
    if (needsDeliveryAddress && deliveryResult && !deliveryResult.available) {
      setError('Delivery is not available to this address. Please update your address.');
      return false;
    }
    if (needsShippingAddress && !selectedShippingTierId) {
      setError('Please select a shipping option.');
      return false;
    }

    let formattedPhone = '';
    if (phone.trim()) {
      try {
        const parsed = parsePhoneNumber(phone.trim(), 'US');
        if (parsed?.isValid()) formattedPhone = parsed.format('E.164');
      } catch {}
    }

    const customer = {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.trim(),
      phone: formattedPhone,
    };
    setCheckoutCustomer(customer);
    setCheckoutFulfillment({
      methods: fulfillmentMethods,
      location: selectedLocation,
      address: needsAddress ? addressFields : null,
    });
    setError(null);
    return customer;
  }, [firstName, lastName, email, phone, needsAddress, needsDeliveryAddress, needsShippingAddress, addressFields, deliveryResult, selectedShippingTierId, fulfillmentMethods, selectedLocation, setCheckoutCustomer, setCheckoutFulfillment]);

  const handleCardPayment = async (cardData) => {
    const customer = validateAndPay(cardData);
    if (!customer) return;

    setPaymentProcessing(true);
    setError(null);
    try {
      const payload = {
        cartItems: cart.map(item => ({
          sku: item.sku, variantSku: item.variantSku, name: item.name, variantName: item.variantName,
          clientPrice: item.unitPrice, quantity: item.quantity, modifiers: item.modifiers || [],
          isFreeGift: item.isFreeGift || false, discountId: item.discountId || null,
        })),
        pickupLocation: selectedLocationSlug,
        fulfillmentMethods,
        customer,
        deliveryAddress: addressFields.address1 ? addressFields : (savedDeliveryAddress || undefined),
        shipdayDeliveryFee: deliveryResult?.deliveryFee ?? savedDeliveryAddress?.shipdayDeliveryFee ?? undefined,
        selectedShippingTierId: selectedShippingTierId || undefined,
        shippingRateAmount: shippingRates.find(r => r.id === selectedShippingTierId)?.rate ?? undefined,
        shippingRateName: shippingRates.find(r => r.id === selectedShippingTierId)?.name ?? undefined,
        tipAmountCents: checkoutTip,
        promoCode: checkoutPromoCode || undefined,
        cartSessionId: cartId,
        testMode: testModeEnabled || undefined,
      };

      // Saved payment method path
      if (cardData.savedPaymentMethodId) {
        payload.savedPaymentMethodId = cardData.savedPaymentMethodId;
        payload.otpSessionToken = otpSessionToken;
      } else if (cardData.paymentNonce) {
        payload.paymentNonce = cardData.paymentNonce;
      } else if (cardData.stripeToken) {
        payload.stripeToken = cardData.stripeToken;
        payload.paymentMethod = 'stripe';
      } else if (cardData.encryptedCard) {
        payload.encryptedCard = cardData.encryptedCard;
        payload.paymentMethod = paymentConfig?.paymentMethod || 'evervault_stripe';
      }

      // Card saving (only when authenticated)
      if (otpSessionToken && saveNewCard && !cardData.savedPaymentMethodId) {
        payload.saveCard = true;
        payload.otpSessionToken = otpSessionToken;
      }

      const result = await callApi('createSquareCheckout', payload);
      setCheckoutConfirmation(result);
      clearCart();
      sessionStorage.removeItem('checkoutContact');
      sessionStorage.removeItem('checkoutAddress');
    } catch (err) {
      setError(err.message);
    }
    setPaymentProcessing(false);
  };

  // Handler for placing order with a saved payment method
  const handleSavedCardPayment = useCallback(async () => {
    if (!selectedSavedPaymentId) return;
    await handleCardPayment({ savedPaymentMethodId: selectedSavedPaymentId });
  }, [selectedSavedPaymentId, handleCardPayment]); // eslint-disable-line react-hooks/exhaustive-deps

  // Shared props for OrderSummaryPanel
  const summaryProps = {
    cart, checkoutOrderCalc, calcLoading, calcError, fetchOrderCalc,
    fulfillmentMethods, checkoutTip, displayTotal, fmtCents,
    checkoutPromoCode, promoInput, setPromoInput, handleApplyPromo, handleRemovePromo, promoError,
    tipMode, handleTipChange, TIP_OPTIONS, customTip, setCustomTip, handleCustomTipBlur,
  };

  // ─── Confirmation ───
  if (checkoutConfirmation) {
    return (
      <Box sx={{ maxWidth: 520, mx: 'auto', p: 3, textAlign: 'center' }}>
        <CheckCircleIcon sx={{ fontSize: 64, color: '#4caf50', mb: 2 }} />
        <Typography variant="h5" fontWeight={700} gutterBottom>Order Confirmed!</Typography>
        <Typography color="text.secondary" sx={{ mb: 3 }}>
          Receipt #{checkoutConfirmation.receiptNumber || checkoutConfirmation.orderId?.slice(-8)}
        </Typography>
        <Paper variant="outlined" sx={{ p: 2, mb: 3, textAlign: 'left' }}>
          <Stack spacing={1}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography>Subtotal</Typography>
              <Typography>{fmtCents(checkoutConfirmation.subtotal || 0)}</Typography>
            </Box>
            {checkoutConfirmation.discount > 0 && (
              <Box sx={{ display: 'flex', justifyContent: 'space-between', color: '#4caf50' }}>
                <Typography>Discount</Typography>
                <Typography>-{fmtCents(checkoutConfirmation.discount)}</Typography>
              </Box>
            )}
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography>Tax</Typography>
              <Typography>{fmtCents(checkoutConfirmation.tax || 0)}</Typography>
            </Box>
            {checkoutConfirmation.tip > 0 && (
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography>Tip</Typography>
                <Typography>{fmtCents(checkoutConfirmation.tip)}</Typography>
              </Box>
            )}
            <Divider />
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography fontWeight={700}>Total</Typography>
              <Typography fontWeight={700}>{fmtCents(checkoutConfirmation.total || 0)}</Typography>
            </Box>
          </Stack>
        </Paper>
        {fulfillmentMethods.includes('pickup') && selectedLocation && (
          <Typography color="text.secondary" sx={{ mb: 0.5 }}>
            Pickup at <strong>{selectedLocation.name}</strong>
          </Typography>
        )}
        {fulfillmentMethods.includes('delivery') && addressFields.address1 && (
          <Typography color="text.secondary" sx={{ mb: 0.5 }}>
            Delivery to <strong>{addressFields.address1}, {addressFields.city}</strong>
          </Typography>
        )}
        {fulfillmentMethods.includes('shipping') && (
          <Typography color="text.secondary" sx={{ mb: 2 }}>
            Shipping to <strong>{addressFields.address1}, {addressFields.city}, {addressFields.provinceCode} {addressFields.zip}</strong>
          </Typography>
        )}
        {checkoutConfirmation.receiptUrl && (
          <Button variant="outlined" href={checkoutConfirmation.receiptUrl} target="_blank" sx={{ mb: 2 }}>
            View Receipt
          </Button>
        )}

        {/* Post-checkout save prompts (only for authenticated users with new data) */}
        {authenticatedCustomerId && (needsAddress || !selectedSavedPaymentId) && (
          <Paper variant="outlined" sx={{ p: 2, mb: 2, textAlign: 'left' }}>
            <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>Save for next time?</Typography>
            {needsAddress && selectedSavedAddressId === null && addressFields.address1 && (
              <Box>
                <FormControlLabel
                  control={<Checkbox checked={saveNewAddress} onChange={e => setSaveNewAddress(e.target.checked)} size="small" />}
                  label={
                    <Typography sx={{ fontSize: '1.4rem' }}>
                      Save address ({addressFields.address1}, {addressFields.city})
                    </Typography>
                  }
                />
                {saveNewAddress && (
                  <TextField
                    size="small" placeholder="Label (e.g. Home, Work)"
                    value={newAddressLabel}
                    onChange={e => setNewAddressLabel(e.target.value)}
                    sx={{ ml: 4, mt: 0.5, width: 200, '& .MuiOutlinedInput-root': { height: 36 } }}
                  />
                )}
              </Box>
            )}
          </Paper>
        )}

        <Button
          variant="contained" fullWidth size="large"
          onClick={async () => {
            // Fire save API calls if authenticated and checked
            if (authenticatedCustomerId && otpSessionToken) {
              if (saveNewAddress && needsAddress && selectedSavedAddressId === null && addressFields.address1) {
                try {
                  await callApi('saveCheckoutAddress', {
                    sessionToken: otpSessionToken,
                    address: {
                      label: newAddressLabel || 'Address',
                      types: [needsDeliveryAddress ? 'delivery' : 'shipping'],
                      ...addressFields,
                    },
                  });
                } catch (e) { console.warn('Address save failed:', e); }
              }
            }
            resetCheckout();
            navigate('/desserts');
          }}
          sx={{ mt: 1, bgcolor: '#000', '&:hover': { bgcolor: '#222' } }}
        >
          Continue Shopping
        </Button>
      </Box>
    );
  }

  // ─── Left column: Contact, Shipping, Payment ───
  const leftColumn = (
    <Box sx={{ flex: 1, minWidth: 0 }}>
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

      {/* Contact */}
      <Typography variant="h2">Contact</Typography>
      <Box sx={{ height: 16 }} />
      {contactVerified ? (
        <Box sx={{ mb: 3 }}>
          <Paper variant="outlined" sx={{ p: 2, bgcolor: 'grey.50', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box>
              <Typography variant="body2" fontWeight={600}>{firstName} {lastName}</Typography>
              <Typography variant="body2" color="text.secondary">
                {email}{phone ? ` · ${phone}` : ''}
              </Typography>
            </Box>
            <Button
              size="small"
              onClick={handleEditContact}
              sx={{ textTransform: 'none', color: '#1976d2', fontSize: '1.6rem', minWidth: 0 }}
            >
              Edit
            </Button>
          </Paper>

          {/* OTP Sign-in Prompt */}
          {otpStep && otpStep !== 'verified' && (
            <Paper variant="outlined" sx={{ p: 2, mt: 2, bgcolor: '#f5f5f5' }}>
              {otpStep === 'prompt' && (
                <>
                  <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                    <LockIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                    <Typography sx={{ fontSize: '1.4rem', fontWeight: 500 }}>
                      Sign in to use saved addresses and payment methods
                    </Typography>
                  </Stack>
                  <Stack direction="row" spacing={1}>
                    <Button
                      variant="contained" size="small"
                      onClick={handleSendOtp}
                      sx={{ bgcolor: '#000', '&:hover': { bgcolor: '#222' }, textTransform: 'none', fontSize: '1.3rem' }}
                    >
                      Send Code to {email.trim()}
                    </Button>
                    <Button
                      size="small" onClick={handleSkipOtp}
                      sx={{ textTransform: 'none', color: 'text.secondary', fontSize: '1.3rem' }}
                    >
                      Skip
                    </Button>
                  </Stack>
                </>
              )}
              {otpStep === 'sending' && (
                <Stack direction="row" alignItems="center" spacing={1.5}>
                  <CircularProgress size={18} />
                  <Typography sx={{ fontSize: '1.4rem', color: 'text.secondary' }}>Sending code...</Typography>
                </Stack>
              )}
              {(otpStep === 'input' || otpStep === 'verifying') && (
                <>
                  <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
                    <EmailIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                    <Typography sx={{ fontSize: '1.4rem', color: 'text.secondary' }}>
                      Enter the 6-digit code sent to {email.trim()}
                    </Typography>
                  </Stack>
                  {otpError && <Alert severity="error" sx={{ mb: 1.5, py: 0 }}>{otpError}</Alert>}
                  <Stack direction="row" spacing={1} alignItems="center">
                    <TextField
                      value={otpCode}
                      onChange={e => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="000000"
                      inputProps={{ maxLength: 6, style: { textAlign: 'center', letterSpacing: 8, fontSize: 18, fontWeight: 600 } }}
                      sx={{ width: 160, '& .MuiOutlinedInput-root': { height: 44 } }}
                      disabled={otpStep === 'verifying'}
                    />
                    <Button
                      variant="contained" size="small"
                      onClick={handleVerifyOtp}
                      disabled={otpStep === 'verifying' || otpCode.length !== 6}
                      sx={{ bgcolor: '#000', '&:hover': { bgcolor: '#222' }, textTransform: 'none', fontSize: '1.3rem', height: 36 }}
                    >
                      {otpStep === 'verifying' ? <CircularProgress size={18} color="inherit" /> : 'Verify'}
                    </Button>
                    <Button
                      size="small" onClick={handleSkipOtp}
                      sx={{ textTransform: 'none', color: 'text.secondary', fontSize: '1.3rem', minWidth: 0 }}
                    >
                      Skip
                    </Button>
                  </Stack>
                  <Button
                    size="small" onClick={handleSendOtp}
                    disabled={otpCooldown > 0}
                    sx={{ mt: 1, textTransform: 'none', color: '#1976d2', fontSize: '1.2rem', p: 0, minWidth: 0, '&:hover': { bgcolor: 'transparent', textDecoration: 'underline' } }}
                  >
                    {otpCooldown > 0 ? `Resend in ${otpCooldown}s` : 'Resend code'}
                  </Button>
                </>
              )}
            </Paper>
          )}
          {otpStep === 'verified' && (
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mt: 1.5 }}>
              <CheckCircleIcon sx={{ fontSize: 18, color: '#4caf50' }} />
              <Typography sx={{ fontSize: '1.3rem', color: '#4caf50', fontWeight: 500 }}>
                Signed in — saved data loaded
              </Typography>
            </Stack>
          )}
        </Box>
      ) : (
        <>
          <Stack spacing={2} sx={{ mb: 2, '& .MuiOutlinedInput-root': { height: 50 } }}>
            <Stack direction="row" spacing={2}>
              <TextField placeholder="First name" fullWidth value={firstName}
                onChange={e => setFirstName(e.target.value)} required />
              <TextField placeholder="Last name" fullWidth value={lastName}
                onChange={e => setLastName(e.target.value)} required />
            </Stack>
            <TextField placeholder="Email" type="email" fullWidth value={email}
              onChange={e => setEmail(e.target.value)} required />
            <TextField placeholder="Phone (optional)" fullWidth value={phone}
              onChange={e => setPhone(formatPhone(e.target.value))} />
          </Stack>
          <Button
            variant="contained"
            fullWidth
            size="large"
            onClick={handleContactContinue}
            disabled={customerLoading}
            sx={{
              mb: 3,
              bgcolor: '#000',
              '&:hover': { bgcolor: '#222' },
              fontSize: '16px',
              fontWeight: 600,
              height: 48,
            }}
          >
            {customerLoading ? <CircularProgress size={24} color="inherit" /> : 'Continue'}
          </Button>
        </>
      )}

      {/* Address + Payment: visible but disabled until contact verified */}
      <Box sx={{ opacity: contactVerified ? 1 : 0.45, pointerEvents: contactVerified ? 'auto' : 'none', transition: 'opacity 0.2s' }}>

      {/* Address Section (Delivery + Shipping unified) */}
      {needsAddress && (
        <>
          <Typography variant="h2">
            {needsDeliveryAddress && needsShippingAddress ? 'Delivery & Shipping Address'
              : needsDeliveryAddress ? 'Delivery Address' : 'Shipping Address'}
          </Typography>
          <Box sx={{ height: 16 }} />

          {/* Saved address selector */}
          {savedAddresses.length > 0 && (
            <Stack spacing={1} sx={{ mb: 2 }}>
              {savedAddresses.map((addr) => (
                <Paper
                  key={addr.id}
                  variant="outlined"
                  onClick={() => {
                    setSelectedSavedAddressId(addr.id);
                    setAddressFields({
                      address1: addr.address1, address2: addr.address2 || '',
                      city: addr.city, provinceCode: addr.provinceCode, zip: addr.zip,
                    });
                    setAddressInput(`${addr.address1}, ${addr.city}, ${addr.provinceCode} ${addr.zip}`);
                    setAddressValidated(true);
                    if (needsDeliveryAddress) checkDeliveryForAddress(addr);
                  }}
                  sx={{
                    p: 2, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 2,
                    borderColor: selectedSavedAddressId === addr.id ? '#000' : 'divider',
                    borderWidth: selectedSavedAddressId === addr.id ? 2 : 1,
                    bgcolor: selectedSavedAddressId === addr.id ? 'grey.50' : 'transparent',
                    '&:hover': { bgcolor: 'action.hover' },
                  }}
                >
                  <Radio checked={selectedSavedAddressId === addr.id} sx={{ p: 0 }} />
                  <Box sx={{ flex: 1 }}>
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <Typography variant="body2" fontWeight={600}>{addr.label || 'Address'}</Typography>
                      {addr.isDefault && <Chip label="Default" size="small" sx={{ height: 20, fontSize: '1.1rem' }} />}
                    </Stack>
                    <Typography variant="body2" color="text.secondary">{addr.address1}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {addr.city}, {addr.provinceCode} {addr.zip}
                    </Typography>
                  </Box>
                </Paper>
              ))}
              <Paper
                variant="outlined"
                onClick={() => {
                  setSelectedSavedAddressId(null);
                  setAddressFields({ address1: '', address2: '', city: '', provinceCode: '', zip: '' });
                  setAddressInput('');
                  setAddressValidated(false);
                }}
                sx={{
                  p: 2, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 2,
                  borderColor: selectedSavedAddressId === null ? '#000' : 'divider',
                  borderWidth: selectedSavedAddressId === null ? 2 : 1,
                  bgcolor: selectedSavedAddressId === null ? 'grey.50' : 'transparent',
                  '&:hover': { bgcolor: 'action.hover' },
                }}
              >
                <Radio checked={selectedSavedAddressId === null} sx={{ p: 0 }} />
                <Typography variant="body2" fontWeight={600}>Use a new address</Typography>
              </Paper>
            </Stack>
          )}

          {/* Show address form when no saved address is selected (or no saved addresses) */}
          {(savedAddresses.length > 0 && selectedSavedAddressId !== null) ? null : addressValidated && addressFields.address1 && !useManualAddress ? (
            /* Confirmed address card with Edit button */
            <Paper variant="outlined" sx={{ p: 2, mb: 2, bgcolor: 'grey.50', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Box>
                <Typography variant="body2" fontWeight={600}>{addressFields.address1}{addressFields.address2 ? `, ${addressFields.address2}` : ''}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {addressFields.city}, {addressFields.provinceCode} {addressFields.zip}
                </Typography>
              </Box>
              <Button
                size="small"
                onClick={() => { setAddressValidated(false); setAddressInput(''); setAddressSuggestions([]); setShippingRates([]); setBinPacking([]); setSelectedShippingTierId(null); }}
                sx={{ textTransform: 'none', color: '#1976d2', fontSize: '1.6rem', minWidth: 0 }}
              >
                Edit
              </Button>
            </Paper>
          ) : !useManualAddress ? (
            <Box sx={{ mb: 2 }}>
              <TextField
                placeholder="Start typing your address..."
                fullWidth
                value={addressInput}
                onChange={e => handleAddressInputChange(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <PlaceIcon sx={{ color: 'text.secondary' }} />
                    </InputAdornment>
                  ),
                }}
                sx={{ '& .MuiOutlinedInput-root': { height: 50 } }}
              />
              {addressSuggestions.length > 0 && (
                <Paper
                  variant="outlined"
                  sx={{ mt: 0.5, maxHeight: 240, overflow: 'auto' }}
                >
                  {addressSuggestions.map((s) => (
                    <Box
                      key={s.place_id}
                      onClick={() => handleSelectAddressSuggestion(s)}
                      sx={{
                        px: 2, py: 1.5, cursor: 'pointer',
                        '&:hover': { bgcolor: 'action.hover' },
                        borderBottom: '1px solid', borderColor: 'divider',
                      }}
                    >
                      <Typography variant="body2">{s.description}</Typography>
                    </Box>
                  ))}
                </Paper>
              )}
            </Box>
          ) : (
            <Stack spacing={2} sx={{ mb: 2, '& .MuiOutlinedInput-root': { height: 50 } }}>
              <TextField placeholder="Street address" fullWidth required value={addressFields.address1}
                onChange={e => { setAddressFields(prev => ({ ...prev, address1: e.target.value })); setAddressValidated(!!e.target.value); }} />
              <TextField placeholder="Apt, suite, etc. (optional)" fullWidth value={addressFields.address2}
                onChange={e => setAddressFields(prev => ({ ...prev, address2: e.target.value }))} />
              <Stack direction="row" spacing={2}>
                <TextField placeholder="City" fullWidth required value={addressFields.city}
                  onChange={e => setAddressFields(prev => ({ ...prev, city: e.target.value }))} />
                <TextField placeholder="State" sx={{ width: 100 }} required value={addressFields.provinceCode}
                  onChange={e => setAddressFields(prev => ({ ...prev, provinceCode: e.target.value.toUpperCase().slice(0, 2) }))}
                  inputProps={{ maxLength: 2 }} />
              </Stack>
              <TextField placeholder="ZIP code" sx={{ width: 140 }} required value={addressFields.zip}
                onChange={e => setAddressFields(prev => ({ ...prev, zip: e.target.value.slice(0, 5) }))}
                inputProps={{ maxLength: 5 }} />
              {needsDeliveryAddress && addressFields.address1 && addressFields.city && addressFields.zip && (
                <Button
                  variant="outlined" size="small"
                  onClick={() => checkDeliveryForAddress(addressFields)}
                  disabled={deliveryChecking}
                  sx={{ alignSelf: 'flex-start' }}
                >
                  {deliveryChecking ? 'Checking...' : 'Check Delivery Availability'}
                </Button>
              )}
            </Stack>
          )}

          {(!addressValidated || useManualAddress) && (savedAddresses.length === 0 || selectedSavedAddressId === null) && (
            <Button
              size="small"
              onClick={() => setUseManualAddress(!useManualAddress)}
              sx={{ mb: 2, textTransform: 'none', color: '#1976d2', fontSize: '1.6rem', justifyContent: 'flex-start', p: 0, minWidth: 0, '&:hover': { bgcolor: 'transparent', textDecoration: 'underline' } }}
            >
              {useManualAddress ? 'Use address autocomplete' : 'Enter address manually'}
            </Button>
          )}

          {/* Delivery availability result */}
          {needsDeliveryAddress && (deliveryChecking || deliveryResult) && (
            <Box sx={{ mb: 3 }}>
              {deliveryChecking ? (
                <Paper variant="outlined" sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <CircularProgress size={20} />
                  <Typography variant="body2" color="text.secondary">Checking delivery availability...</Typography>
                </Paper>
              ) : deliveryResult?.available ? (
                <Paper variant="outlined" sx={{ p: 2, bgcolor: '#e8f5e9', borderColor: '#4caf50' }}>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <CheckCircleIcon sx={{ color: '#4caf50', fontSize: 20 }} />
                    <Typography variant="body2" fontWeight={600} color="#2e7d32">Delivery Available</Typography>
                  </Stack>
                  {deliveryResult.switchedLocation && deliveryResult.storeName && (
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                      Delivering from <strong>{deliveryResult.storeName}</strong> (closest to you)
                    </Typography>
                  )}
                  <Stack direction="row" spacing={3} sx={{ mt: 1 }}>
                    {deliveryResult.deliveryFee != null && (
                      <Typography variant="body2" color="text.secondary">
                        Fee: <strong>${deliveryResult.deliveryFee.toFixed(2)}</strong>
                      </Typography>
                    )}
                    {deliveryResult.estimatedMinutes && (
                      <Typography variant="body2" color="text.secondary">
                        Est. ~{deliveryResult.estimatedMinutes} min
                      </Typography>
                    )}
                  </Stack>
                </Paper>
              ) : deliveryResult ? (
                <Paper variant="outlined" sx={{ p: 2, bgcolor: '#fbe9e7', borderColor: '#f44336' }}>
                  <Typography variant="body2" color="error" fontWeight={600}>
                    Delivery Not Available
                  </Typography>
                  {deliveryResult.message && (
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                      {deliveryResult.message}
                    </Typography>
                  )}
                </Paper>
              ) : null}
            </Box>
          )}

          {/* Shipping method selector */}
          {needsShippingAddress && addressValidated && (
            <Box sx={{ mb: 3 }}>
              <Typography variant="h2">Shipping Method</Typography>
              {testModeEnabled && binPacking.length > 0 && (
                <Suspense fallback={<Skeleton variant="rectangular" height={200} sx={{ borderRadius: 1, mt: 2 }} />}>
                  <Box sx={{ mt: 2 }}>
                    <PackageViewer3D binPacking={binPacking} />
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1, textAlign: 'center' }}>
                      {binPacking.length} package{binPacking.length > 1 ? 's' : ''} {' \u2022 '}
                      {binPacking.reduce((s, b) => s + b.usedWeightOz, 0).toFixed(1)} oz
                    </Typography>
                  </Box>
                </Suspense>
              )}
              <Box sx={{ height: 16 }} />
              {shippingRatesLoading ? (
                <Stack direction="row" alignItems="center" spacing={1.5} sx={{ py: 2 }}>
                  <CircularProgress size={20} sx={{ color: 'text.secondary' }} />
                  <Typography variant="body2" color="text.secondary">Fetching shipping rates...</Typography>
                </Stack>
              ) : (shippingRates.length > 0 ? shippingRates : (paymentConfig?.shippingTiers || [])).length > 0 ? (
                <Stack spacing={1}>
                  {(shippingRates.length > 0 ? shippingRates : (paymentConfig?.shippingTiers || [])).map((tier) => (
                    <Paper
                      key={tier.id}
                      variant="outlined"
                      onClick={() => setSelectedShippingTierId(tier.id)}
                      sx={{
                        p: 2, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 2,
                        borderColor: selectedShippingTierId === tier.id ? '#000' : 'divider',
                        borderWidth: selectedShippingTierId === tier.id ? 2 : 1,
                        bgcolor: selectedShippingTierId === tier.id ? 'grey.50' : 'transparent',
                        '&:hover': { bgcolor: 'action.hover' },
                      }}
                    >
                      <LocalShippingIcon sx={{ color: selectedShippingTierId === tier.id ? '#000' : 'text.secondary' }} />
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="body2" fontWeight={600} sx={{ lineHeight: 1.2 }}>
                          {tier.carrier ? `${tier.carrier} — ${tier.name}` : tier.name}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ fontSize: '1.6rem', lineHeight: 1.2 }}>{tier.estimatedDays}</Typography>
                      </Box>
                      <Typography variant="body2" fontWeight={700}>${parseFloat(tier.rate).toFixed(2)}</Typography>
                    </Paper>
                  ))}
                </Stack>
              ) : (
                <Typography variant="body2" color="text.secondary">No shipping options available for this address.</Typography>
              )}
            </Box>
          )}
        </>
      )}

      {/* Payment */}
      <Typography variant="h2">Payment</Typography>
      <Box sx={{ height: 16 }} />

      {/* Saved payment method selector */}
      {savedPaymentMethods.length > 0 && (
        <Stack spacing={1} sx={{ mb: 2 }}>
          {savedPaymentMethods.map((pm) => (
            <Paper
              key={pm.id}
              variant="outlined"
              onClick={() => setSelectedSavedPaymentId(pm.id)}
              sx={{
                p: 2, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 2,
                borderColor: selectedSavedPaymentId === pm.id ? '#000' : 'divider',
                borderWidth: selectedSavedPaymentId === pm.id ? 2 : 1,
                bgcolor: selectedSavedPaymentId === pm.id ? 'grey.50' : 'transparent',
                '&:hover': { bgcolor: 'action.hover' },
              }}
            >
              <Radio checked={selectedSavedPaymentId === pm.id} sx={{ p: 0 }} />
              <CreditCardIcon sx={{ color: 'text.secondary' }} />
              <Box sx={{ flex: 1 }}>
                <Typography variant="body2" fontWeight={600}>
                  {pm.brand || 'Card'} ····{pm.last4}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Exp {String(pm.expMonth).padStart(2, '0')}/{pm.expYear}
                </Typography>
              </Box>
              {pm.isDefault && <Chip label="Default" size="small" sx={{ height: 20, fontSize: '1.1rem' }} />}
            </Paper>
          ))}
          <Paper
            variant="outlined"
            onClick={() => setSelectedSavedPaymentId(null)}
            sx={{
              p: 2, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 2,
              borderColor: selectedSavedPaymentId === null ? '#000' : 'divider',
              borderWidth: selectedSavedPaymentId === null ? 2 : 1,
              bgcolor: selectedSavedPaymentId === null ? 'grey.50' : 'transparent',
              '&:hover': { bgcolor: 'action.hover' },
            }}
          >
            <Radio checked={selectedSavedPaymentId === null} sx={{ p: 0 }} />
            <Typography variant="body2" fontWeight={600}>Use a different card</Typography>
          </Paper>
        </Stack>
      )}

      {/* Saved card: Place Order button */}
      {selectedSavedPaymentId ? (
        <Button
          variant="contained"
          fullWidth
          size="large"
          onClick={handleSavedCardPayment}
          disabled={paymentProcessing}
          sx={{
            bgcolor: '#000',
            '&:hover': { bgcolor: '#222' },
            fontSize: '16px',
            fontWeight: 600,
            height: 48,
          }}
        >
          {paymentProcessing ? <CircularProgress size={24} color="inherit" /> : 'Place Order'}
        </Button>
      ) : configLoading ? (
        <CircularProgress size={32} sx={{ display: 'block', mx: 'auto', my: 4 }} />
      ) : paymentConfig?.paymentMethod === 'stripe' ? (
        <StripeCardForm
          onCardData={handleCardPayment}
          isProcessing={paymentProcessing}
          stripePublishableKey={paymentConfig?.stripePublishableKey}
        />
      ) : paymentConfig?.paymentMethod?.startsWith('evervault') ? (
        <EvervaultCardForm onCardData={handleCardPayment} isProcessing={paymentProcessing} />
      ) : (
        <PaymentCardForm
          onCardData={handleCardPayment}
          isProcessing={paymentProcessing}
          squareAppId={paymentConfig?.squareAppId}
          squareLocationId={paymentConfig?.squareLocationId}
        />
      )}

      {/* Save card checkbox (for new cards when authenticated) */}
      {otpSessionToken && selectedSavedPaymentId === null && (
        <FormControlLabel
          control={<Checkbox checked={saveNewCard} onChange={e => setSaveNewCard(e.target.checked)} size="small" />}
          label={<Typography sx={{ fontSize: '1.4rem' }}>Save this card for future purchases</Typography>}
          sx={{ mt: 1 }}
        />
      )}

      </Box>
    </Box>
  );

  // ─── Right column (desktop): Order Summary ───
  const rightColumn = (
    <Box sx={{
      width: { md: 380 },
      flexShrink: 0,
      pl: { md: 4 },
    }}>
      <Box sx={{ position: 'sticky', top: 24 }}>
        <OrderSummaryPanel {...summaryProps} />
      </Box>
    </Box>
  );

  // ─── Mobile: Collapsible order summary bar ───
  const mobileOrderBar = (
    <Box sx={{ mt: 3 }}>
      <Box
        onClick={() => setMobileOrderExpanded(!mobileOrderExpanded)}
        sx={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          cursor: 'pointer', py: 1.5,
          borderTop: '1px solid', borderBottom: '1px solid', borderColor: 'divider',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography fontWeight={600}>Total</Typography>
          <Typography variant="body2" color="text.secondary">· {totalItems} {totalItems === 1 ? 'item' : 'items'}</Typography>
          {mobileOrderExpanded ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
        </Box>
        <Typography fontWeight={700}>{fmtCents(displayTotal)}</Typography>
      </Box>
      <Collapse in={mobileOrderExpanded}>
        <Box sx={{ pt: 2 }}>
          <OrderSummaryPanel {...summaryProps} />
        </Box>
      </Collapse>
    </Box>
  );

  return (
    <Box sx={{ width: '100%', maxWidth: 960, mx: 'auto', p: { xs: 2, sm: 3 }, pb: 8 }}>
      {isMobile ? (
        // Mobile: single column with collapsible summary at bottom
        <>
          {leftColumn}
          {mobileOrderBar}
        </>
      ) : (
        // Desktop: two-column split
        <Box sx={{ display: 'flex', gap: 0, alignItems: 'flex-start' }}>
          {leftColumn}
          {rightColumn}
        </Box>
      )}
    </Box>
  );
}
