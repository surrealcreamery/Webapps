import React, { useState, useEffect, useRef, useCallback, useMemo, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, Button, TextField, CircularProgress, Alert, Divider,
  Stack, Paper, Chip, ToggleButtonGroup, ToggleButton, Collapse, InputAdornment, Skeleton,
  useMediaQuery, useTheme, Checkbox, FormControlLabel, Radio,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined';
import StorefrontIcon from '@mui/icons-material/Storefront';
import PlaceIcon from '@mui/icons-material/Place';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import CreditCardIcon from '@mui/icons-material/CreditCard';
import LockIcon from '@mui/icons-material/Lock';
import EmailIcon from '@mui/icons-material/Email';
import ShoppingCartCheckoutIcon from '@mui/icons-material/ShoppingCartCheckout';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import HourglassBottomIcon from '@mui/icons-material/HourglassBottom';
import VerifiedIcon from '@mui/icons-material/Verified';
import { parsePhoneNumber } from 'libphonenumber-js';
import { PaymentForm, CreditCard, ApplePay, GooglePay } from 'react-square-web-payments-sdk';
import { Card as EvervaultCard, themes as evervaultThemes } from '@evervault/react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import useCart from '@/hooks/useCart';
import { useCheckout } from '@/components/commerce/CheckoutContext';
import { useLoyalty } from '@/contexts/commerce/LoyaltyContext';
import { consumerRedeem } from '@/services/loyaltyService';
import { useWebSocket } from '@/contexts/commerce/WebSocketContext';
import { groupCartByFulfillmentOrigin } from '@/utils/fulfillmentRouter';
import { trackFulfillmentSelected, trackPaymentAttempted, trackOrderCompleted, identifyUser, trackCheckoutContactEntered, trackCheckoutPickupLocationSelected, trackCheckoutShippingAddressEntered, trackCheckoutShippingRateSelected, trackCheckoutPromoApplied, trackCheckoutPromoError, trackTipSelected, trackCustomTipEntered, trackPaymentMethodSelected, trackPaymentFailed, trackOrderConfirmationViewed, trackOrderSummaryToggled } from '@/services/analytics';

const PackageViewer3D = React.lazy(() => import('@/components/commerce/PackageViewer3D'));

const SQUARE_APP_ID = 'sq0idp-A1843GRqcXFxz2UUacyJXA';
const SQUARE_LOCATION_ID = 'TBFZCF69MMCE1';

const CHECKOUT_API_URL = 'https://viif6favb73jr3pm2ph6qcten40ethnp.lambda-url.us-east-1.on.aws';
const SHIPPING_API_URL = 'https://thugumzwi4445lq5q7qhnjfwoe0mrwjl.lambda-url.us-east-1.on.aws';
const LOCATIONS_URL = 'https://data.surrealcreamery.com/locations.json';
const GOOGLE_MAPS_API_KEY = 'AIzaSyBo0VtpHTnsl_iy68nHBt5hi6vPdBtcmpo';

const TIP_PERCENTAGES = [10, 15, 20]; // percent

const SHIPPING_ACTIONS = ['getShippingRates', 'getMultiOriginShippingRates', 'checkDeliveryAvailability', 'validateDeliveryAddress'];

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
function PaymentCardForm({ onCardData, isProcessing, squareAppId, squareLocationId, children }) {
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
        {children}
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
function EvervaultCardForm({ onCardData, isProcessing, children }) {
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
      {children}
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
        {isProcessing ? <CircularProgress size={24} color="inherit" aria-label="Submitting order" /> : 'Place Order'}
      </Button>
    </Box>
  );
}

// ─── Stripe Card Form (Stripe Elements) ───
function StripeCardFormInner({ onCardData, isProcessing, children }) {
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
      {children}
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
        {isProcessing ? <CircularProgress size={24} color="inherit" aria-label="Submitting order" /> : 'Place Order'}
      </Button>
    </Box>
  );
}

function StripeCardForm({ onCardData, isProcessing, stripePublishableKey, children }) {
  const stripePromise = useMemo(
    () => stripePublishableKey ? loadStripe(stripePublishableKey) : null,
    [stripePublishableKey]
  );

  if (!stripePromise) {
    return <Alert severity="error">Stripe is not configured. Please contact support.</Alert>;
  }

  return (
    <Elements stripe={stripePromise}>
      <StripeCardFormInner onCardData={onCardData} isProcessing={isProcessing}>{children}</StripeCardFormInner>
    </Elements>
  );
}

// ─── Order Summary Panel (shared between desktop right column and mobile expandable) ───
function OrderSummaryPanel({ cart, checkoutOrderCalc, calcLoading, calcError, fetchOrderCalc,
  fulfillmentMethods, checkoutTip, displayTotal, fmtCents,
  checkoutPromoCode, promoInput, setPromoInput, handleApplyPromo, handleRemovePromo, promoError,
  tipMode, handleTipChange, TIP_PERCENTAGES: tipPercentages, customTip, setCustomTip, handleCustomTipBlur, subtotalCents,
  selectedLocation, addressFields, selectedShippingRate,
}) {
  // Group items by fulfillment method
  const methodOrder = ['pickup', 'delivery', 'shipping'];
  const grouped = {};
  cart.forEach(item => {
    const m = item.fulfillmentMethod || 'pickup';
    if (!grouped[m]) grouped[m] = [];
    grouped[m].push(item);
  });
  const sortedMethods = Object.keys(grouped).sort((a, b) => methodOrder.indexOf(a) - methodOrder.indexOf(b));
  const hasMultipleMethods = sortedMethods.length > 1;

  const renderItem = (item, idx) => (
    <Box component="li" key={item.id}>
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
              position: 'absolute', top: -8, right: -8,
              bgcolor: 'grey.600', color: 'white', borderRadius: '50%',
              width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '1.6rem', fontWeight: 700,
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
  );

  return (
    <>
      {/* Fulfillment info */}
      <Stack spacing={1} sx={{ mb: 2 }}>
        {fulfillmentMethods.includes('pickup') && (
          <Stack direction="row" alignItems="center" spacing={1}>
            <StorefrontIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
            <Typography variant="body2" sx={{ fontSize: '1.6rem' }}>
              Pickup{selectedLocation?.name ? ` at ${selectedLocation.name}` : ''}
            </Typography>
          </Stack>
        )}
        {fulfillmentMethods.includes('delivery') && (
          <Stack direction="row" alignItems="center" spacing={1}>
            <LocalShippingIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
            <Typography variant="body2" sx={{ fontSize: '1.6rem' }}>
              {addressFields?.address1
                ? `Delivery to ${addressFields.address1}, ${addressFields.city}`
                : 'Delivery'}
            </Typography>
          </Stack>
        )}
        {fulfillmentMethods.includes('shipping') && (
          <Stack direction="row" alignItems="center" spacing={1}>
            <LocalShippingOutlinedIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
            <Typography variant="body2" sx={{ fontSize: '1.6rem' }}>
              {addressFields?.address1
                ? `Ship to ${addressFields.address1}, ${addressFields.city}`
                : 'Shipping'}
              {selectedShippingRate ? ` · ${selectedShippingRate.carrier ? `${selectedShippingRate.carrier} ` : ''}${selectedShippingRate.name}` : ''}
            </Typography>
          </Stack>
        )}
      </Stack>

      {/* Line items — grouped by fulfillment method when mixed */}
      {sortedMethods.map((method, methodIdx) => (
        <React.Fragment key={method}>
          {hasMultipleMethods && (
            <>
              {methodIdx > 0 && <Divider sx={{ my: 1 }} />}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.5 }}>
                {method === 'pickup' && <StorefrontIcon sx={{ fontSize: 18, color: 'text.secondary' }} />}
                {method === 'delivery' && <LocalShippingIcon sx={{ fontSize: 18, color: 'text.secondary' }} />}
                {method === 'shipping' && <LocalShippingOutlinedIcon sx={{ fontSize: 18, color: 'text.secondary' }} />}
                <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '1.6rem' }}>
                  {method === 'pickup' && `Pickup${selectedLocation?.name ? ` at ${selectedLocation.name}` : ''}`}
                  {method === 'delivery' && (addressFields?.address1
                    ? `Delivery to ${addressFields.address1}, ${addressFields.city}`
                    : 'Delivery')}
                  {method === 'shipping' && 'Shipping'}
                </Typography>
              </Box>
            </>
          )}
          <Box component="ul" sx={{ listStyle: 'none', p: 0, m: 0 }}>
            {grouped[method].map((item, idx) => renderItem(item, idx))}
          </Box>
        </React.Fragment>
      ))}

      <Divider sx={{ my: 2 }} />

      {/* Promo code — hidden when using points */}
      {cart.some(i => i.usePoints) ? (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2, fontStyle: 'italic' }}>
          Promo codes can't be combined with points redemption
        </Typography>
      ) : (
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
      )}
      {promoError && <Alert severity="error" sx={{ mb: 2 }}>{promoError}</Alert>}

      {/* Tip (pickup/delivery only, not shipping-only) */}
      {fulfillmentMethods.includes('pickup') || fulfillmentMethods.includes('delivery') ? <Box sx={{ mb: 2 }}>
        <Typography variant="body2" sx={{ fontSize: '1.6rem', fontWeight: 600, mb: 1 }}>Tip</Typography>
        <ToggleButtonGroup
          value={tipMode === 'preset' ? tipPercentages.find(p => Math.round(subtotalCents * p / 100) === checkoutTip) ?? null : 'custom'}
          exclusive
          onChange={handleTipChange}
          size="small"
          sx={{ display: 'flex', '& .MuiToggleButton-root': { flex: 1, fontSize: '1.6rem', textTransform: 'none' } }}
        >
          {tipPercentages.map(p => (
            <ToggleButton key={p} value={p}>{p}%</ToggleButton>
          ))}
          <ToggleButton value="custom">Other</ToggleButton>
        </ToggleButtonGroup>
        {tipMode === 'custom' && (
          <TextField
            label="Custom tip amount"
            size="small"
            fullWidth
            value={customTip}
            onChange={e => setCustomTip(e.target.value.replace(/[^0-9.]/g, ''))}
            onBlur={handleCustomTipBlur}
            InputProps={{
              startAdornment: <InputAdornment position="start">$</InputAdornment>,
            }}
            sx={{ mt: 1 }}
          />
        )}
      </Box> : null}

      {/* Totals */}
      {calcLoading ? (
        <CircularProgress size={24} sx={{ display: 'block', mx: 'auto', my: 2 }} aria-label="Calculating order total" />
      ) : calcError ? (
        <Alert severity="error" sx={{ mb: 1 }}>
          {calcError}
          <Button size="small" onClick={() => fetchOrderCalc()} sx={{ ml: 1 }}>Retry</Button>
        </Alert>
      ) : (
        <Stack spacing={0.5} sx={{ '& .MuiTypography-root': { fontSize: '1.6rem' } }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Typography color="text.secondary">
              Subtotal · {cart.reduce((s, i) => s + i.quantity, 0)} items
            </Typography>
            <Typography>{fmtCents(checkoutOrderCalc ? checkoutOrderCalc.subtotal : subtotalCents)}</Typography>
          </Box>
          {checkoutOrderCalc?.discount > 0 && (
            <Box sx={{ display: 'flex', justifyContent: 'space-between', color: '#2e7d32' }}>
              <Typography>Discount</Typography>
              <Typography>-{fmtCents(checkoutOrderCalc.discount)}</Typography>
            </Box>
          )}
          {checkoutOrderCalc?.deliveryFee > 0 && (
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography color="text.secondary">
                {fulfillmentMethods.includes('delivery') && fulfillmentMethods.includes('shipping')
                  ? 'Delivery + Shipping'
                  : fulfillmentMethods.includes('shipping') ? 'Shipping' : 'Delivery Fee'}
              </Typography>
              <Typography>{fmtCents(checkoutOrderCalc.deliveryFee)}</Typography>
            </Box>
          )}
          {checkoutOrderCalc ? (
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography color="text.secondary">Tax</Typography>
              <Typography>{fmtCents(checkoutOrderCalc.tax)}</Typography>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography color="text.secondary">Tax</Typography>
              <Typography color="text.disabled">TBD</Typography>
            </Box>
          )}
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
      )}
    </>
  );
}

// ─── Processing Overlay ───
const PROCESSING_STAGES = [
  { text: 'Processing Purchase...', icon: ShoppingCartCheckoutIcon },
  { text: 'Processing Payment...', icon: CreditCardIcon },
  { text: 'Confirming Your Purchase...', icon: ReceiptLongIcon },
  { text: 'Almost Done...', icon: HourglassBottomIcon },
  { text: 'Finalizing Transaction...', icon: VerifiedIcon },
  { text: 'Purchase Successful!', icon: CheckCircleIcon },
];

const overlayFadeKeyframes = {
  '@keyframes overlayFadeIn': {
    from: { opacity: 0, transform: 'translateY(8px)' },
    to: { opacity: 1, transform: 'translateY(0)' },
  },
  '@keyframes overlayFadeOut': {
    from: { opacity: 1, transform: 'translateY(0)' },
    to: { opacity: 0, transform: 'translateY(-8px)' },
  },
};

function ProcessingOverlay({ confirmation, onComplete }) {
  const [stageIndex, setStageIndex] = useState(0);
  const [fading, setFading] = useState(false);
  const timerRef = useRef(null);
  const successShownRef = useRef(false);
  const statusRef = useRef(null);

  // Focus the status message when overlay mounts for screen reader announcement
  useEffect(() => {
    setTimeout(() => statusRef.current?.focus(), 100);
  }, []);

  // Auto-advance stages 0-4 every 2.5s
  useEffect(() => {
    if (stageIndex >= 4) return; // stop at stage 4 (index 4 = "Finalizing Transaction...")
    timerRef.current = setInterval(() => {
      setFading(true);
      setTimeout(() => {
        setStageIndex(prev => {
          if (prev >= 4) return prev;
          return prev + 1;
        });
        setFading(false);
      }, 300);
    }, 2500);
    return () => clearInterval(timerRef.current);
  }, [stageIndex]);

  // Show success stage when confirmation arrives
  useEffect(() => {
    if (confirmation && !successShownRef.current) {
      successShownRef.current = true;
      setFading(true);
      setTimeout(() => {
        setStageIndex(5); // "Purchase Successful!"
        setFading(false);
      }, 300);
      // Dismiss after 1.5s on success stage
      setTimeout(() => {
        onComplete();
      }, 2100); // 300ms fade + 1500ms display + 300ms buffer
    }
  }, [confirmation, onComplete]);

  const stage = PROCESSING_STAGES[stageIndex];
  const StageIcon = stage.icon;
  const isSuccess = stageIndex === 5;

  return (
    <Box
      role="dialog"
      aria-modal="true"
      aria-label="Processing your order"
      sx={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255,255,255,0.92)',
        backdropFilter: 'blur(8px)',
        ...overlayFadeKeyframes,
      }}
    >
      <Box
        sx={{
          backgroundColor: '#fff',
          borderRadius: '16px',
          width: 400,
          maxWidth: '90vw',
          py: 6,
          px: 4,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 3,
        }}
      >
        <Box
          key={stageIndex}
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 2.5,
            animation: fading
              ? 'overlayFadeOut 0.3s ease forwards'
              : 'overlayFadeIn 0.4s ease forwards',
          }}
        >
          <StageIcon
            sx={{
              fontSize: 80,
              color: isSuccess ? '#2e7d32' : '#222',
              transition: 'color 0.3s ease',
            }}
          />
          <Typography
            variant="h5"
            ref={statusRef}
            tabIndex={-1}
            aria-live="assertive"
            aria-atomic="true"
            sx={{
              color: '#222',
              fontFamily: 'Outfit, sans-serif',
              fontWeight: 600,
              textAlign: 'center',
              outline: 'none',
            }}
          >
            {stage.text}
          </Typography>
        </Box>
        {!isSuccess && (
          <CircularProgress
            size={28}
            thickness={4}
            sx={{ color: 'rgba(0,0,0,0.3)', mt: 1 }}
            aria-label="Processing your order"
          />
        )}
      </Box>
    </Box>
  );
}

// ─── Roving tabindex helper for custom radio groups (WCAG SC 2.1.1) ───
function handleRadioGroupKeyDown(e, items, currentIndex, selectItem) {
  const { key } = e;
  let nextIndex = -1;
  if (key === 'ArrowDown' || key === 'ArrowRight') {
    e.preventDefault();
    nextIndex = (currentIndex + 1) % items.length;
  } else if (key === 'ArrowUp' || key === 'ArrowLeft') {
    e.preventDefault();
    nextIndex = (currentIndex - 1 + items.length) % items.length;
  }
  if (nextIndex >= 0) {
    selectItem(nextIndex);
    // Focus the newly selected radio element
    const container = e.currentTarget.closest('[role="radiogroup"]');
    if (container) {
      const radios = container.querySelectorAll('[role="radio"]');
      radios[nextIndex]?.focus();
    }
  }
}

// ─── Main CheckoutPage ───
export default function CheckoutPage() {
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { cart, cartId, getSubtotal, clearCart, getPointsTotal, getDollarTotal, clearAllUsePoints } = useCart();
  const { isLoyaltyMember, loyaltyBalance, pointsPerDollar, refreshLoyalty } = useLoyalty();
  const testModeEnabled = localStorage.getItem('testModeEnabled') === 'true';
  const {
    checkoutCustomer, setCheckoutCustomer,
    checkoutFulfillment, setCheckoutFulfillment,
    checkoutOrderCalc, setCheckoutOrderCalc,
    checkoutPromoCode, setCheckoutPromoCode,
    checkoutTip, setCheckoutTip,
    checkoutConfirmation, setCheckoutConfirmation,
    otpSessionToken, authenticatedCustomerId,
    setAuthenticatedCustomerId,
    setOtpSession,
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

  // Form validation touched state
  const [fieldsTouched, setFieldsTouched] = useState({ firstName: false, lastName: false, email: false });

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
  const [addressActiveIndex, setAddressActiveIndex] = useState(-1);
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

  // Multi-origin shipping state
  const [multiOriginRates, setMultiOriginRates] = useState(null); // { originRates: [{ locationId, locationName, rates, binPacking }] }
  const [selectedRatesByOrigin, setSelectedRatesByOrigin] = useState({}); // { [locationId]: rateObject }

  // Billing address
  const [billingFields, setBillingFields] = useState({ address1: '', address2: '', city: '', provinceCode: '', zip: '' });
  const [billingSameAsAddress, setBillingSameAsAddress] = useState(true);
  const [billingInput, setBillingInput] = useState('');
  const [billingSuggestions, setBillingSuggestions] = useState([]);
  const [billingActiveIndex, setBillingActiveIndex] = useState(-1);
  const [useManualBillingAddress, setUseManualBillingAddress] = useState(false);
  const [billingValidated, setBillingValidated] = useState(false);

  // Communications opt-in
  const [optInEmail, setOptInEmail] = useState(true);
  const [optInSms, setOptInSms] = useState(true);

  // Focus management refs
  const nextSectionRef = useRef(null);
  const processingStatusRef = useRef(null);

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
  const [showOverlay, setShowOverlay] = useState(false);
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

  // Compute fulfillment groups for multi-origin shipping
  const fulfillmentGroupsData = useMemo(() => {
    if (!cart.length || !locations.length) return { groups: [], requiresSplitShipping: false };
    return groupCartByFulfillmentOrigin(cart, locations);
  }, [cart, locations]);
  const { groups: fulfillmentGroups, requiresSplitShipping } = fulfillmentGroupsData;

  // Payment config is resolved PER LOCATION (so a store on Stripe renders Stripe Elements, one on
  // Square renders the Square form). Refetch whenever the selected pickup location changes.
  useEffect(() => {
    callApi('getCheckoutConfig', { environment: window.location.hostname.includes('beta') ? 'beta' : 'production', locationId: selectedLocationSlug || undefined })
      .then(setPaymentConfig)
      .catch(() => setPaymentConfig({ paymentMethod: 'square_web_sdk' }))
      .finally(() => setConfigLoading(false));
  }, [selectedLocationSlug]);

  useEffect(() => {
    if (cart.length === 0 && !checkoutConfirmation) {
      navigate('/desserts', { replace: true });
    }
  }, [cart, checkoutConfirmation, navigate]);

  // ─── Order calculation ───
  const buildCalcPayload = useCallback(() => {
    const payload = {
      cartItems: cart.map(item => ({
        sku: item.sku, variantSku: item.variantSku, name: item.name, variantName: item.variantName,
        clientPrice: item.unitPrice, quantity: item.quantity, modifiers: item.modifiers || [],
        isFreeGift: item.isFreeGift || false, discountId: item.discountId || null,
        fulfillmentLocationId: item.fulfillmentLocationId || null,
      })),
      pickupLocation: selectedLocationSlug,
      fulfillmentMethods,
      deliveryAddress: addressFields.address1 ? addressFields : (savedDeliveryAddress || undefined),
      shipdayDeliveryFee: deliveryResult?.deliveryFee ?? savedDeliveryAddress?.shipdayDeliveryFee ?? undefined,
      tipAmountCents: 0,
      promoCode: checkoutPromoCode || undefined,
    };
    // Multi-origin shipping charges
    if (multiOriginRates && Object.keys(selectedRatesByOrigin).length > 0) {
      const totalShipping = Object.values(selectedRatesByOrigin).reduce((sum, r) => sum + (r?.rate || 0), 0);
      payload.selectedShippingTierId = 'multi_origin';
      payload.shippingRateAmount = totalShipping;
      payload.shippingRateName = 'Split shipping';
      payload.shippingCharges = Object.entries(selectedRatesByOrigin).map(([locationId, rate]) => ({
        locationId, rate: rate?.rate || 0, name: rate?.name || 'Shipping', carrier: rate?.carrier || '',
      }));
      payload.fulfillmentGroups = fulfillmentGroups.map(g => ({
        locationId: g.locationId, locationName: g.locationName, fulfillmentMethod: g.fulfillmentMethod,
        items: g.items.map(i => ({ sku: i.sku, variantSku: i.variantSku, quantity: i.quantity })),
      }));
    } else {
      payload.selectedShippingTierId = selectedShippingTierId || undefined;
      payload.shippingRateAmount = shippingRates.find(r => r.id === selectedShippingTierId)?.rate ?? undefined;
      payload.shippingRateName = shippingRates.find(r => r.id === selectedShippingTierId)?.name ?? undefined;
    }
    return payload;
  }, [cart, selectedLocationSlug, fulfillmentMethods, addressFields, savedDeliveryAddress, deliveryResult, selectedShippingTierId, shippingRates, checkoutPromoCode, multiOriginRates, selectedRatesByOrigin, fulfillmentGroups]);

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

  // Order calc fires when promo code changes (not on initial mount if calc already exists)
  const promoInitRef = useRef(false);
  useEffect(() => {
    if (!promoInitRef.current) { promoInitRef.current = true; return; } // skip initial mount
    if (checkoutPromoCode !== undefined && cart.length > 0
        && (!needsShippingAddress || selectedShippingTierId)) fetchOrderCalc();
  }, [checkoutPromoCode]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load Google Maps script (needed for billing address autocomplete even on pickup-only)
  useEffect(() => {
    if (window.google?.maps) return;
    const existing = document.querySelector('script[src*="maps.googleapis.com/maps/api/js"]');
    if (existing) return;
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places`;
    script.async = true;
    document.head.appendChild(script);
  }, []);

  // Init autocomplete services
  useEffect(() => {
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
  }, []);

  // Hide Google's pac-container dropdown (we render our own)
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = '.pac-container { display: none !important; }';
    document.head.appendChild(style);
    return () => style.remove();
  }, []);

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
      // Only calc if we don't already have a cached result — avoids redundant API calls on return
      if (cart.length > 0 && !needsShippingAddress && !checkoutOrderCalc) fetchOrderCalc();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Focus management: move focus to next section after contact submit
  const prevContactVerifiedRef = useRef(false);
  useEffect(() => {
    if (contactVerified && !prevContactVerifiedRef.current) {
      // Delay to allow DOM to render
      setTimeout(() => {
        nextSectionRef.current?.focus();
      }, 100);
    }
    prevContactVerifiedRef.current = contactVerified;
  }, [contactVerified]);

  // Fetch dynamic shipping rates — supports single-origin and multi-origin
  useEffect(() => {
    if (!needsShippingAddress || !addressValidated || !addressFields.zip) return;
    const shippableItems = cart.filter(i => (i.fulfillmentMethod || 'pickup') === 'shipping');
    if (shippableItems.length === 0) {
      setShippingRates([]);
      setBinPacking([]);
      setShippingRatesLoading(false);
      setMultiOriginRates(null);
      return;
    }
    let cancelled = false;
    const shipTo = { address1: addressFields.address1, city: addressFields.city, provinceCode: addressFields.provinceCode, zip: addressFields.zip };

    // Check if we have items from multiple fulfillment locations
    const shippingGroups = fulfillmentGroups.filter(g => g.fulfillmentMethod === 'shipping');
    const hasMultipleShippingOrigins = shippingGroups.length > 1;

    (async () => {
      setShippingRatesLoading(true);
      try {
        if (hasMultipleShippingOrigins) {
          // Multi-origin: fetch rates for each origin in parallel
          const origins = shippingGroups.map(g => ({
            locationId: g.locationId || selectedLocationSlug,
            cartItems: g.items.map(item => ({ sku: item.sku, variantSku: item.variantSku, quantity: item.quantity })),
          }));
          const result = await callApi('getMultiOriginShippingRates', { origins, shipTo });
          if (cancelled) return;
          setMultiOriginRates(result);
          // Auto-select cheapest merged tier (matching carrier+name across all origins)
          const allOrigins = result.originRates || [];
          const tierMap = {};
          for (const origin of allOrigins) {
            for (const tier of (origin.rates || [])) {
              const key = `${(tier.carrier || '').toLowerCase()}|${(tier.name || '').toLowerCase()}`;
              if (!tierMap[key]) tierMap[key] = { perOrigin: {}, combinedRate: 0 };
              tierMap[key].perOrigin[origin.locationId] = tier;
              tierMap[key].combinedRate += parseFloat(tier.rate || 0);
            }
          }
          const cheapestMerged = Object.values(tierMap)
            .filter(t => Object.keys(t.perOrigin).length === allOrigins.length)
            .sort((a, b) => a.combinedRate - b.combinedRate)[0];
          if (cheapestMerged) {
            setSelectedRatesByOrigin(cheapestMerged.perOrigin);
          } else {
            // Fallback: select cheapest per origin individually
            const autoSelected = {};
            for (const origin of allOrigins) {
              if (origin.rates?.length > 0) autoSelected[origin.locationId] = origin.rates[0];
            }
            setSelectedRatesByOrigin(autoSelected);
          }
          // Also set single-origin state for backward compat (use first origin)
          const firstOrigin = result.originRates?.[0];
          if (firstOrigin?.rates?.length > 0) {
            setShippingRates(firstOrigin.rates);
            setBinPacking(firstOrigin.binPacking || []);
            setSelectedShippingTierId(firstOrigin.rates[0].id);
          }
        } else {
          // Single-origin: existing flow with cart cache
          setMultiOriginRates(null);
          const currentFingerprint = shippableItems
            .map(ci => `${ci.sku}|${ci.variantSku || ''}|${ci.quantity || 1}`)
            .sort()
            .join(';');
          let usedCache = false;
          try {
            const { cart: persistedCart } = await callApi('getCart', { cartId });
            if (persistedCart?.shippingRates) {
              const cached = persistedCart.shippingRates;
              const ageMs = Date.now() - new Date(cached.fetchedAt).getTime();
              if (cached.cartFingerprint === currentFingerprint
                  && cached.addressZip === addressFields.zip
                  && (cached.locationSlug || '') === (selectedLocationSlug || '')
                  && cached.binPacking?.length > 0
                  && ageMs < 30 * 60 * 1000) {
                if (!cancelled) {
                  setBinPacking(cached.binPacking || []);
                  setShippingRates(cached.rates);
                  if (cached.rates.length > 0) setSelectedShippingTierId(cached.rates[0].id);
                  usedCache = true;
                }
              }
            }
          } catch (err) {
            console.warn('[getCart] Cache check failed, proceeding to ShipEngine:', err);
          }
          if (!usedCache && !cancelled) {
            const locationSlug = shippingGroups[0]?.locationId || selectedLocationSlug || undefined;
            const result = await callApi('getShippingRates', {
              shipTo,
              locationSlug,
              cartItems: shippableItems.map(item => ({ sku: item.sku, variantSku: item.variantSku, quantity: item.quantity })),
            });
            if (cancelled) return;
            const rates = result.rates || [];
            setBinPacking(result.binPacking || []);
            setShippingRates(rates);
            if (rates.length > 0) {
              setSelectedShippingTierId(rates[0].id);
            } else if (paymentConfig?.shippingTiers?.length > 0) {
              setSelectedShippingTierId(paymentConfig.shippingTiers[0].id);
            }
            callApi('saveCart', {
              cartId,
              shippingRates: {
                rates, binPacking: result.binPacking || [],
                cartFingerprint: result.cartFingerprint || currentFingerprint,
                addressZip: addressFields.zip,
                locationSlug: locationSlug || '',
                fetchedAt: new Date().toISOString(),
              },
            }).catch(err => console.warn('[saveCart] Rates persist error:', err));
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
  }, [needsShippingAddress, addressValidated, addressFields.zip, fulfillmentGroups.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-trigger order calc when shipping tier changes
  useEffect(() => {
    if (cart.length === 0) return;
    if (multiOriginRates && Object.keys(selectedRatesByOrigin).length > 0) {
      // Multi-origin: sum all selected rates
      const totalShipping = Object.values(selectedRatesByOrigin).reduce((sum, r) => sum + (r?.rate || 0), 0);
      const rateNames = Object.entries(selectedRatesByOrigin).map(([locId, r]) => `${locId}: ${r?.name}`).join(', ');
      fetchOrderCalc({
        selectedShippingTierId: 'multi_origin',
        shippingRateAmount: totalShipping,
        shippingRateName: rateNames,
        shippingCharges: Object.entries(selectedRatesByOrigin).map(([locationId, rate]) => ({
          locationId,
          rate: rate?.rate || 0,
          name: rate?.name || 'Shipping',
          carrier: rate?.carrier || '',
        })),
      });
    } else if (selectedShippingTierId) {
      const selectedRate = shippingRates.find(r => r.id === selectedShippingTierId);
      fetchOrderCalc({
        selectedShippingTierId,
        ...(selectedRate ? { shippingRateAmount: selectedRate.rate, shippingRateName: selectedRate.name } : {}),
      });
    }
  }, [selectedShippingTierId, selectedRatesByOrigin]); // eslint-disable-line react-hooks/exhaustive-deps

  // Until the server-side order calc runs (which only fires after contact is verified
  // and shipping rates are resolved), fall back to the locally-known subtotal so the
  // mobile order bar / summary never flashes "$0.00".
  const subtotalCents = Math.round(getSubtotal() * 100);
  const hasCalc = !!checkoutOrderCalc;
  const displayTotal = hasCalc ? (checkoutOrderCalc.total || 0) + checkoutTip : subtotalCents;
  const totalItems = cart.reduce((s, i) => s + i.quantity, 0);

  const handleApplyPromo = () => {
    const code = promoInput.trim().toUpperCase();
    if (!code) return;
    setCheckoutPromoCode(code);
    setPromoError(null);
    trackCheckoutPromoApplied(code, null);
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
      const tipCents = Math.round(subtotalCents * val / 100);
      setCheckoutTip(tipCents);
      setCustomTip('');
      trackTipSelected(val, tipCents);
    }
  };

  const handleCustomTipBlur = () => {
    const cents = Math.round(parseFloat(customTip || '0') * 100);
    setCheckoutTip(cents >= 0 ? cents : 0);
    trackCustomTipEntered(cents >= 0 ? cents : 0);
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
      (predictions) => { setAddressSuggestions(predictions || []); setAddressActiveIndex(-1); },
    );
  }, []);

  const handleSelectAddressSuggestion = useCallback((suggestion) => {
    setAddressSuggestions([]);
    setAddressActiveIndex(-1);
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
        trackCheckoutShippingAddressEntered();
        // Reset session token for next prediction cycle
        sessionTokenRef.current = new window.google.maps.places.AutocompleteSessionToken();
        // Auto-check delivery availability for delivery items
        if (needsDeliveryAddress) checkDeliveryForAddress(addr);
      },
    );
  }, [needsDeliveryAddress]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleBillingInputChange = useCallback((value) => {
    setBillingInput(value);
    setBillingValidated(false);
    if (value.length < 3 || !autocompleteServiceRef.current) {
      setBillingSuggestions([]);
      return;
    }
    autocompleteServiceRef.current.getPlacePredictions(
      { input: value, componentRestrictions: { country: 'us' }, types: ['address'], sessionToken: sessionTokenRef.current },
      (predictions) => { setBillingSuggestions(predictions || []); setBillingActiveIndex(-1); },
    );
  }, []);

  const handleSelectBillingSuggestion = useCallback((suggestion) => {
    setBillingSuggestions([]);
    setBillingActiveIndex(-1);
    setBillingInput(suggestion.description);
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
        setBillingFields({
          address1: `${get('street_number')} ${get('route')}`.trim(),
          address2: '',
          city: get('locality') || get('sublocality_level_1'),
          provinceCode: get('administrative_area_level_1', true),
          zip: get('postal_code'),
        });
        setBillingValidated(true);
        sessionTokenRef.current = new window.google.maps.places.AutocompleteSessionToken();
      },
    );
  }, []);

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

  // ─── WebSocket: event-driven checkout state for admin stall detection ───
  const {
    isConnected: wsIsConnected,
    sendCheckoutStarted,
    sendCheckoutStepChanged,
    sendCheckoutResumed,
    sendCheckoutEnded,
    setCustomerTraits: wsSetCustomerTraits,
    activeNudge: wsActiveNudge,
    dismissNudge: wsDismissNudge,
    sendNudgeAction: wsSendNudgeAction,
    pushedPromos: wsPushedPromos,
  } = useWebSocket();

  // Determine the current checkout step from local state.
  // IMPORTANT: We must gate lower steps (contact, address, shipping_rate)
  // BEFORE falling through to 'payment'. Otherwise `paymentConfig` loading
  // asynchronously on mount causes the step to flip to 'payment' immediately,
  // which resets the server-side stepEnteredAt to the wrong step + threshold
  // and stalls never fire for the contact/address/tip steps.
  const currentCheckoutStep = useMemo(() => {
    if (checkoutConfirmation) return 'confirmation';
    if (paymentProcessing) return 'payment_processing';
    // Gate lower steps before any payment fallthrough.
    if (!contactVerified) return 'contact';
    if (needsAddress && !addressValidated) return 'address';
    if (needsShippingAddress && !selectedShippingTierId) return 'shipping_rate';
    // All prerequisites met — fall through to payment/tip/review.
    if (selectedSavedPaymentId !== null || paymentConfig) return 'payment';
    if (checkoutTip != null) return 'tip';
    return 'review';
  }, [
    checkoutConfirmation, paymentProcessing, selectedSavedPaymentId, paymentConfig,
    checkoutTip, contactVerified, needsAddress, addressValidated,
    needsShippingAddress, selectedShippingTierId,
  ]);

  // ─── Event-driven checkout state machine ───
  // Replaces the old 30s heartbeat polling. The server computes dwellMs from
  // stepEnteredAt, so the client only needs to announce lifecycle events:
  //   checkout_started      — first time we're connected with an active cart
  //   checkout_step_changed — current step transitioned
  //   checkout_resumed      — WS dropped and reconnected mid-checkout
  //   checkout_ended        — unmount, confirmation, or cart emptied
  //
  // Refs are used instead of state so effect reruns don't fire extra events.
  const checkoutStateRef = useRef({ started: false, lastStep: null, wasConnected: false });
  // Keep the latest send handlers in a ref so the state-machine effect doesn't
  // rerun on every context rerender.
  const checkoutSendersRef = useRef(null);
  checkoutSendersRef.current = {
    start: sendCheckoutStarted,
    stepChanged: sendCheckoutStepChanged,
    resumed: sendCheckoutResumed,
    ended: sendCheckoutEnded,
  };

  useEffect(() => {
    const state = checkoutStateRef.current;
    const senders = checkoutSendersRef.current;

    if (!wsIsConnected) {
      state.wasConnected = false;
      return;
    }
    if (checkoutConfirmation || cart.length === 0) return;

    const payload = {
      step: currentCheckoutStep,
      cartId: cartId || null,
      cartTotal: subtotalCents,
    };

    if (!state.started) {
      // First connect while on checkout → fresh state on the server.
      state.started = true;
      state.lastStep = currentCheckoutStep;
      state.wasConnected = true;
      senders.start(payload);
      return;
    }

    if (!state.wasConnected) {
      // Reconnected after a drop — re-bind the server record to the new
      // connectionId without resetting stepEnteredAt. Pass the current step
      // so the server can rebuild the record if it was GC'd during the outage.
      state.wasConnected = true;
      senders.resumed(payload);
    }

    if (state.lastStep !== currentCheckoutStep) {
      // Step transition resets the dwell timer server-side.
      // Only update lastStep if the send succeeds — if the WS is disconnected
      // (common on iPhone Safari), we need to retry on reconnect. Without this
      // guard, lastStep gets set but the message is lost, and the resumed path
      // doesn't update the step.
      if (senders.stepChanged(payload)) {
        state.lastStep = currentCheckoutStep;
      }
    }
  }, [wsIsConnected, checkoutConfirmation, cart.length, currentCheckoutStep, cartId, subtotalCents]);

  // End the checkout session on confirmation so the record gets cleaned up
  // immediately instead of waiting for the 1h TTL.
  useEffect(() => {
    if (!checkoutConfirmation) return;
    const state = checkoutStateRef.current;
    if (!state.started) return;
    state.started = false;
    checkoutSendersRef.current?.ended();
  }, [checkoutConfirmation]);

  // End the session on unmount (navigation away from /checkout).
  useEffect(() => {
    return () => {
      const state = checkoutStateRef.current;
      if (!state.started) return;
      state.started = false;
      checkoutSendersRef.current?.ended();
    };
  }, []);

  // Apply pushed promo automatically (admin-initiated rescue)
  const lastAppliedPromoRef = useRef(null);
  useEffect(() => {
    if (!wsPushedPromos || wsPushedPromos.length === 0) return;
    const latest = wsPushedPromos[wsPushedPromos.length - 1];
    if (!latest?.code || latest.code === lastAppliedPromoRef.current) return;
    lastAppliedPromoRef.current = latest.code;
    setCheckoutPromoCode(latest.code);
    setPromoInput(latest.code);
  }, [wsPushedPromos, setCheckoutPromoCode]);

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
        optInEmail,
        optInSms: phone.replace(/\D/g, '').length >= 10 ? optInSms : false,
      });
      setCustomerMatch(result);
      // Store resolved customer identity
      if (result.customerId) {
        setAuthenticatedCustomerId(result.customerId);
        console.log('[checkoutCustomerMatch] Resolved customer:', result.customerId, 'account:', result.accountId);
        // Identify for analytics + trigger server-side audience auto-population.
        // persistVisitorSegment in analytics-api will sync this customer into
        // any behavioral audiences they qualify for based on their signals.
        try {
          identifyUser(result.customerId, {
            email: email.trim(),
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            phone: formattedPhone || undefined,
          });
        } catch (idErr) { console.warn('[identifyUser] failed:', idErr); }
      }
      // Push customer traits onto the WebSocket so lambda-websocket back-fills
      // the CHECKOUT_STATE record with email/name/phone. Without this, admin
      // Audiences → Checkout Stalls shows anonymous rows even though the user
      // completed the contact form.
      try {
        const fullName = [firstName.trim(), lastName.trim()].filter(Boolean).join(' ');
        wsSetCustomerTraits({
          email: email.trim() || null,
          name: fullName || null,
          phone: formattedPhone || null,
        });
      } catch (tErr) { console.warn('[wsSetCustomerTraits] failed:', tErr); }
      if (result.customers?.length > 1) {
        console.log('[checkoutCustomerMatch] Multiple accounts found:', JSON.stringify(result, null, 2));
      }
      // Show OTP sign-in prompt only when customer has saved data
      if (result.otpChallengeAvailable) {
        setOtpStep('prompt');
      }
      // Persist cart to DynamoDB for abandoned cart retargeting using the
      // freshly-resolved customerId (setAuthenticatedCustomerId is async so
      // the outer closure still sees the old value).
      callApi('saveCart', {
        cartId,
        items: cart,
        contact: { email: email.trim(), phone: phone.trim(), firstName: firstName.trim(), lastName: lastName.trim(), optInEmail, optInSms: phone.replace(/\D/g, '').length >= 10 ? optInSms : false },
        address: addressFields.address1 ? addressFields : undefined,
        fulfillmentMethods,
        locationSlug: selectedLocationSlug || undefined,
        customerId: result.customerId || undefined,
        subtotalCents,
      }).catch(err => console.warn('[saveCart] Error:', err));
    } catch (err) {
      console.warn('[checkoutCustomerMatch] Error:', err);
      setCustomerMatch({ matchType: 'none', customers: [] });
    }
    setContactVerified(true);
    setCustomerLoading(false);
    // Trigger order calculation now that contact is verified
    // Skip if we already have a cached calc, or if shipping is needed but rates haven't loaded yet
    if (cart.length > 0 && !checkoutOrderCalc && (!needsShippingAddress || selectedShippingTierId)) fetchOrderCalc();
  }, [firstName, lastName, email, phone, optInEmail, optInSms, cart, fetchOrderCalc, cartId, addressFields, fulfillmentMethods, selectedLocationSlug, subtotalCents, checkoutOrderCalc, needsShippingAddress, selectedShippingTierId]);

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
      setOtpSession(result.sessionToken, result.customerId);
      if (result.customerId) identifyUser(result.customerId, { email: email.trim() });

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
  }, [email, otpCode, setOtpSession, setSavedAddresses, setSavedPaymentMethods]);

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
    if (!billingSameAsAddress || !needsAddress) {
      if (!billingFields.address1 || !billingFields.city || !billingFields.provinceCode || !billingFields.zip) {
        setError('Please fill in all required billing address fields.');
        return false;
      }
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
      optInEmail,
      optInSms: phone.replace(/\D/g, '').length >= 10 ? optInSms : false,
    };
    setCheckoutCustomer(customer);
    setCheckoutFulfillment({
      methods: fulfillmentMethods,
      location: selectedLocation,
      address: needsAddress ? addressFields : null,
    });
    trackFulfillmentSelected(fulfillmentMethods.join(','), selectedLocation?.id);
    setError(null);
    return customer;
  }, [firstName, lastName, email, phone, needsAddress, needsDeliveryAddress, needsShippingAddress, addressFields, deliveryResult, selectedShippingTierId, billingFields, billingSameAsAddress, fulfillmentMethods, selectedLocation, setCheckoutCustomer, setCheckoutFulfillment]);

  const handleCardPayment = async (cardData) => {
    const customer = validateAndPay(cardData);
    if (!customer) return;

    setPaymentProcessing(true);
    setShowOverlay(true);
    setError(null);
    const pmLabel = cardData.savedPaymentMethodId ? 'saved_card' : cardData.stripeToken ? 'stripe' : cardData.encryptedCard ? 'evervault' : 'square';
    try {
      // Redeem loyalty points before payment (if any items toggled to use points)
      let loyaltyPromoCode = null;
      const pointsItems = cart.filter(i => i.usePoints);
      if (pointsItems.length > 0 && otpSessionToken && isLoyaltyMember) {
        const totalPoints = getPointsTotal(pointsPerDollar);
        if (totalPoints > 0 && totalPoints <= loyaltyBalance) {
          try {
            const redeemResult = await consumerRedeem(otpSessionToken, { pointsAmount: totalPoints });
            if (redeemResult?.discountCode) {
              loyaltyPromoCode = redeemResult.discountCode;
            }
          } catch (redeemErr) {
            setError(`Points redemption failed: ${redeemErr.message}`);
            setShowOverlay(false);
            setPaymentProcessing(false);
            return;
          }
        }
      }

      const calcPayload = buildCalcPayload();
      // If loyalty promo code was generated, override any existing promo code
      if (loyaltyPromoCode) {
        calcPayload.promoCode = loyaltyPromoCode;
      }
      // Defensive: ensure deliveryAddress is present for shipping/delivery orders
      if (needsAddress && !calcPayload.deliveryAddress) {
        calcPayload.deliveryAddress = addressFields.address1 ? addressFields : undefined;
        console.warn('[handleCardPayment] deliveryAddress was missing from calcPayload, re-read from addressFields:', !!calcPayload.deliveryAddress);
      }
      const payload = {
        ...calcPayload,
        customer,
        tipAmountCents: checkoutTip,
        cartSessionId: cartId,
        testMode: testModeEnabled || undefined,
        billingAddress: (billingSameAsAddress && needsAddress) ? addressFields : billingFields,
        // Browser context for server-side conversion tracking (Meta CAPI + Google MP)
        clientUserAgent: navigator.userAgent,
        fbc: document.cookie.match(/(?:^|;\s*)_fbc=([^;]*)/)?.[1] || undefined,
        fbp: document.cookie.match(/(?:^|;\s*)_fbp=([^;]*)/)?.[1] || undefined,
        gaClientId: document.cookie.match(/(?:^|;\s*)_ga=GA\d+\.\d+\.(.+)/)?.[1] || undefined,
        pageUrl: window.location.href,
        attribution: JSON.parse(sessionStorage.getItem('attribution') || 'null') || undefined,
        environment: window.location.hostname.includes('beta') ? 'beta' : 'production',
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

      // Card saving
      if (saveNewCard && !cardData.savedPaymentMethodId) {
        payload.saveCard = true;
        if (otpSessionToken) payload.otpSessionToken = otpSessionToken;
      }

      // Write payload BEFORE payment — source of truth for cart data with modifiers
      let webPayloadId = null;
      try {
        webPayloadId = crypto.randomUUID();
        await callApi('createPayload', {
          payloadId: webPayloadId,
          source: 'surreal-web',
          lineItems: cart.map(item => ({
            sku: item.sku,
            variantSku: item.variantSku,
            name: item.name,
            variantName: item.variantName || '',
            quantity: item.quantity,
            unitPriceCents: Math.round((item.unitPrice || 0) * 100),
            modifiers: item.modifiers || [],
          })),
          customer: { name: `${customer.firstName} ${customer.lastName}`.trim(), email: customer.email, phone: customer.phone },
          fulfillmentType: fulfillmentMethods?.[0] || 'pickup',
          locationId: selectedLocationSlug || '',
          taxCents: checkoutOrderCalc?.taxCents || 0,
          tipCents: checkoutTip || 0,
          shippingAddress: calcPayload.deliveryAddress || null,
        });
      } catch (e) {
        console.warn('[Checkout] createPayload failed (non-blocking):', e.message);
        webPayloadId = null;
      }
      if (webPayloadId) payload.payloadId = webPayloadId;

      trackPaymentAttempted(pmLabel, displayTotal);
      const result = await callApi('createSquareCheckout', payload);
      trackOrderCompleted(result, { subtotal: result.subtotal, tax: result.tax, tip: checkoutTip, total: result.total, itemCount: cart.length, paymentMethod: pmLabel, cartItems: cart });
      trackOrderConfirmationViewed(result.orderId || result.receiptNumber);
      setCheckoutConfirmation(result);
      // Refresh loyalty balance after points were used
      if (loyaltyPromoCode) refreshLoyalty().catch(() => {});
      clearCart();
      callApi('completeCart', { cartId }).catch(err => console.warn('[completeCart] Error:', err));
      sessionStorage.removeItem('checkoutContact');
      sessionStorage.removeItem('checkoutAddress');
    } catch (err) {
      trackPaymentFailed(pmLabel, err.message);
      setError(err.message);
      setShowOverlay(false);
    }
    setPaymentProcessing(false);
  };

  // Handler for express wallet payments (Apple Pay / Google Pay)
  const handleWalletPayment = async (token, buyer) => {
    if (token.status !== 'OK') {
      setError(token.errors?.[0]?.message || 'Wallet payment failed. Please try again.');
      return;
    }
    const details = token.details || {};
    const contact = details.shipping?.contact || details.billing || details.card?.billing || buyer?.shippingContact || buyer?.billingContact || {};
    const walletFirstName = contact.givenName || firstName;
    const walletLastName = contact.familyName || lastName;
    const walletEmail = contact.email || email;
    const walletPhone = contact.phone || phone;
    if (!walletFirstName || !walletLastName || !walletEmail) {
      setError('Please fill in your name and email before using Apple Pay or Google Pay.');
      return;
    }

    setPaymentProcessing(true);
    setShowOverlay(true);
    setError(null);
    try {
      const calcPayload = buildCalcPayload();
      const customer = {
        firstName: walletFirstName,
        lastName: walletLastName,
        email: walletEmail,
        phone: walletPhone,
        optInEmail,
        optInSms: phone.replace(/\D/g, '').length >= 10 ? optInSms : false,
      };

      // Use wallet shipping address for delivery/shipping if available
      const shippingAddr = buyer?.shippingContact;
      const walletAddress = shippingAddr?.addressLines?.[0] ? {
        address1: shippingAddr.addressLines[0],
        address2: shippingAddr.addressLines[1] || '',
        city: shippingAddr.city || '',
        provinceCode: shippingAddr.state || '',
        zip: shippingAddr.postalCode || '',
        countryCode: shippingAddr.countryCode || 'US',
      } : null;

      // Use wallet billing contact for billing address
      const billingContact = buyer?.billingContact;
      const walletBillingAddress = billingContact?.addressLines?.[0] ? {
        address1: billingContact.addressLines[0],
        address2: billingContact.addressLines[1] || '',
        city: billingContact.city || '',
        provinceCode: billingContact.state || '',
        zip: billingContact.postalCode || '',
        countryCode: billingContact.countryCode || 'US',
      } : null;

      const payload = {
        ...calcPayload,
        customer,
        tipAmountCents: checkoutTip,
        cartSessionId: cartId,
        testMode: testModeEnabled || undefined,
        paymentNonce: token.token,
        billingAddress: walletBillingAddress || walletAddress || billingFields,
        clientUserAgent: navigator.userAgent,
        fbc: document.cookie.match(/(?:^|;\s*)_fbc=([^;]*)/)?.[1] || undefined,
        fbp: document.cookie.match(/(?:^|;\s*)_fbp=([^;]*)/)?.[1] || undefined,
        gaClientId: document.cookie.match(/(?:^|;\s*)_ga=GA\d+\.\d+\.(.+)/)?.[1] || undefined,
        pageUrl: window.location.href,
        attribution: JSON.parse(sessionStorage.getItem('attribution') || 'null') || undefined,
        environment: window.location.hostname.includes('beta') ? 'beta' : 'production',
      };

      // Override delivery address from wallet if needed
      if (needsAddress && walletAddress) {
        payload.deliveryAddress = walletAddress;
      }

      // Write payload BEFORE payment — source of truth for cart data with modifiers
      let walletPayloadId = null;
      try {
        walletPayloadId = crypto.randomUUID();
        await callApi('createPayload', {
          payloadId: walletPayloadId,
          source: 'surreal-web',
          lineItems: cart.map(item => ({
            sku: item.sku,
            variantSku: item.variantSku,
            name: item.name,
            variantName: item.variantName || '',
            quantity: item.quantity,
            unitPriceCents: Math.round((item.unitPrice || 0) * 100),
            modifiers: item.modifiers || [],
          })),
          customer: { name: `${walletFirstName} ${walletLastName}`.trim(), email: walletEmail, phone: walletPhone },
          fulfillmentType: fulfillmentMethods?.[0] || 'pickup',
          locationId: selectedLocationSlug || '',
          taxCents: checkoutOrderCalc?.taxCents || 0,
          tipCents: checkoutTip || 0,
          shippingAddress: payload.deliveryAddress || calcPayload.deliveryAddress || null,
        });
      } catch (e) {
        console.warn('[Checkout] createPayload failed (non-blocking):', e.message);
        walletPayloadId = null;
      }
      if (walletPayloadId) payload.payloadId = walletPayloadId;

      trackPaymentAttempted('wallet', displayTotal);
      const result = await callApi('createSquareCheckout', payload);
      trackOrderCompleted(result, { subtotal: result.subtotal, tax: result.tax, tip: checkoutTip, total: result.total, itemCount: cart.length, paymentMethod: 'wallet', cartItems: cart });
      trackOrderConfirmationViewed(result.orderId || result.receiptNumber);
      setCheckoutConfirmation(result);
      clearCart();
      callApi('completeCart', { cartId }).catch(err => console.warn('[completeCart] Error:', err));
      sessionStorage.removeItem('checkoutContact');
      sessionStorage.removeItem('checkoutAddress');
    } catch (err) {
      trackPaymentFailed('wallet', err.message);
      setError(err.message);
      setShowOverlay(false);
    }
    setPaymentProcessing(false);
  };

  // Handler for placing order with a saved payment method
  const handleSavedCardPayment = useCallback(async () => {
    if (!selectedSavedPaymentId) return;
    trackPaymentMethodSelected('saved_card');
    await handleCardPayment({ savedPaymentMethodId: selectedSavedPaymentId });
  }, [selectedSavedPaymentId, handleCardPayment]); // eslint-disable-line react-hooks/exhaustive-deps

  const saveCardCheckbox = (
    <FormControlLabel
      control={<Checkbox checked={saveNewCard} onChange={e => setSaveNewCard(e.target.checked)} sx={{ '& .MuiSvgIcon-root': { fontSize: 24 } }} />}
      label={<Typography sx={{ fontSize: '1.6rem' }}>Save this card for future purchases</Typography>}
      sx={{ mt: 0, mb: 1 }}
    />
  );

  // Shared props for OrderSummaryPanel
  const summaryProps = {
    cart, checkoutOrderCalc, calcLoading, calcError, fetchOrderCalc,
    fulfillmentMethods, checkoutTip, displayTotal, fmtCents,
    checkoutPromoCode, promoInput, setPromoInput, handleApplyPromo, handleRemovePromo, promoError,
    tipMode, handleTipChange, TIP_PERCENTAGES, customTip, setCustomTip, handleCustomTipBlur, subtotalCents,
    selectedLocation, addressFields,
    selectedShippingRate: shippingRates.find(r => r.id === selectedShippingTierId) || null,
  };

  // ─── Confirmation ───
  if (checkoutConfirmation && !showOverlay) {
    return (
      <Box sx={{ maxWidth: 520, mx: 'auto', p: 3, textAlign: 'center' }}>
        <CheckCircleIcon sx={{ fontSize: 64, color: '#2e7d32', mb: 2 }} />
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
              <Box sx={{ display: 'flex', justifyContent: 'space-between', color: '#2e7d32' }}>
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
        {fulfillmentMethods.includes('shipping') && !requiresSplitShipping && (
          <Typography color="text.secondary" sx={{ mb: 2 }}>
            Shipping to <strong>{addressFields.address1}, {addressFields.city}, {addressFields.provinceCode} {addressFields.zip}</strong>
          </Typography>
        )}
        {requiresSplitShipping && multiOriginRates?.originRates && (
          <Paper variant="outlined" sx={{ p: 2, mb: 2, textAlign: 'left' }}>
            <Typography variant="body2" fontWeight={600} sx={{ mb: 1 }}>
              Shipping from {multiOriginRates.originRates.length} locations
            </Typography>
            {multiOriginRates.originRates.map(origin => (
              <Box key={origin.locationId} sx={{ mb: 1 }}>
                <Typography variant="body2" color="text.secondary">
                  <strong>{origin.locationName}</strong>
                  {selectedRatesByOrigin[origin.locationId] && ` — ${selectedRatesByOrigin[origin.locationId].name}`}
                </Typography>
              </Box>
            ))}
            <Typography variant="body2" color="text.secondary">
              To: {addressFields.address1}, {addressFields.city}, {addressFields.provinceCode} {addressFields.zip}
            </Typography>
          </Paper>
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
                    <Typography sx={{ fontSize: '1.6rem' }}>
                      Save address ({addressFields.address1}, {addressFields.city})
                    </Typography>
                  }
                />
                {saveNewAddress && (
                  <TextField
                    size="small" label="Label (e.g. Home, Work)"
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

      {/* Admin concierge nudge — surfaced when an admin sends a stall-rescue message */}
      {wsActiveNudge && (
        <Alert
          severity="info"
          variant="filled"
          sx={{ mb: 2, bgcolor: 'primary.main' }}
          onClose={() => wsDismissNudge()}
          action={wsActiveNudge.cta?.label ? (
            <Button
              color="inherit"
              size="small"
              onClick={() => {
                if (wsActiveNudge.cta?.action === 'apply_promo' && wsActiveNudge.cta?.code) {
                  setCheckoutPromoCode(wsActiveNudge.cta.code);
                  setPromoInput(wsActiveNudge.cta.code);
                }
                if (wsActiveNudge.nudgeId) wsSendNudgeAction(wsActiveNudge.nudgeId, 'clicked');
                wsDismissNudge();
              }}
            >
              {wsActiveNudge.cta.label}
            </Button>
          ) : null}
        >
          {wsActiveNudge.title && (
            <Typography variant="subtitle2" fontWeight={700}>{wsActiveNudge.title}</Typography>
          )}
          {wsActiveNudge.body && (
            <Typography variant="body2">{wsActiveNudge.body}</Typography>
          )}
        </Alert>
      )}

      {/* Express Checkout — Apple Pay / Google Pay */}
      {!checkoutConfirmation && !paymentProcessing && (
        <Box sx={{ mb: 3 }}>
          <Typography variant="h2">Express Checkout</Typography>
          <Box sx={{ height: 16 }} />
          <PaymentForm
            applicationId={paymentConfig?.squareAppId || SQUARE_APP_ID}
            locationId={paymentConfig?.squareLocationId || SQUARE_LOCATION_ID}
            cardTokenizeResponseReceived={handleWalletPayment}
            createPaymentRequest={() => ({
              countryCode: 'US',
              currencyCode: 'USD',
              total: {
                amount: (displayTotal / 100).toFixed(2),
                label: 'Surreal Creamery',
              },
              requestBillingContact: true,
              requestShippingContact: true,
            })}
          >
            <Box sx={{ display: 'flex', gap: 1, '& > div': { flex: 1, height: 48, '& > *': { height: '100% !important', width: '100%' } } }}>
              <Box><ApplePay /></Box>
              <Box><GooglePay buttonSizeMode="fill" /></Box>
            </Box>
          </PaymentForm>
          <Divider sx={{ mt: 3 }}>
            <Typography variant="caption" color="text.secondary">or pay with credit card below</Typography>
          </Divider>
        </Box>
      )}

      {/* Contact — title adapts to fulfillment type */}
      <Typography variant="h2">
        {[
          fulfillmentMethods.includes('pickup') && 'Pickup For',
          fulfillmentMethods.includes('delivery') && 'Delivery To',
          fulfillmentMethods.includes('shipping') && 'Shipping To',
        ].filter(Boolean).join(' & ')}
      </Typography>
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
                    <Typography sx={{ fontSize: '1.6rem', fontWeight: 500 }}>
                      Sign in to use saved addresses and payment methods
                    </Typography>
                  </Stack>
                  <Stack direction="row" spacing={1}>
                    <Button
                      variant="contained" size="small"
                      onClick={handleSendOtp}
                      sx={{ bgcolor: '#000', '&:hover': { bgcolor: '#222' }, textTransform: 'none', fontSize: '1.6rem' }}
                    >
                      Send Code to {email.trim()}
                    </Button>
                    <Button
                      size="small" onClick={handleSkipOtp}
                      sx={{ textTransform: 'none', color: 'text.secondary', fontSize: '1.6rem' }}
                    >
                      Skip
                    </Button>
                  </Stack>
                </>
              )}
              {otpStep === 'sending' && (
                <Stack direction="row" alignItems="center" spacing={1.5}>
                  <CircularProgress size={18} aria-label="Sending verification code" />
                  <Typography sx={{ fontSize: '1.6rem', color: 'text.secondary' }}>Sending code...</Typography>
                </Stack>
              )}
              {(otpStep === 'input' || otpStep === 'verifying') && (
                <>
                  <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
                    <EmailIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                    <Typography sx={{ fontSize: '1.6rem', color: 'text.secondary' }}>
                      Enter the 6-digit code sent to {email.trim()}
                    </Typography>
                  </Stack>
                  {otpError && <Alert severity="error" sx={{ mb: 1.5, py: 0 }}>{otpError}</Alert>}
                  <Stack direction="row" spacing={1} alignItems="center">
                    <TextField
                      value={otpCode}
                      onChange={e => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      label="Verification code"
                      placeholder="000000"
                      inputProps={{ maxLength: 6, style: { textAlign: 'center', letterSpacing: 8, fontSize: 18, fontWeight: 600 } }}
                      sx={{ width: 160, '& .MuiOutlinedInput-root': { height: 44 } }}
                      disabled={otpStep === 'verifying'}
                    />
                    <Button
                      variant="contained" size="small"
                      onClick={handleVerifyOtp}
                      disabled={otpStep === 'verifying' || otpCode.length !== 6}
                      sx={{ bgcolor: '#000', '&:hover': { bgcolor: '#222' }, textTransform: 'none', fontSize: '1.6rem', height: 36 }}
                    >
                      {otpStep === 'verifying' ? <CircularProgress size={18} color="inherit" aria-label="Verifying code" /> : 'Verify'}
                    </Button>
                    <Button
                      size="small" onClick={handleSkipOtp}
                      sx={{ textTransform: 'none', color: 'text.secondary', fontSize: '1.6rem', minWidth: 0 }}
                    >
                      Skip
                    </Button>
                  </Stack>
                  <Button
                    size="small" onClick={handleSendOtp}
                    disabled={otpCooldown > 0}
                    sx={{ mt: 1, textTransform: 'none', color: '#1976d2', fontSize: '1.6rem', p: 0, minWidth: 0, '&:hover': { bgcolor: 'transparent', textDecoration: 'underline' } }}
                  >
                    {otpCooldown > 0 ? `Resend in ${otpCooldown}s` : 'Resend code'}
                  </Button>
                </>
              )}
            </Paper>
          )}
          {otpStep === 'verified' && (
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mt: 1.5 }}>
              <CheckCircleIcon sx={{ fontSize: 18, color: '#2e7d32' }} />
              <Typography sx={{ fontSize: '1.6rem', color: '#2e7d32', fontWeight: 500 }}>
                Signed in — saved data loaded
              </Typography>
            </Stack>
          )}
        </Box>
      ) : (
        <>
          <Stack spacing={2} sx={{ mb: 2, '& .MuiOutlinedInput-root': { height: 50 } }}>
            <Stack direction="row" spacing={2}>
              <TextField label="First name" fullWidth value={firstName}
                onChange={e => setFirstName(e.target.value)} required
                onBlur={() => setFieldsTouched(prev => ({ ...prev, firstName: true }))}
                error={fieldsTouched.firstName && !firstName.trim()}
                helperText={fieldsTouched.firstName && !firstName.trim() ? 'First name is required' : ''}
                inputProps={{ 'aria-invalid': fieldsTouched.firstName && !firstName.trim() }}
              />
              <TextField label="Last name" fullWidth value={lastName}
                onChange={e => setLastName(e.target.value)} required
                onBlur={() => setFieldsTouched(prev => ({ ...prev, lastName: true }))}
                error={fieldsTouched.lastName && !lastName.trim()}
                helperText={fieldsTouched.lastName && !lastName.trim() ? 'Last name is required' : ''}
                inputProps={{ 'aria-invalid': fieldsTouched.lastName && !lastName.trim() }}
              />
            </Stack>
            <TextField label="Email" type="email" fullWidth value={email}
              onChange={e => setEmail(e.target.value)}
              onBlur={() => { setFieldsTouched(prev => ({ ...prev, email: true })); trackCheckoutContactEntered(!!email, !!phone); }}
              required
              error={fieldsTouched.email && (!email.trim() || !/^\S+@\S+\.\S+$/.test(email.trim()))}
              helperText={fieldsTouched.email && !email.trim() ? 'Email is required' : fieldsTouched.email && !/^\S+@\S+\.\S+$/.test(email.trim()) ? 'Please enter a valid email address' : ''}
              inputProps={{ 'aria-invalid': fieldsTouched.email && (!email.trim() || !/^\S+@\S+\.\S+$/.test(email.trim())) }}
            />
            <TextField label="Phone (for order updates)" fullWidth value={phone}
              onChange={e => setPhone(formatPhone(e.target.value))} />
          </Stack>
          <Stack spacing={0} sx={{ mt: -0.5, mb: 1 }}>
            <FormControlLabel
              control={<Checkbox size="small" checked={optInEmail} onChange={e => setOptInEmail(e.target.checked)} inputProps={{ 'aria-label': 'Send me my receipt and order updates via email' }} />}
              label={<Typography variant="caption" color="text.secondary">Send me my receipt and order updates</Typography>}
            />
            {phone.replace(/\D/g, '').length >= 10 && (
              <FormControlLabel
                control={<Checkbox size="small" checked={optInSms} onChange={e => setOptInSms(e.target.checked)} inputProps={{ 'aria-label': 'Text me order updates via SMS' }} />}
                label={<Typography variant="caption" color="text.secondary">Text me order updates</Typography>}
              />
            )}
          </Stack>
          <Button
            fullWidth
            variant="contained"
            size="large"
            disabled={
              customerLoading ||
              !firstName.trim() ||
              !lastName.trim() ||
              !/^\S+@\S+\.\S+$/.test(email.trim())
            }
            onClick={handleContactContinue}
            sx={{
              mb: 3,
              bgcolor: '#000',
              color: '#fff',
              textTransform: 'none',
              fontSize: '1.8rem',
              fontWeight: 600,
              height: 54,
              '&:hover': { bgcolor: '#222' },
              '&.Mui-disabled': { bgcolor: 'grey.300', color: 'grey.500' },
            }}
          >
            {customerLoading ? <CircularProgress size={22} color="inherit" aria-label="Processing" /> : 'Continue'}
          </Button>
        </>
      )}

      {/* Everything below is gated on contactVerified */}
      {contactVerified && (<>
      {/* Address Section (Delivery + Shipping unified) */}
      {needsAddress && (
        <>
          <Typography variant="h2" ref={needsAddress ? nextSectionRef : undefined} tabIndex={-1}>
            {needsDeliveryAddress && needsShippingAddress ? 'Delivery & Shipping Address'
              : needsDeliveryAddress ? 'Delivery Address' : 'Shipping Address'}
          </Typography>
          <Box sx={{ height: 16 }} />

          {/* Saved address selector */}
          {savedAddresses.length > 0 && (() => {
            const addrItems = [...savedAddresses, null]; // null = "Use a new address"
            const selectedAddrIdx = selectedSavedAddressId === null
              ? addrItems.length - 1
              : savedAddresses.findIndex(a => a.id === selectedSavedAddressId);
            const focusableAddrIdx = selectedAddrIdx >= 0 ? selectedAddrIdx : 0;
            const selectAddrByIndex = (idx) => {
              const item = addrItems[idx];
              if (item === null) {
                setSelectedSavedAddressId(null);
                setAddressFields({ address1: '', address2: '', city: '', provinceCode: '', zip: '' });
                setAddressInput('');
                setAddressValidated(false);
              } else {
                setSelectedSavedAddressId(item.id);
                setAddressFields({
                  address1: item.address1, address2: item.address2 || '',
                  city: item.city, provinceCode: item.provinceCode, zip: item.zip,
                });
                setAddressInput(`${item.address1}, ${item.city}, ${item.provinceCode} ${item.zip}`);
                setAddressValidated(true);
                if (needsDeliveryAddress) checkDeliveryForAddress(item);
              }
            };
            return (
            <Stack spacing={1} sx={{ mb: 2 }} role="radiogroup" aria-label="Saved addresses">
              {savedAddresses.map((addr, addrIdx) => {
                const isSelected = selectedSavedAddressId === addr.id;
                const selectAddr = () => selectAddrByIndex(addrIdx);
                return (
                <Paper
                  key={addr.id}
                  variant="outlined"
                  role="radio"
                  aria-checked={isSelected}
                  tabIndex={addrIdx === focusableAddrIdx ? 0 : -1}
                  onClick={selectAddr}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectAddr(); }
                    else handleRadioGroupKeyDown(e, addrItems, addrIdx, selectAddrByIndex);
                  }}
                  sx={{
                    p: 2, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 2,
                    borderColor: isSelected ? '#000' : 'divider',
                    borderWidth: isSelected ? 2 : 1,
                    bgcolor: isSelected ? 'grey.50' : 'transparent',
                    '&:hover': { bgcolor: 'action.hover' },
                    '&:focus': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: 2 },
                  }}
                >
                  <Radio checked={isSelected} tabIndex={-1} sx={{ p: 0 }} />
                  <Box sx={{ flex: 1 }}>
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <Typography variant="body2" fontWeight={600}>{addr.label || 'Address'}</Typography>
                      {addr.isDefault && <Chip label="Default" size="small" sx={{ height: 20, fontSize: '1.6rem' }} />}
                    </Stack>
                    <Typography variant="body2" color="text.secondary">{addr.address1}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {addr.city}, {addr.provinceCode} {addr.zip}
                    </Typography>
                  </Box>
                </Paper>
                );
              })}
              <Paper
                variant="outlined"
                role="radio"
                aria-checked={selectedSavedAddressId === null}
                tabIndex={focusableAddrIdx === addrItems.length - 1 ? 0 : -1}
                onClick={() => selectAddrByIndex(addrItems.length - 1)}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectAddrByIndex(addrItems.length - 1); }
                  else handleRadioGroupKeyDown(e, addrItems, addrItems.length - 1, selectAddrByIndex);
                }}
                sx={{
                  p: 2, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 2,
                  borderColor: selectedSavedAddressId === null ? '#000' : 'divider',
                  borderWidth: selectedSavedAddressId === null ? 2 : 1,
                  bgcolor: selectedSavedAddressId === null ? 'grey.50' : 'transparent',
                  '&:hover': { bgcolor: 'action.hover' },
                  '&:focus': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: 2 },
                }}
              >
                <Radio checked={selectedSavedAddressId === null} tabIndex={-1} sx={{ p: 0 }} />
                <Typography variant="body2" fontWeight={600}>Use a new address</Typography>
              </Paper>
            </Stack>
            );
          })()}

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
                label="Address"
                placeholder="Start typing your address..."
                fullWidth
                value={addressInput}
                onChange={e => handleAddressInputChange(e.target.value)}
                onKeyDown={e => {
                  if (!addressSuggestions.length) return;
                  if (e.key === 'ArrowDown') { e.preventDefault(); setAddressActiveIndex(i => Math.min(i + 1, addressSuggestions.length - 1)); }
                  else if (e.key === 'ArrowUp') { e.preventDefault(); setAddressActiveIndex(i => Math.max(i - 1, 0)); }
                  else if (e.key === 'Enter' && addressActiveIndex >= 0) { e.preventDefault(); handleSelectAddressSuggestion(addressSuggestions[addressActiveIndex]); }
                  else if (e.key === 'Escape') { setAddressSuggestions([]); setAddressActiveIndex(-1); }
                }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <PlaceIcon sx={{ color: 'text.secondary' }} />
                    </InputAdornment>
                  ),
                }}
                inputProps={{
                  role: 'combobox',
                  'aria-expanded': addressSuggestions.length > 0,
                  'aria-controls': addressSuggestions.length > 0 ? 'address-suggestions-listbox' : undefined,
                  'aria-autocomplete': 'list',
                  'aria-activedescendant': addressActiveIndex >= 0 ? `address-option-${addressActiveIndex}` : undefined,
                }}
                sx={{ '& .MuiOutlinedInput-root': { height: 50 } }}
              />
              {addressSuggestions.length > 0 && (
                <Paper
                  variant="outlined"
                  role="listbox"
                  id="address-suggestions-listbox"
                  aria-label="Address suggestions"
                  sx={{ mt: 0.5, maxHeight: 240, overflow: 'auto' }}
                >
                  {addressSuggestions.map((s, idx) => (
                    <Box
                      key={s.place_id}
                      id={`address-option-${idx}`}
                      role="option"
                      aria-selected={idx === addressActiveIndex}
                      tabIndex={-1}
                      onClick={() => handleSelectAddressSuggestion(s)}
                      sx={{
                        px: 2, py: 1.5, cursor: 'pointer',
                        bgcolor: idx === addressActiveIndex ? 'action.hover' : 'transparent',
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
              <TextField label="Street address" fullWidth required value={addressFields.address1}
                onChange={e => { setAddressFields(prev => ({ ...prev, address1: e.target.value })); setAddressValidated(!!e.target.value); }} />
              <TextField label="Apt, suite, etc. (optional)" fullWidth value={addressFields.address2}
                onChange={e => setAddressFields(prev => ({ ...prev, address2: e.target.value }))} />
              <Stack direction="row" spacing={2}>
                <TextField label="City" fullWidth required value={addressFields.city}
                  onChange={e => setAddressFields(prev => ({ ...prev, city: e.target.value }))} />
                <TextField label="State" sx={{ width: 100 }} required value={addressFields.provinceCode}
                  onChange={e => setAddressFields(prev => ({ ...prev, provinceCode: e.target.value.toUpperCase().slice(0, 2) }))}
                  inputProps={{ maxLength: 2 }} />
              </Stack>
              <TextField label="ZIP code" sx={{ width: 140 }} required value={addressFields.zip}
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
            <Box sx={{ mb: 3 }} aria-live="polite" aria-atomic="true">
              {deliveryChecking ? (
                <Paper variant="outlined" sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 1.5 }} role="status">
                  <CircularProgress size={20} aria-label="Checking delivery availability" />
                  <Typography variant="body2" color="text.secondary">Checking delivery availability...</Typography>
                </Paper>
              ) : deliveryResult?.available ? (
                <Paper variant="outlined" sx={{ p: 2, bgcolor: '#e8f5e9', borderColor: '#2e7d32' }} role="status">
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <CheckCircleIcon sx={{ color: '#2e7d32', fontSize: 20 }} aria-hidden="true" />
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
                <Paper variant="outlined" sx={{ p: 2, bgcolor: '#fbe9e7', borderColor: '#f44336' }} role="alert">
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
              {localStorage.getItem('testModeEnabled') === 'true' && (
                <Box sx={{ mb: 1, p: 1, bgcolor: '#fff3cd', borderRadius: 1, fontFamily: 'monospace', fontSize: 11 }}>
                  groups: {fulfillmentGroups.length} ({fulfillmentGroups.map(g => `${g.locationId || '_local'}:${g.fulfillmentMethod}:${g.items.length}items`).join(', ')})
                  <br />shippingGroups: {fulfillmentGroups.filter(g => g.fulfillmentMethod === 'shipping').length}
                  {' | '}multiOrigin: {multiOriginRates ? `yes(${multiOriginRates.originRates?.length || 0} origins)` : 'no'}
                  {' | '}binPacking: {binPacking.length}
                  {' | '}rates: {shippingRates.length}
                  {' | '}loading: {String(shippingRatesLoading)}
                </Box>
              )}
              {shippingRatesLoading ? (
                <Stack direction="row" alignItems="center" spacing={1.5} sx={{ py: 2 }}>
                  <CircularProgress size={20} sx={{ color: 'text.secondary' }} aria-label="Fetching shipping rates" />
                  <Typography variant="body2" color="text.secondary">Fetching shipping rates...</Typography>
                </Stack>
              ) : multiOriginRates && multiOriginRates.originRates?.length > 1 ? (
                /* ── Multi-origin merged shipping UI ── */
                (() => {
                  // Merge rates across origins by carrier+name — customer sees one combined price
                  const origins = multiOriginRates.originRates;
                  const tierMap = {};
                  for (const origin of origins) {
                    for (const tier of (origin.rates || [])) {
                      const key = `${(tier.carrier || '').toLowerCase()}|${(tier.name || '').toLowerCase()}`;
                      if (!tierMap[key]) tierMap[key] = { carrier: tier.carrier, name: tier.name, perOrigin: {}, estimatedDays: tier.estimatedDays };
                      tierMap[key].perOrigin[origin.locationId] = tier;
                      // Use longest estimated delivery
                      if (tier.estimatedDays && (!tierMap[key].estimatedDays || tier.estimatedDays > tierMap[key].estimatedDays)) {
                        tierMap[key].estimatedDays = tier.estimatedDays;
                      }
                    }
                  }
                  // Only show tiers available from ALL origins
                  const mergedTiers = Object.entries(tierMap)
                    .filter(([, t]) => Object.keys(t.perOrigin).length === origins.length)
                    .map(([key, t]) => ({
                      key,
                      carrier: t.carrier,
                      name: t.name,
                      estimatedDays: t.estimatedDays,
                      combinedRate: Object.values(t.perOrigin).reduce((s, r) => s + parseFloat(r.rate || 0), 0),
                      perOrigin: t.perOrigin,
                    }))
                    .sort((a, b) => a.combinedRate - b.combinedRate);
                  // Track which merged tier is selected
                  const selectedKey = mergedTiers.find(t =>
                    Object.entries(t.perOrigin).every(([locId, r]) => selectedRatesByOrigin[locId]?.id === r.id)
                  )?.key;

                  return (
                    <Stack spacing={2} sx={{ mt: 2 }}>
                      <Alert severity="info" sx={{ '& .MuiAlert-message': { fontSize: '1.4rem' } }}>
                        Your order ships from {origins.length} locations
                      </Alert>
                      {/* Test mode: per-origin bin packing + item breakdown */}
                      {localStorage.getItem('testModeEnabled') === 'true' && origins.map((origin) => (
                        <Paper key={origin.locationId} variant="outlined" sx={{ p: 1.5, bgcolor: '#fffde7' }}>
                          <Typography variant="caption" fontWeight={700}>
                            <LocalShippingIcon sx={{ fontSize: 14, verticalAlign: 'text-bottom', mr: 0.5 }} />
                            {origin.locationName}
                          </Typography>
                          {origin.binPacking?.length > 0 && (
                            <Suspense fallback={<Skeleton variant="rectangular" height={180} sx={{ borderRadius: 1, my: 1 }} />}>
                              <Box sx={{ my: 1 }}>
                                <PackageViewer3D binPacking={origin.binPacking} />
                                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center', mt: 0.5 }}>
                                  {origin.binPacking.length} pkg{origin.binPacking.length > 1 ? 's' : ''} {' \u2022 '}
                                  {origin.binPacking.reduce((s, b) => s + b.usedWeightOz, 0).toFixed(1)} oz
                                </Typography>
                              </Box>
                            </Suspense>
                          )}
                          <Box sx={{ pl: 1 }}>
                            {fulfillmentGroups
                              .filter(g => g.locationId === origin.locationId)
                              .flatMap(g => g.items)
                              .map(item => (
                                <Typography key={item.id} variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                                  {item.name}{item.variantName && item.variantName !== 'Default Title' ? ` — ${item.variantName}` : ''} x{item.quantity}
                                </Typography>
                              ))
                            }
                          </Box>
                        </Paper>
                      ))}
                      {/* Merged rate selector — customer sees one combined price */}
                      {mergedTiers.length > 0 ? (() => {
                        const selectedMergedIdx = mergedTiers.findIndex(t => t.key === selectedKey);
                        const focusableMergedIdx = selectedMergedIdx >= 0 ? selectedMergedIdx : 0;
                        const selectMergedByIndex = (idx) => {
                          const tier = mergedTiers[idx];
                          trackCheckoutShippingRateSelected(tier.carrier, tier.name, tier.combinedRate);
                          setSelectedRatesByOrigin(tier.perOrigin);
                        };
                        return (
                        <Stack spacing={1} role="radiogroup" aria-label="Shipping rate">
                          {mergedTiers.map((merged, mergedIdx) => {
                            const isSelected = selectedKey === merged.key;
                            const selectMerged = () => selectMergedByIndex(mergedIdx);
                            return (
                              <Paper
                                key={merged.key}
                                variant="outlined"
                                role="radio"
                                aria-checked={isSelected}
                                tabIndex={mergedIdx === focusableMergedIdx ? 0 : -1}
                                onClick={selectMerged}
                                onKeyDown={e => {
                                  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectMerged(); }
                                  else handleRadioGroupKeyDown(e, mergedTiers, mergedIdx, selectMergedByIndex);
                                }}
                                sx={{
                                  p: 2, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 2,
                                  borderColor: isSelected ? '#000' : 'divider',
                                  borderWidth: isSelected ? 2 : 1,
                                  bgcolor: isSelected ? 'grey.50' : 'transparent',
                                  '&:hover': { bgcolor: 'action.hover' },
                                  '&:focus': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: 2 },
                                }}
                              >
                                <LocalShippingIcon sx={{ color: isSelected ? '#000' : 'text.secondary' }} />
                                <Box sx={{ flex: 1 }}>
                                  <Typography variant="body2" fontWeight={600} sx={{ lineHeight: 1.2 }}>
                                    {merged.carrier ? `${merged.carrier} — ${merged.name}` : merged.name}
                                  </Typography>
                                  <Typography variant="body2" color="text.secondary" sx={{ fontSize: '1.6rem', lineHeight: 1.2 }}>{merged.estimatedDays}</Typography>
                                </Box>
                                <Typography variant="body2" fontWeight={700}>${merged.combinedRate.toFixed(2)}</Typography>
                              </Paper>
                            );
                          })}
                        </Stack>
                        );
                      })() : (
                        <Typography variant="body2" color="text.secondary">No shipping options available for this address.</Typography>
                      )}
                    </Stack>
                  );
                })()
              ) : (
                /* ── Single-origin shipping UI (existing) ── */
                <>
                  {localStorage.getItem('testModeEnabled') === 'true' && binPacking.length > 0 && (
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
                  {(shippingRates.length > 0 ? shippingRates : (paymentConfig?.shippingTiers || [])).length > 0 ? (() => {
                    const tierList = shippingRates.length > 0 ? shippingRates : (paymentConfig?.shippingTiers || []);
                    const selectedTierIdx = tierList.findIndex(t => t.id === selectedShippingTierId);
                    const focusableTierIdx = selectedTierIdx >= 0 ? selectedTierIdx : 0;
                    const selectTierByIndex = (idx) => {
                      const t = tierList[idx];
                      trackCheckoutShippingRateSelected(t.carrier, t.name, t.rate);
                      setSelectedShippingTierId(t.id);
                    };
                    return (
                    <Stack spacing={1} role="radiogroup" aria-label="Shipping rate">
                      {tierList.map((tier, tierIdx) => {
                        const isTierSelected = selectedShippingTierId === tier.id;
                        const selectTier = () => selectTierByIndex(tierIdx);
                        return (
                        <Paper
                          key={tier.id}
                          variant="outlined"
                          role="radio"
                          aria-checked={isTierSelected}
                          tabIndex={tierIdx === focusableTierIdx ? 0 : -1}
                          onClick={selectTier}
                          onKeyDown={e => {
                            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectTier(); }
                            else handleRadioGroupKeyDown(e, tierList, tierIdx, selectTierByIndex);
                          }}
                          sx={{
                            p: 2, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 2,
                            borderColor: isTierSelected ? '#000' : 'divider',
                            borderWidth: isTierSelected ? 2 : 1,
                            bgcolor: isTierSelected ? 'grey.50' : 'transparent',
                            '&:hover': { bgcolor: 'action.hover' },
                            '&:focus': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: 2 },
                          }}
                        >
                          <LocalShippingIcon sx={{ color: isTierSelected ? '#000' : 'text.secondary' }} />
                          <Box sx={{ flex: 1 }}>
                            <Typography variant="body2" fontWeight={600} sx={{ lineHeight: 1.2 }}>
                              {tier.carrier ? `${tier.carrier} — ${tier.name}` : tier.name}
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ fontSize: '1.6rem', lineHeight: 1.2 }}>{tier.estimatedDays}</Typography>
                          </Box>
                          <Typography variant="body2" fontWeight={700}>${parseFloat(tier.rate).toFixed(2)}</Typography>
                        </Paper>
                        );
                      })}
                    </Stack>
                    );
                  })() : (
                    <Typography variant="body2" color="text.secondary">No shipping options available for this address.</Typography>
                  )}
                </>
              )}
            </Box>
          )}
        </>
      )}

      {/* Billing Address */}
      <Typography variant="h2" ref={!needsAddress ? nextSectionRef : undefined} tabIndex={-1}>Billing Address</Typography>
      <Box sx={{ height: 16 }} />
      {needsAddress && (
        <FormControlLabel
          control={
            <Checkbox
              checked={billingSameAsAddress}
              onChange={e => setBillingSameAsAddress(e.target.checked)}
              sx={{ '& .MuiSvgIcon-root': { fontSize: 24 } }}
            />
          }
          label={`Same as ${needsDeliveryAddress && needsShippingAddress ? 'delivery & shipping' : needsDeliveryAddress ? 'delivery' : 'shipping'} address`}
          sx={{ mb: 2, '& .MuiTypography-root': { fontSize: '1.6rem' } }}
        />
      )}
      {(!needsAddress || !billingSameAsAddress) && (
        <>
          {billingValidated && billingFields.address1 && !useManualBillingAddress ? (
            <Paper variant="outlined" sx={{ p: 2, mb: 2, bgcolor: 'grey.50', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Box>
                <Typography variant="body2" fontWeight={600}>{billingFields.address1}{billingFields.address2 ? `, ${billingFields.address2}` : ''}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {billingFields.city}, {billingFields.provinceCode} {billingFields.zip}
                </Typography>
              </Box>
              <Button
                size="small"
                onClick={() => { setBillingValidated(false); setBillingInput(''); setBillingSuggestions([]); }}
                sx={{ textTransform: 'none', color: '#1976d2', fontSize: '1.6rem', minWidth: 0 }}
              >
                Edit
              </Button>
            </Paper>
          ) : !useManualBillingAddress ? (
            <Box sx={{ mb: 2 }}>
              <TextField
                label="Billing address"
                placeholder="Start typing your billing address..."
                fullWidth
                value={billingInput}
                onChange={e => handleBillingInputChange(e.target.value)}
                onKeyDown={e => {
                  if (!billingSuggestions.length) return;
                  if (e.key === 'ArrowDown') { e.preventDefault(); setBillingActiveIndex(i => Math.min(i + 1, billingSuggestions.length - 1)); }
                  else if (e.key === 'ArrowUp') { e.preventDefault(); setBillingActiveIndex(i => Math.max(i - 1, 0)); }
                  else if (e.key === 'Enter' && billingActiveIndex >= 0) { e.preventDefault(); handleSelectBillingSuggestion(billingSuggestions[billingActiveIndex]); }
                  else if (e.key === 'Escape') { setBillingSuggestions([]); setBillingActiveIndex(-1); }
                }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <PlaceIcon sx={{ color: 'text.secondary' }} />
                    </InputAdornment>
                  ),
                }}
                inputProps={{
                  role: 'combobox',
                  'aria-expanded': billingSuggestions.length > 0,
                  'aria-controls': billingSuggestions.length > 0 ? 'billing-suggestions-listbox' : undefined,
                  'aria-autocomplete': 'list',
                  'aria-activedescendant': billingActiveIndex >= 0 ? `billing-option-${billingActiveIndex}` : undefined,
                }}
                sx={{ '& .MuiOutlinedInput-root': { height: 50 } }}
              />
              {billingSuggestions.length > 0 && (
                <Paper
                  variant="outlined"
                  role="listbox"
                  id="billing-suggestions-listbox"
                  aria-label="Billing address suggestions"
                  sx={{ mt: 0.5, maxHeight: 240, overflow: 'auto' }}
                >
                  {billingSuggestions.map((s, idx) => (
                    <Box
                      key={s.place_id}
                      id={`billing-option-${idx}`}
                      role="option"
                      aria-selected={idx === billingActiveIndex}
                      tabIndex={-1}
                      onClick={() => handleSelectBillingSuggestion(s)}
                      sx={{
                        px: 2, py: 1.5, cursor: 'pointer',
                        bgcolor: idx === billingActiveIndex ? 'action.hover' : 'transparent',
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
              <TextField label="Street address" fullWidth required value={billingFields.address1}
                onChange={e => { setBillingFields(prev => ({ ...prev, address1: e.target.value })); setBillingValidated(!!e.target.value); }} />
              <TextField label="Apt, suite, etc. (optional)" fullWidth value={billingFields.address2}
                onChange={e => setBillingFields(prev => ({ ...prev, address2: e.target.value }))} />
              <Stack direction="row" spacing={2}>
                <TextField label="City" fullWidth required value={billingFields.city}
                  onChange={e => setBillingFields(prev => ({ ...prev, city: e.target.value }))} />
                <TextField label="State" sx={{ width: 100 }} required value={billingFields.provinceCode}
                  onChange={e => setBillingFields(prev => ({ ...prev, provinceCode: e.target.value.toUpperCase().slice(0, 2) }))}
                  inputProps={{ maxLength: 2 }} />
              </Stack>
              <TextField label="ZIP code" sx={{ width: 140 }} required value={billingFields.zip}
                onChange={e => setBillingFields(prev => ({ ...prev, zip: e.target.value.slice(0, 5) }))}
                inputProps={{ maxLength: 5 }} />
            </Stack>
          )}
          {(!billingValidated || useManualBillingAddress) && (
            <Button
              size="small"
              onClick={() => setUseManualBillingAddress(!useManualBillingAddress)}
              sx={{ mb: 2, textTransform: 'none', color: '#1976d2', fontSize: '1.6rem', justifyContent: 'flex-start', p: 0, minWidth: 0, '&:hover': { bgcolor: 'transparent', textDecoration: 'underline' } }}
            >
              {useManualBillingAddress ? 'Use address autocomplete' : 'Enter address manually'}
            </Button>
          )}
        </>
      )}

      {/* Payment */}
      <Typography variant="h2">Payment</Typography>
      <Box sx={{ height: 16 }} />

      {/* Saved payment method selector */}
      {savedPaymentMethods.length > 0 && (() => {
        const pmItems = [...savedPaymentMethods, null]; // null = "Use a different card"
        const selectedPmIdx = selectedSavedPaymentId === null
          ? pmItems.length - 1
          : savedPaymentMethods.findIndex(pm => pm.id === selectedSavedPaymentId);
        const focusablePmIdx = selectedPmIdx >= 0 ? selectedPmIdx : 0;
        const selectPmByIndex = (idx) => {
          const item = pmItems[idx];
          setSelectedSavedPaymentId(item === null ? null : item.id);
        };
        return (
        <Stack spacing={1} sx={{ mb: 2 }} role="radiogroup" aria-label="Saved payment methods">
          {savedPaymentMethods.map((pm, pmIdx) => {
            const isPmSelected = selectedSavedPaymentId === pm.id;
            return (
            <Paper
              key={pm.id}
              variant="outlined"
              role="radio"
              aria-checked={isPmSelected}
              tabIndex={pmIdx === focusablePmIdx ? 0 : -1}
              onClick={() => selectPmByIndex(pmIdx)}
              onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectPmByIndex(pmIdx); }
                else handleRadioGroupKeyDown(e, pmItems, pmIdx, selectPmByIndex);
              }}
              sx={{
                p: 2, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 2,
                borderColor: isPmSelected ? '#000' : 'divider',
                borderWidth: isPmSelected ? 2 : 1,
                bgcolor: isPmSelected ? 'grey.50' : 'transparent',
                '&:hover': { bgcolor: 'action.hover' },
                '&:focus': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: 2 },
              }}
            >
              <Radio checked={isPmSelected} tabIndex={-1} sx={{ p: 0 }} />
              <CreditCardIcon sx={{ color: 'text.secondary' }} />
              <Box sx={{ flex: 1 }}>
                <Typography variant="body2" fontWeight={600}>
                  {pm.brand || 'Card'} ····{pm.last4}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Exp {String(pm.expMonth).padStart(2, '0')}/{pm.expYear}
                </Typography>
              </Box>
              {pm.isDefault && <Chip label="Default" size="small" sx={{ height: 20, fontSize: '1.6rem' }} />}
            </Paper>
            );
          })}
          <Paper
            variant="outlined"
            role="radio"
            aria-checked={selectedSavedPaymentId === null}
            tabIndex={focusablePmIdx === pmItems.length - 1 ? 0 : -1}
            onClick={() => selectPmByIndex(pmItems.length - 1)}
            onKeyDown={e => {
              if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectPmByIndex(pmItems.length - 1); }
              else handleRadioGroupKeyDown(e, pmItems, pmItems.length - 1, selectPmByIndex);
            }}
            sx={{
              p: 2, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 2,
              borderColor: selectedSavedPaymentId === null ? '#000' : 'divider',
              borderWidth: selectedSavedPaymentId === null ? 2 : 1,
              bgcolor: selectedSavedPaymentId === null ? 'grey.50' : 'transparent',
              '&:hover': { bgcolor: 'action.hover' },
              '&:focus': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: 2 },
            }}
          >
            <Radio checked={selectedSavedPaymentId === null} tabIndex={-1} sx={{ p: 0 }} />
            <Typography variant="body2" fontWeight={600}>Use a different card</Typography>
          </Paper>
        </Stack>
        );
      })()}

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
          {paymentProcessing ? <CircularProgress size={24} color="inherit" aria-label="Submitting order" /> : 'Place Order'}
        </Button>
      ) : configLoading ? (
        <CircularProgress size={32} sx={{ display: 'block', mx: 'auto', my: 4 }} aria-label="Loading payment form" />
      ) : paymentConfig?.paymentMethod === 'stripe' ? (
        <StripeCardForm
          onCardData={handleCardPayment}
          isProcessing={paymentProcessing}
          stripePublishableKey={paymentConfig?.stripePublishableKey}
        >
          {saveCardCheckbox}
        </StripeCardForm>
      ) : paymentConfig?.paymentMethod?.startsWith('evervault') ? (
        <EvervaultCardForm onCardData={handleCardPayment} isProcessing={paymentProcessing}>
          {saveCardCheckbox}
        </EvervaultCardForm>
      ) : (
        <PaymentCardForm
          onCardData={handleCardPayment}
          isProcessing={paymentProcessing}
          squareAppId={paymentConfig?.squareAppId}
          squareLocationId={paymentConfig?.squareLocationId}
        >
          {saveCardCheckbox}
        </PaymentCardForm>
      )}

      </>)}
      {/* /contactVerified gate */}
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
        component="button"
        type="button"
        aria-expanded={mobileOrderExpanded}
        aria-label="Order summary"
        onClick={() => { trackOrderSummaryToggled(!mobileOrderExpanded); setMobileOrderExpanded(!mobileOrderExpanded); }}
        sx={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          cursor: 'pointer', py: 1.5, width: '100%',
          borderTop: '1px solid', borderBottom: '1px solid', borderColor: 'divider',
          background: 'none', border: 'none', borderTopStyle: 'solid', borderBottomStyle: 'solid',
          padding: 0, paddingTop: 1.5, paddingBottom: 1.5, font: 'inherit', color: 'inherit',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography fontWeight={600}>{hasCalc ? 'Total' : 'Subtotal'}</Typography>
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
    <>
      {showOverlay && (
        <ProcessingOverlay
          confirmation={checkoutConfirmation}
          onComplete={() => setShowOverlay(false)}
        />
      )}
      <Box sx={{ width: '100%', maxWidth: 960, mx: 'auto', p: { xs: 2, sm: 3 }, pb: 8, boxSizing: 'border-box', minWidth: 0, overflowX: 'clip' }}>
        <Typography variant="h6" component="h1" sx={{ mb: 2 }}>Checkout</Typography>
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
    </>
  );
}
