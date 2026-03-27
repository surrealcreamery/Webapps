import React, { useMemo, useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Drawer, Box, Button, Typography, IconButton, Divider, Stack, Alert, CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions, TextField } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined';
import CardGiftcardIcon from '@mui/icons-material/CardGiftcard';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import LockIcon from '@mui/icons-material/Lock';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import ContactlessIcon from '@mui/icons-material/Contactless';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import { GoogleAddressAutocomplete } from '@/components/catering/GoogleAddressAutocomplete';
import StorefrontIcon from '@mui/icons-material/Storefront';
import { useShopify } from '@/contexts/commerce/ShopifyContext_GraphQL';
import { useCatalog } from '@/contexts/commerce/CatalogContext';
import { BlindBoxProgressIndicator } from '@/components/commerce/BlindBoxProgressIndicator';
const TERMINAL_API_URL = 'https://oquxxk2q56me3ve7mk7nz2gav40apced.lambda-url.us-east-1.on.aws';
const CHECKOUT_API_URL = 'https://viif6favb73jr3pm2ph6qcten40ethnp.lambda-url.us-east-1.on.aws';
const SHIPPING_API_URL = 'https://thugumzwi4445lq5q7qhnjfwoe0mrwjl.lambda-url.us-east-1.on.aws';
const TERMINAL_POLL_INTERVAL = 3000;
const TERMINAL_TIMEOUT = 120000; // 2 minutes

// To re-enable the free shipping reward, see /docs/free-shipping-reward.md

// Placeholder image
const PLACEHOLDER_IMAGE = 'https://placehold.co/80x80/e0e0e0/666666?text=No+Image';

const CartQuantitySelector = ({ value, onIncrement, onDecrement }) => (
  <Box sx={{ display: 'inline-flex', alignItems: 'center', border: '1px solid', borderColor: 'grey.300', borderRadius: 1 }}>
    <Button sx={{ minWidth: '40px' }} onClick={onDecrement} disabled={value <= 1}>-</Button>
    <Typography sx={{ px: 2, fontWeight: 'bold', minWidth: '20px', textAlign: 'center' }}>{value}</Typography>
    <Button sx={{ minWidth: '40px' }} onClick={onIncrement}>+</Button>
  </Box>
);

/**
 * Reward Option Component - displays a single reward option
 */
const RewardOption = ({ option, isSelected, isLocked, onSelect, showBorder = true, products = [] }) => {
    const rewardName = option.freeProducts?.[0]?.variantTitle 
        || option.freeProducts?.[0]?.title 
        || option.freeProduct?.title
        || 'Free Item';
    const productTitle = option.freeProducts?.[0]?.title 
        || option.freeProduct?.title
        || option.title;
    
    // Try to find image from products data
    const variantId = option.freeProducts?.[0]?.variantId || option.freeProduct?.variantId;
    const productId = option.freeProducts?.[0]?.id || option.freeProduct?.id;
    
    // Look up product in Shopify products to get image
    const matchedProduct = products?.find(p => 
        p.id === productId || 
        p.shopifyId === productId ||  // Check shopifyId (full GID)
        p.variantId === variantId ||
        p.variants?.some(v => v.id === variantId)
    );
    
    // Prioritize shopifyProducts lookup over discount data (which doesn't have images)
    const imageUrl = matchedProduct?.imageUrl
        || matchedProduct?.images?.[0]?.url
        || matchedProduct?.variants?.find(v => v.id === variantId)?.image?.url
        || PLACEHOLDER_IMAGE;
    
    return (
        <Box 
            onClick={() => !isLocked && onSelect?.(option.id)}
            sx={{ 
                display: 'flex',
                alignItems: 'flex-start',
                gap: 1.5,
                p: 1.5,
                borderRadius: 2,
                cursor: isLocked ? 'default' : 'pointer',
                bgcolor: 'white',
                border: showBorder ? '2px solid' : 'none',
                borderColor: isSelected ? '#000' : (isLocked ? 'grey.200' : 'grey.300'),
                opacity: isLocked ? 0.7 : 1,
                transition: 'all 0.2s ease',
                '&:hover': !isLocked ? {
                    borderColor: isSelected ? '#000' : 'grey.500',
                    bgcolor: 'grey.50'
                } : {}
            }}
        >
            {/* Thumbnail */}
            <Box
                sx={{
                    width: 60,
                    height: 60,
                    borderRadius: 1,
                    overflow: 'hidden',
                    flexShrink: 0,
                    bgcolor: 'grey.100'
                }}
            >
                <img
                    src={imageUrl}
                    alt={rewardName}
                    style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover'
                    }}
                />
            </Box>
            
            {/* Product Info */}
            <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ 
                    fontSize: '1.6rem', 
                    fontWeight: 600,
                    color: '#333',
                    lineHeight: 1.3
                }}>
                    {rewardName}
                </Typography>
                <Typography sx={{ 
                    fontSize: '1.6rem', 
                    color: 'text.secondary',
                    mt: 0.25
                }}>
                    {productTitle}
                </Typography>
            </Box>
            
            {/* Selection indicator */}
            {isSelected && !isLocked && (
                <CheckCircleIcon sx={{ 
                    fontSize: '2rem', 
                    color: '#000',
                    flexShrink: 0
                }} />
            )}
        </Box>
    );
};

/**
 * Cart Side Drawer
 * Slides in from right with cart contents
 */
export function CartDrawer({
    open,
    onClose,
    quantityProgress,
    selectedRewards = {},
    onSelectReward,
    orderDiscounts = [],
    onAddBlindBox,
    kioskTerminal = null,
    kioskCart = [],
    onKioskCartChange,
    isKioskPaired = false,
    kioskRemoteCheckout = null,
    kioskSendForward,
    localCart,
}) {
  const isKioskMode = !!kioskTerminal;
  const isPairedKiosk = isKioskMode && isKioskPaired;
  const { products } = useShopify();
  const { storeLocations, selectedLocation } = useCatalog();
  const navigate = useNavigate();

  // Terminal payment state (kiosk mode)
  const [terminalStatus, setTerminalStatus] = useState('idle'); // idle | sending | waiting | completed | failed | canceled
  const [terminalError, setTerminalError] = useState(null);
  const terminalCheckoutId = useRef(null);
  const pollTimer = useRef(null);
  const timeoutTimer = useRef(null);

  // Local cart items and subtotal (defined early so callbacks can reference them)
  const cartItems = localCart?.cart || [];
  const localSubtotal = localCart?.getSubtotal?.() || 0;

  const stopPolling = useCallback(() => {
    if (pollTimer.current) { clearInterval(pollTimer.current); pollTimer.current = null; }
    if (timeoutTimer.current) { clearTimeout(timeoutTimer.current); timeoutTimer.current = null; }
  }, []);

  // Clean up polling on unmount or drawer close
  useEffect(() => {
    if (!open && terminalStatus !== 'idle') {
      // If drawer closes while waiting, cancel the terminal checkout
      if (terminalStatus === 'waiting' && terminalCheckoutId.current) {
        fetch(TERMINAL_API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'cancelTerminalCheckout', checkoutId: terminalCheckoutId.current }),
        }).catch(() => {});
      }
      stopPolling();
      setTerminalStatus('idle');
      setTerminalError(null);
      terminalCheckoutId.current = null;
    }
    return () => stopPolling();
  }, [open, stopPolling]);

  const pollTerminalStatus = useCallback(() => {
    const checkoutId = terminalCheckoutId.current;
    if (!checkoutId) return;

    pollTimer.current = setInterval(async () => {
      try {
        const res = await fetch(TERMINAL_API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'getTerminalCheckout', checkoutId }),
        });
        const data = await res.json();
        const result = typeof data.body === 'string' ? JSON.parse(data.body) : data;

        if (result.status === 'COMPLETED') {
          stopPolling();
          setTerminalStatus('completed');
          if (isPairedKiosk && kioskSendForward) {
            kioskSendForward('checkout_status', { checkoutId, status: 'completed' });
          }
          // Clear cart after showing success
          setTimeout(() => {
            if (isPairedKiosk) onKioskCartChange?.([]);
            else localCart?.clearCart?.();
            setTerminalStatus('idle');
            terminalCheckoutId.current = null;
            onClose();
          }, 3000);
        } else if (result.status === 'CANCELED' || result.status === 'CANCEL_REQUESTED') {
          stopPolling();
          setTerminalStatus('canceled');
          setTerminalError('Payment was canceled on the terminal.');
          if (isPairedKiosk && kioskSendForward) {
            kioskSendForward('checkout_status', { checkoutId, status: 'canceled' });
          }
        }
        // PENDING / IN_PROGRESS → keep polling
      } catch (err) {
        console.error('[Terminal] Poll error:', err);
      }
    }, TERMINAL_POLL_INTERVAL);

    // Auto-timeout after 2 minutes
    timeoutTimer.current = setTimeout(async () => {
      stopPolling();
      // Try to cancel the terminal checkout
      try {
        await fetch(TERMINAL_API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'cancelTerminalCheckout', checkoutId }),
        });
      } catch (e) { /* ignore */ }
      setTerminalStatus('failed');
      setTerminalError('Payment timed out. Please try again.');
    }, TERMINAL_TIMEOUT);
  }, [stopPolling, localCart, onClose, isPairedKiosk, kioskSendForward, onKioskCartChange]);

  const handleTerminalCheckout = useCallback(async () => {
    // Determine items and amount based on paired vs standalone kiosk
    let amountCents, note, terminalLineItems;

    if (isPairedKiosk && kioskCart.length > 0) {
      // Paired kiosk: use synced kioskCart items
      amountCents = Math.round(kioskCart.reduce((sum, item) => {
        const modTotal = (item.modifiers || []).reduce((s, m) => s + (m.price || 0), 0);
        return sum + (parseFloat(item.unitPrice || 0) + modTotal) * item.quantity;
      }, 0) * 100);
      note = kioskCart.map(item => `${item.quantity}x ${item.name}`).join(', ');
      terminalLineItems = kioskCart.map(item => {
        const modTotal = (item.modifiers || []).reduce((s, m) => s + (m.price || 0), 0);
        return {
          name: item.name + (item.variantName ? ` - ${item.variantName}` : '') +
            (item.modifiers?.length ? ` (${item.modifiers.map(m => m.name).join(', ')})` : ''),
          quantity: item.quantity,
          basePriceCents: Math.round((parseFloat(item.unitPrice || 0) + modTotal) * 100),
        };
      });
    } else {
      // Standalone kiosk: use local cart
      if (!cartItems.length) return;
      amountCents = Math.round(localSubtotal * 100);
      note = cartItems.map(item => `${item.quantity}x ${item.name}`).join(', ');
      terminalLineItems = cartItems.map(item => {
        const modTotal = (item.modifiers || []).reduce((s, m) => s + (parseFloat(m.price) || 0), 0);
        return {
          name: item.name + (item.variantName ? ` - ${item.variantName}` : '') +
            (item.modifiers?.length ? ` (${item.modifiers.map(m => `${m.key}: ${m.value}`).join(', ')})` : ''),
          quantity: item.quantity,
          basePriceCents: Math.round((item.unitPrice + modTotal) * 100),
        };
      });
    }

    if (amountCents <= 0) return;

    setTerminalStatus('sending');
    setTerminalError(null);

    try {
      const res = await fetch(TERMINAL_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'createTerminalCheckout',
          amountCents,
          note,
          deviceId: kioskTerminal?.deviceId,
          locationId: kioskTerminal?.locationId,
          lineItems: terminalLineItems,
        }),
      });
      const data = await res.json();
      const result = typeof data.body === 'string' ? JSON.parse(data.body) : data;

      if (result.error) {
        setTerminalStatus('failed');
        setTerminalError(result.error);
        return;
      }

      terminalCheckoutId.current = result.checkoutId;
      setTerminalStatus('waiting');
      // Broadcast checkout started to paired POS
      if (isPairedKiosk && kioskSendForward) {
        kioskSendForward('checkout_started', {
          checkoutId: result.checkoutId,
          method: 'square_terminal',
          total: amountCents / 100,
        });
      }
      pollTerminalStatus();
    } catch (err) {
      console.error('[Terminal] Create checkout error:', err);
      setTerminalStatus('failed');
      setTerminalError('Failed to connect to terminal. Please try again.');
    }
  }, [cartItems, localSubtotal, pollTerminalStatus, kioskTerminal, isPairedKiosk, kioskCart, kioskSendForward]);

  const handleCancelTerminal = useCallback(async () => {
    if (terminalCheckoutId.current) {
      try {
        await fetch(TERMINAL_API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'cancelTerminalCheckout', checkoutId: terminalCheckoutId.current }),
        });
      } catch (e) { /* ignore */ }
    }
    if (isPairedKiosk && kioskSendForward) {
      kioskSendForward('checkout_status', { checkoutId: terminalCheckoutId.current, status: 'canceled' });
    }
    stopPolling();
    setTerminalStatus('idle');
    setTerminalError(null);
    terminalCheckoutId.current = null;
  }, [stopPolling, isPairedKiosk, kioskSendForward]);

  // In paired kiosk mode, derive totals from kioskCart
  const pairedSubtotal = useMemo(() => {
    if (!isPairedKiosk) return 0;
    return kioskCart.reduce((sum, item) => {
      const modTotal = (item.modifiers || []).reduce((s, m) => s + (m.price || 0), 0);
      return sum + (parseFloat(item.unitPrice || 0) + modTotal) * item.quantity;
    }, 0);
  }, [isPairedKiosk, kioskCart]);

  const subtotal = isPairedKiosk ? pairedSubtotal : localSubtotal;
  const lineItemsSubtotal = subtotal; // No server-side discount allocations in local cart
  const totalItems = isPairedKiosk
    ? kioskCart.reduce((sum, item) => sum + item.quantity, 0)
    : localCart?.getCartCount?.() || 0;
  
  // Calculate total savings — free gift items contribute their full price as savings
  const totalSavings = useMemo(() => {
    return cartItems.reduce((total, item) => {
      if (item.isFreeGift) {
        return total + item.unitPrice * item.quantity;
      }
      return total;
    }, 0);
  }, [cartItems]);
  
  const hasSavings = totalSavings > 0;
  
  // Calculate progress toward rewards
  const cartTotal = parseFloat(subtotal) || 0;
  
  // State for showing reward selection in cart drawer
  const [showRewardSelection, setShowRewardSelection] = useState(false);

  // Detect mixed cart (non-shippable desserts + merchandise)
  const { hasNonShippableDesserts, hasShippableDesserts, hasMerchandise } = useMemo(() => {
    let hasNonShippableDesserts = false;
    let hasShippableDesserts = false;
    let hasMerchandise = false;

    cartItems.forEach(item => {
      const matchedProduct = products?.find(p =>
        p.id === item.productId ||
        p.shopifyId === item.productId ||
        p.variantId === item.variantId ||
        p.variants?.some(v => v.id === item.variantId)
      );

      const isDessert =
        matchedProduct?.category === 'desserts' ||
        matchedProduct?.productType === 'desserts';

      if (isDessert) {
        const canShip = matchedProduct?.canShip === true;
        if (canShip) {
          hasShippableDesserts = true;
        } else {
          hasNonShippableDesserts = true;
        }
      } else {
        hasMerchandise = true;
      }
    });

    return { hasNonShippableDesserts, hasShippableDesserts, hasMerchandise };
  }, [cartItems, products]);

  // Mixed cart warning only shows if there are non-shippable desserts with merchandise
  const isMixedCart = hasNonShippableDesserts && hasMerchandise;
  // Show desserts-only message only if there are non-shippable desserts and no merchandise
  const hasDessertsOnly = hasNonShippableDesserts && !hasMerchandise;

  // Kiosk cart item handlers (paired mode)
  const handleKioskRemoveItem = useCallback((sku, variantSku) => {
    const updated = kioskCart.filter(item => !(item.sku === sku && item.variantSku === variantSku));
    onKioskCartChange?.(updated);
  }, [kioskCart, onKioskCartChange]);

  const handleKioskUpdateQuantity = useCallback((sku, variantSku, newQty) => {
    if (newQty < 1) return;
    const updated = kioskCart.map(item =>
      item.sku === sku && item.variantSku === variantSku ? { ...item, quantity: newQty } : item
    );
    onKioskCartChange?.(updated);
  }, [kioskCart, onKioskCartChange]);

  // Web checkout state
  const [webCheckoutLoading, setWebCheckoutLoading] = useState(false);
  const [webCheckoutError, setWebCheckoutError] = useState(null);

  // Delivery address validation state
  const [showDeliveryModal, setShowDeliveryModal] = useState(false);
  const [deliveryAddress, setDeliveryAddress] = useState(() => {
    try {
      const saved = localStorage.getItem('deliveryAddress');
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  });
  const [deliveryValidating, setDeliveryValidating] = useState(false);
  const [deliveryError, setDeliveryError] = useState(null);
  const [manualAddress, setManualAddress] = useState({ address1: '', city: '', provinceCode: '', zip: '' });
  const [useManualEntry, setUseManualEntry] = useState(false);

  // Order calculation state (tax + shipping preview)
  const [orderCalc, setOrderCalc] = useState(null);
  const [orderCalcLoading, setOrderCalcLoading] = useState(false);
  const orderCalcTimer = useRef(null);

  // Fetch order calculation whenever cart items change (debounced)
  useEffect(() => {
    if (orderCalcTimer.current) clearTimeout(orderCalcTimer.current);
    if (isKioskMode || cartItems.length === 0) {
      setOrderCalc(null);
      return;
    }

    orderCalcTimer.current = setTimeout(async () => {
      setOrderCalcLoading(true);
      try {
        const selectedLocation = localStorage.getItem('selectedLocation') || '';
        const methods = new Set(cartItems.map(i => i.fulfillmentMethod || 'pickup'));
        const fulfillmentMethods = [...methods];

        const res = await fetch(CHECKOUT_API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'calculateSquareOrder',
            cartItems: cartItems.map(item => ({
              sku: item.sku,
              variantSku: item.variantSku,
              name: item.name,
              variantName: item.variantName,
              clientPrice: item.unitPrice,
              quantity: item.quantity,
              modifiers: item.modifiers || [],
              isFreeGift: item.isFreeGift || false,
              discountId: item.discountId || null,
            })),
            pickupLocation: selectedLocation,
            fulfillmentMethods,
            deliveryAddress: deliveryAddress ? {
              address1: deliveryAddress.address1,
              city: deliveryAddress.city,
              provinceCode: deliveryAddress.provinceCode,
              zip: deliveryAddress.zip,
            } : undefined,
            shipdayDeliveryFee: deliveryAddress?.shipdayDeliveryFee ?? undefined,
            tipAmountCents: 0,
          }),
        });
        const data = await res.json();
        const result = typeof data.body === 'string' ? JSON.parse(data.body) : data;
        if (result.subtotal != null) {
          setOrderCalc(result);
        }
      } catch (err) {
        console.warn('[CartDrawer] Order calc failed:', err.message);
      }
      setOrderCalcLoading(false);
    }, 400); // debounce 400ms

    return () => {
      if (orderCalcTimer.current) clearTimeout(orderCalcTimer.current);
    };
  }, [isKioskMode, cartItems, deliveryAddress]);

  const handleWebCheckout = useCallback(async (validatedDelivery = null) => {
    if (!cartItems.length) return;
    setWebCheckoutLoading(true);
    setWebCheckoutError(null);
    try {
      const selectedLocationSlug = localStorage.getItem('selectedLocation');
      const checkoutBody = {
        action: 'createWebCheckout',
        cartItems: cartItems.map(item => ({
          productId: item.productId,
          variantId: item.variantId,
          sku: item.sku,
          variantSku: item.variantSku,
          name: item.name,
          variantName: item.variantName,
          clientPrice: item.unitPrice,
          quantity: item.quantity,
          modifiers: item.modifiers || [],
          isFreeGift: item.isFreeGift || false,
          discountId: item.discountId || null,
          image: item.image,
          fulfillmentMethod: item.fulfillmentMethod || null,
        })),
        pickupLocation: selectedLocationSlug,
        cartSessionId: localCart?.cartId,
      };

      // Include delivery data if validated
      const delivery = validatedDelivery || deliveryAddress;
      if (delivery) {
        checkoutBody.deliveryAddress = {
          address1: delivery.address1,
          city: delivery.city,
          provinceCode: delivery.provinceCode,
          zip: delivery.zip,
        };
        checkoutBody.deliveryOptionHandle = delivery.handle;
      }

      const res = await fetch(CHECKOUT_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(checkoutBody),
      });
      const data = await res.json();
      const result = typeof data.body === 'string' ? JSON.parse(data.body) : data;

      if (result.error) {
        setWebCheckoutError(result.error);
        return;
      }

      if (result.checkoutUrl) {
        window.location.href = result.checkoutUrl;
      }
    } catch (err) {
      console.error('[WebCheckout] Error:', err);
      setWebCheckoutError('Failed to create checkout. Please try again.');
    } finally {
      setWebCheckoutLoading(false);
    }
  }, [cartItems, localCart?.cartId, deliveryAddress]);

  // Validate delivery address via Lambda
  const handleValidateDeliveryAddress = useCallback(async (addressToValidate) => {
    setDeliveryValidating(true);
    setDeliveryError(null);
    try {
      const selectedLocationSlug = localStorage.getItem('selectedLocation');
      const res = await fetch(SHIPPING_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'checkDeliveryAvailability',
          deliveryAddress: addressToValidate,
          pickupLocation: selectedLocationSlug,
        }),
      });
      const data = await res.json();
      const result = typeof data.body === 'string' ? JSON.parse(data.body) : data;

      if (result.error) {
        setDeliveryError(result.error);
        return;
      }

      if (result.available) {
        setDeliveryAddress({
          ...addressToValidate,
          shipdayDeliveryFee: result.deliveryFee,
          estimatedMinutes: result.estimatedMinutes,
          services: result.services,
        });
        setShowDeliveryModal(false);
      } else {
        setDeliveryError(result.message || 'Delivery is not available to this address.');
      }
    } catch (err) {
      console.error('[DeliveryValidation] Error:', err);
      setDeliveryError('Failed to validate address. Please try again.');
    } finally {
      setDeliveryValidating(false);
    }
  }, []);

  const handleCheckout = () => {
    if (isKioskMode) {
      handleTerminalCheckout();
    } else {
      const hasDelivery = cartItems.some(i => i.fulfillmentMethod === 'delivery');
      if (hasDelivery && !deliveryAddress) {
        // Prompt for delivery address validation first
        setShowDeliveryModal(true);
        return;
      }
      onClose();
      navigate('/checkout');
    }
  };

  // Determine if checkout should be disabled
  const isCheckoutDisabled = terminalStatus !== 'idle' || !!kioskRemoteCheckout || webCheckoutLoading;

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      sx={{
        '& .MuiDrawer-paper': {
          width: { xs: '100%', sm: 400 },
          maxWidth: '100%'
        }
      }}
    >
      <Box sx={{ 
        display: 'flex', 
        flexDirection: 'column', 
        height: '100%',
        bgcolor: 'white'
      }}>
        {/* Header */}
        <Box sx={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          p: 2,
          borderBottom: 1,
          borderColor: 'divider'
        }}>
          <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
            Your Bag ({totalItems})
          </Typography>
          <IconButton onClick={onClose}>
            <CloseIcon />
          </IconButton>
        </Box>

        {(isPairedKiosk ? kioskCart.length === 0 : cartItems.length === 0) ? (
          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', p: 3 }}>
            <Typography variant="h6" color="text.secondary" gutterBottom>
              Your bag is empty
            </Typography>
            <Button 
              variant="grey-back"
              onClick={onClose}
              sx={{ mt: 2 }}
            >
              Continue Shopping
            </Button>
          </Box>
        ) : (
          <>
            {/* Cart Items - Scrollable */}
            <Box sx={{ flex: 1, overflowY: 'auto', p: 2 }}>
              {/* Discounts Section - Single Card */}
              <Box sx={{
                mb: 2,
                border: '1px solid',
                borderColor: 'grey.300',
                borderRadius: 2,
                overflow: 'hidden',
                display: (orderDiscounts?.length > 0 || quantityProgress?.hasActiveReward) ? 'block' : 'none',
              }}>
                {(() => {
                  // Build unified list of all discounts with progress info
                  const allDiscounts = [];
                  
                  // 1. Order Discounts (percentage off or amount off)
                  orderDiscounts?.forEach(discount => {
                    const current = parseFloat(subtotal);
                    const threshold = discount.threshold;
                    const progress = threshold > 0 ? Math.min((current / threshold) * 100, 100) : 100;
                    const unlocked = threshold > 0 ? current >= threshold : true;
                    const remaining = Math.max(0, threshold - current);
                    const isPercentage = discount.valueType === 'PERCENTAGE';
                    const displayValue = isPercentage ? `${discount.percentOff}%` : `$${discount.amountOff}`;
                    const thresholdLabel = threshold > 0 ? ` for orders over $${threshold}` : '';

                    allDiscounts.push({
                      id: discount.id,
                      type: 'order',
                      title: `${displayValue} Off Your Order${thresholdLabel}`,
                      shortTitle: `${displayValue} Off`,
                      threshold,
                      current,
                      progress,
                      unlocked,
                      remaining,
                      percentOff: discount.percentOff,
                      amountOff: discount.amountOff,
                      valueType: discount.valueType,
                      priority: 2 // medium priority
                    });
                  });
                  
                  // 3. Quantity-based rewards (only show if there are qualifying items in cart)
                  if (quantityProgress?.hasActiveReward && quantityProgress.current > 0) {
                    allDiscounts.push({
                      id: 'quantity-reward',
                      type: 'quantity',
                      title: `Free Item for ${quantityProgress.required} or more blind boxes`,
                      shortTitle: 'Free Item',
                      threshold: quantityProgress.required,
                      current: quantityProgress.current,
                      progress: quantityProgress.progress,
                      unlocked: quantityProgress.unlocked,
                      remaining: quantityProgress.remaining,
                      options: quantityProgress.options,
                      hasMultipleOptions: quantityProgress.hasMultipleOptions,
                      priority: 1 // highest priority (closest to user action)
                    });
                  }
                  
                  // Sort by: unlocked items last, then by progress (highest first), then by priority
                  allDiscounts.sort((a, b) => {
                    // Unlocked items go to the end
                    if (a.unlocked && !b.unlocked) return 1;
                    if (!a.unlocked && b.unlocked) return -1;
                    // If both unlocked or both locked, sort by priority (lower number = higher priority)
                    if (a.unlocked === b.unlocked) {
                      // Sort by progress descending (closest to unlocking first)
                      if (b.progress !== a.progress) return b.progress - a.progress;
                      // Then by priority
                      return a.priority - b.priority;
                    }
                    return 0;
                  });
                  
                  // Find the first non-unlocked discount (the "active" one to expand)
                  const activeDiscountIndex = allDiscounts.findIndex(d => !d.unlocked);
                  
                  return allDiscounts.map((discount, index) => {
                    const isActive = index === activeDiscountIndex;
                    const isLast = index === allDiscounts.length - 1;
                    
                    return (
                      <Box key={discount.id}>
                        {/* Discount Row */}
                        <Box sx={{ 
                          p: 1.5,
                          bgcolor: discount.unlocked ? '#e8f5e9' : (isActive ? 'grey.50' : 'white'),
                          borderBottom: !isLast ? '1px solid' : 'none',
                          borderColor: 'grey.200'
                        }}>
                          {/* Title Row */}
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            {discount.type === 'order' && (
                              <Box sx={{
                                fontSize: '1.6rem',
                                fontWeight: 700,
                                color: discount.unlocked ? 'success.main' : '#e65100',
                                minWidth: 36
                              }}>
                                {discount.valueType === 'PERCENTAGE' ? `${discount.percentOff}%` : `$${discount.amountOff}`}
                              </Box>
                            )}
                            {discount.type === 'quantity' && (
                              <CardGiftcardIcon sx={{ 
                                fontSize: '1.6rem', 
                                color: discount.unlocked ? 'success.main' : '#e65100'
                              }} />
                            )}
                            
                            <Typography sx={{ 
                              flex: 1,
                              fontSize: '1.6rem', 
                              fontWeight: discount.unlocked ? 600 : (isActive ? 600 : 400),
                              color: discount.unlocked ? 'success.main' : 'text.primary'
                            }}>
                              {discount.title}
                            </Typography>
                            
                            {discount.unlocked && (
                              <CheckCircleIcon sx={{ fontSize: '1.6rem', color: 'success.main' }} />
                            )}
                          </Box>
                          
                          {/* Expanded Content - only for active (closest to unlocking) discount */}
                          {isActive && !discount.unlocked && (
                            <Box sx={{ mt: 1.5 }}>
                              {/* Progress Bar for dollar-based discounts */}
                              {discount.type === 'order' && (
                                <>
                                  {/* Horizontal Progress Bar */}
                                  <Box sx={{ 
                                    height: 8, 
                                    bgcolor: 'grey.200', 
                                    borderRadius: 4,
                                    overflow: 'hidden',
                                    mb: 1
                                  }}>
                                    <Box sx={{ 
                                      height: '100%', 
                                      width: `${discount.progress}%`,
                                      bgcolor: '#ff9800',
                                      borderRadius: 4,
                                      transition: 'width 0.3s ease'
                                    }} />
                                  </Box>
                                  
                                  {/* Status Message */}
                                  <Typography sx={{ 
                                    fontSize: '1.6rem', 
                                    color: 'text.secondary',
                                    textAlign: 'center'
                                  }}>
                                    ${discount.remaining.toFixed(2)} needed to unlock {discount.shortTitle}
                                  </Typography>
                                </>
                              )}
                              
                              {/* Selection UI for quantity-based rewards */}
                              {discount.type === 'quantity' && (
                                <>
                                  {/* Status Message */}
                                  <Typography sx={{
                                    fontSize: '1.6rem',
                                    color: 'text.secondary',
                                    textAlign: 'center',
                                    mb: 0.5
                                  }}>
                                    Add {discount.remaining} more blind box{discount.remaining !== 1 ? 'es' : ''} to receive your free item
                                  </Typography>
                                  <BlindBoxProgressIndicator
                                    current={discount.current}
                                    required={discount.threshold}
                                    onClickIncomplete={onAddBlindBox}
                                  />
                                  
                                  {/* Reward Options */}
                                  {discount.options?.map((option, optIndex) => {
                                    const isSelected = selectedRewards[discount.threshold] === option.id;
                                    
                                    return (
                                      <Box key={option.id}>
                                        <RewardOption
                                          option={option}
                                          isSelected={isSelected}
                                          isLocked={true}
                                          onSelect={() => {}}
                                          showBorder={false}
                                          products={products}
                                        />
                                        {optIndex < discount.options.length - 1 && (
                                          <Typography sx={{ 
                                            textAlign: 'center', 
                                            color: 'text.secondary',
                                            fontSize: '1.6rem',
                                            py: 0.5
                                          }}>
                                            — or —
                                          </Typography>
                                        )}
                                      </Box>
                                    );
                                  })}
                                </>
                              )}
                            </Box>
                          )}
                          
                          {/* Selection UI when quantity reward is unlocked */}
                          {discount.type === 'quantity' && discount.unlocked && (
                            <Box sx={{ mt: 1.5 }}>
                              {(() => {
                                const selectedId = selectedRewards[discount.threshold];
                                const showOptions = selectedRewards[`${discount.threshold}_showOptions`];
                                
                                // If selected and not showing options, show selected item only
                                if (selectedId && !showOptions) {
                                  const selectedOption = discount.options?.find(o => o.id === selectedId);
                                  if (selectedOption) {
                                    return (
                                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <Box sx={{ flex: 1 }}>
                                          <RewardOption
                                            option={selectedOption}
                                            isSelected={true}
                                            isLocked={false}
                                            onSelect={() => {}}
                                            showBorder={false}
                                            products={products}
                                          />
                                        </Box>
                                        {discount.hasMultipleOptions && (
                                          <Button
                                            size="small"
                                            onClick={() => onSelectReward(`${discount.threshold}_showOptions`, true)}
                                            sx={{ fontSize: '1.6rem', textTransform: 'none' }}
                                          >
                                            Change
                                          </Button>
                                        )}
                                      </Box>
                                    );
                                  }
                                }
                                
                                // Show selection UI
                                return (
                                  <>
                                    {discount.hasMultipleOptions && !selectedId && (
                                      <Typography sx={{ 
                                        fontSize: '1.6rem', 
                                        color: '#e65100',
                                        fontWeight: 600,
                                        mb: 1,
                                        textAlign: 'center'
                                      }}>
                                        Select your free reward:
                                      </Typography>
                                    )}
                                    
                                    {discount.options?.map((option, optIndex) => {
                                      const isSelected = selectedRewards[discount.threshold] === option.id;
                                      
                                      return (
                                        <Box key={option.id}>
                                          <Box
                                            onClick={() => {
                                              onSelectReward(discount.threshold, option.id);
                                              onSelectReward(`${discount.threshold}_showOptions`, false);
                                            }}
                                            sx={{ cursor: 'pointer' }}
                                          >
                                            <RewardOption
                                              option={option}
                                              isSelected={isSelected}
                                              isLocked={false}
                                              onSelect={() => {}}
                                              showBorder={true}
                                              products={products}
                                            />
                                          </Box>
                                          {optIndex < discount.options.length - 1 && (
                                            <Typography sx={{ 
                                              textAlign: 'center', 
                                              color: 'text.secondary',
                                              fontSize: '1.6rem',
                                              py: 0.5
                                            }}>
                                              — or —
                                            </Typography>
                                          )}
                                        </Box>
                                      );
                                    })}
                                    
                                    {showOptions && selectedId && (
                                      <Button
                                        fullWidth
                                        variant="outlined"
                                        size="small"
                                        onClick={() => onSelectReward(`${discount.threshold}_showOptions`, false)}
                                        sx={{ mt: 1, fontSize: '1.6rem' }}
                                      >
                                        Cancel
                                      </Button>
                                    )}
                                  </>
                                );
                              })()}
                            </Box>
                          )}
                        </Box>
                      </Box>
                    );
                  });
                })()}
              </Box>
              
              {(orderDiscounts?.length > 0 || quantityProgress?.hasActiveReward) && <Divider sx={{ mb: 2 }} />}

              {/* Mixed Cart Warning */}
              {isMixedCart && (
                <Alert 
                  severity="info" 
                  icon={<LocalShippingOutlinedIcon />}
                  sx={{ '& .MuiAlert-message': { fontSize: '1.6rem' }, mb: 2 }}
                >
                  <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5, fontSize: '1.6rem' }}>
                    Pickup or Local Delivery Only
                  </Typography>
                  <Typography variant="body2" sx={{ fontSize: '1.6rem' }}>
                    Your cart contains desserts which can only be picked up or delivered locally. 
                    Shipping will be available if desserts are removed.
                  </Typography>
                </Alert>
              )}

              {/* Cart Items */}
              <Stack spacing={0}>
                {isPairedKiosk ? (
                  /* Paired Kiosk Cart Items */
                  kioskCart.map((item) => {
                    const modTotal = (item.modifiers || []).reduce((s, m) => s + (m.price || 0), 0);
                    const lineTotal = (parseFloat(item.unitPrice || 0) + modTotal) * item.quantity;

                    return (
                      <Box key={`${item.sku}-${item.variantSku || ''}`}>
                        <Box sx={{ display: 'flex', gap: 2 }}>
                          {/* Product Image */}
                          <Box
                            sx={{
                              width: 80, height: 80, flexShrink: 0, borderRadius: 2,
                              overflow: 'hidden', bgcolor: 'grey.100', position: 'relative'
                            }}
                          >
                            {item.image ? (
                              <img src={item.image} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                              <Box sx={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'grey.200' }}>
                                <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '1.6rem' }}>No image</Typography>
                              </Box>
                            )}
                          </Box>

                          {/* Product Details */}
                          <Box sx={{ flex: 1 }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                              <Typography variant="body1" sx={{ fontWeight: 500, fontSize: '1.6rem' }}>
                                {item.name}
                              </Typography>
                              <Button
                                color="primary"
                                onClick={() => handleKioskRemoveItem(item.sku, item.variantSku)}
                                sx={{ padding: 0, minWidth: 'auto', ml: 1, fontSize: '1.6rem' }}
                              >
                                Remove
                              </Button>
                            </Box>

                            {item.variantName && (
                              <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5, fontSize: '1.6rem' }}>
                                {item.variantName}
                              </Typography>
                            )}

                            {/* Modifiers */}
                            {item.modifiers?.length > 0 && (
                              <Box sx={{ mt: 0.5 }}>
                                {item.modifiers.map((mod, idx) => (
                                  <Typography key={idx} variant="body2" sx={{ color: 'text.secondary', fontSize: '1.6rem' }}>
                                    {mod.name}{mod.price > 0 ? ` (+$${mod.price.toFixed(2)})` : ''}
                                  </Typography>
                                ))}
                              </Box>
                            )}

                            <Typography variant="body1" sx={{ mt: 0.5, fontSize: '1.6rem' }}>
                              ${(parseFloat(item.unitPrice || 0) + modTotal).toFixed(2)}
                            </Typography>

                            <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <CartQuantitySelector
                                value={item.quantity}
                                onIncrement={() => handleKioskUpdateQuantity(item.sku, item.variantSku, item.quantity + 1)}
                                onDecrement={() => handleKioskUpdateQuantity(item.sku, item.variantSku, item.quantity - 1)}
                              />
                              <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                                ${lineTotal.toFixed(2)}
                              </Typography>
                            </Box>
                          </Box>
                        </Box>
                      </Box>
                    );
                  })
                ) : (
                  /* Local Cart Items — grouped by fulfillment method */
                  (() => {
                    const locationObj = storeLocations?.find(loc => loc.id === selectedLocation) || storeLocations?.[0];
                    const locationName = locationObj?.name || '';
                    const methodOrder = ['pickup', 'delivery', 'shipping'];
                    const grouped = {};
                    cartItems.forEach(item => {
                      const m = item.fulfillmentMethod || 'pickup';
                      if (!grouped[m]) grouped[m] = [];
                      grouped[m].push(item);
                    });
                    const sortedMethods = Object.keys(grouped).sort((a, b) => methodOrder.indexOf(a) - methodOrder.indexOf(b));
                    const hasMultipleMethods = sortedMethods.length > 1;

                    return sortedMethods.map((method, methodIdx) => (
                      <React.Fragment key={method}>
                        {/* Section header */}
                        {methodIdx > 0 && <Divider sx={{ my: 1 }} />}
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 1, ...(hasMultipleMethods ? { bgcolor: 'grey.50', mx: -2, px: 2 } : {}) }}>
                          {method === 'pickup' && <StorefrontIcon sx={{ fontSize: 18, color: 'text.secondary' }} />}
                          {method === 'delivery' && <LocalShippingIcon sx={{ fontSize: 18, color: 'text.secondary' }} />}
                          {method === 'shipping' && <LocalShippingOutlinedIcon sx={{ fontSize: 18, color: 'text.secondary' }} />}
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {method === 'pickup' && `Pickup${locationName ? ` at ${locationName}` : ''}`}
                            {method === 'delivery' && (deliveryAddress
                              ? `Delivery to ${deliveryAddress.address1}, ${deliveryAddress.city}`
                              : `Delivery${locationName ? ` from ${locationName}` : ''}`)}
                            {method === 'shipping' && 'Shipping'}
                          </Typography>
                        </Box>
                        {/* Items in this group */}
                        {grouped[method].map((item, itemIdx) => {
                          const modTotal = (item.modifiers || []).reduce((s, m) => s + (parseFloat(m.price) || 0), 0);
                          const unitWithMods = item.unitPrice + modTotal;
                          const lineTotal = unitWithMods * item.quantity;
                          const isFreeGift = item.isFreeGift;

                          return (
                            <React.Fragment key={item.id}>
                              {itemIdx > 0 && <Divider />}
                              <Box sx={{ py: 1 }}>
                                <Box sx={{ display: 'flex', gap: 2 }}>
                                  <Box sx={{ width: 80, height: 80, flexShrink: 0, borderRadius: 2, overflow: 'hidden', bgcolor: 'grey.100', position: 'relative' }}>
                                    {item.image ? (
                                      <img src={item.image} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    ) : (
                                      <Box sx={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'grey.200' }}>
                                        <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '1.6rem' }}>No image</Typography>
                                      </Box>
                                    )}
                                  </Box>
                                  <Box sx={{ flex: 1 }}>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                      <Typography variant="body1" sx={{ fontWeight: 500, fontSize: '1.6rem' }}>
                                        {item.name}
                                      </Typography>
                                      <Button color="primary" onClick={() => localCart.removeFromCart(item.id)}
                                        sx={{ padding: 0, minWidth: 'auto', ml: 1, fontSize: '1.6rem' }}>
                                        Remove
                                      </Button>
                                    </Box>
                                    {item.variantName && item.variantName !== 'Default Title' && (
                                      <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5, fontSize: '1.6rem' }}>
                                        {item.variantName}
                                      </Typography>
                                    )}
                                    {item.modifiers?.length > 0 && (
                                      <Box sx={{ mt: 0.5 }}>
                                        {item.modifiers.flatMap(mod => mod.value.split(', ')).map((name, idx) => (
                                          <Typography key={idx} variant="body2" sx={{ color: 'text.secondary', fontSize: '1.6rem' }}>
                                            {name}
                                          </Typography>
                                        ))}
                                      </Box>
                                    )}
                                    <Typography variant="body1" sx={{ mt: 0.5, fontSize: '1.6rem' }}>
                                      {isFreeGift ? (
                                        <span style={{ color: '#2e7d32', fontWeight: 600 }}>FREE</span>
                                      ) : (
                                        `$${unitWithMods.toFixed(2)}`
                                      )}
                                    </Typography>
                                    <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                      {!isFreeGift && (
                                        <CartQuantitySelector
                                          value={item.quantity}
                                          onIncrement={() => localCart.updateQuantity(item.id, item.quantity + 1)}
                                          onDecrement={() => localCart.updateQuantity(item.id, item.quantity - 1)}
                                        />
                                      )}
                                      <Typography variant="body1" sx={{ fontWeight: 'bold', color: isFreeGift ? 'success.main' : 'inherit' }}>
                                        {isFreeGift ? 'Free Gift' : `$${lineTotal.toFixed(2)}`}
                                      </Typography>
                                    </Box>
                                  </Box>
                                </Box>
                              </Box>
                            </React.Fragment>
                          );
                        })}
                      </React.Fragment>
                    ));
                  })()
                )}
              </Stack>
              
              {/* Continue Shopping - Inside scrollable area */}
              <Box sx={{ mt: 3, pt: 2, borderTop: 1, borderColor: 'divider' }}>
                <Button
                  variant="grey-back"
                  fullWidth
                  onClick={onClose}
                >
                  Continue Shopping
                </Button>
              </Box>
              
            </Box>

            {/* Checkout Footer - Docked at bottom */}
            <Box sx={{
              borderTop: 1,
              borderColor: 'divider',
              p: 2,
              bgcolor: 'white'
            }}>
              {/* Order totals breakdown */}
              {!isKioskMode && orderCalc ? (
                <Box sx={{ mb: 1.5 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.25 }}>
                    <Typography variant="body2" color="text.secondary">Subtotal</Typography>
                    <Typography variant="body2">${(orderCalc.subtotal / 100).toFixed(2)}</Typography>
                  </Box>
                  {orderCalc.discount > 0 && (
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.25 }}>
                      <Typography variant="body2" sx={{ color: 'success.main' }}>Discount</Typography>
                      <Typography variant="body2" sx={{ color: 'success.main' }}>-${(orderCalc.discount / 100).toFixed(2)}</Typography>
                    </Box>
                  )}
                  {orderCalc.deliveryFee > 0 && (() => {
                    const methods = new Set(cartItems.map(i => i.fulfillmentMethod || 'pickup'));
                    const hasDelivery = methods.has('delivery');
                    const hasShipping = methods.has('shipping');
                    const label = hasDelivery && hasShipping ? 'Delivery + Shipping'
                      : hasShipping ? 'Shipping' : 'Delivery';
                    return (
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.25 }}>
                        <Typography variant="body2" color="text.secondary">{label}</Typography>
                        <Typography variant="body2">${(orderCalc.deliveryFee / 100).toFixed(2)}</Typography>
                      </Box>
                    );
                  })()}
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.25 }}>
                    <Typography variant="body2" color="text.secondary">Tax</Typography>
                    <Typography variant="body2">{orderCalcLoading ? '...' : `$${(orderCalc.tax / 100).toFixed(2)}`}</Typography>
                  </Box>
                  <Divider sx={{ my: 0.75 }} />
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" fontWeight="bold">Total</Typography>
                    <Typography variant="body2" fontWeight="bold">
                      ${(orderCalc.total / 100).toFixed(2)}
                    </Typography>
                  </Box>
                </Box>
              ) : (
                <Box sx={{ mb: 1.5 }}>
                  <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
                    <Typography variant="body2" fontWeight="bold">
                      ${parseFloat(subtotal).toFixed(2)}
                    </Typography>
                    {hasSavings && (
                      <Typography variant="body2" sx={{ textDecoration: 'line-through', color: 'text.disabled' }}>
                        ${parseFloat(lineItemsSubtotal).toFixed(2)}
                      </Typography>
                    )}
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    {isKioskMode ? 'Tax calculated at terminal' : orderCalcLoading ? 'Calculating tax...' : 'Tax calculated at checkout'}
                  </Typography>
                </Box>
              )}
              <Button
                variant="contained"
                fullWidth
                onClick={handleCheckout}
                disabled={isCheckoutDisabled}
              >
                {webCheckoutLoading ? (
                  <CircularProgress size={20} sx={{ color: 'white' }} />
                ) : (
                  isKioskMode ? 'Pay at Terminal' : 'Checkout'
                )}
              </Button>
              {webCheckoutError && (
                <Alert severity="error" sx={{ mt: 1, '& .MuiAlert-message': { fontSize: '1.4rem' } }}>
                  {webCheckoutError}
                </Alert>
              )}
            </Box>
          </>
        )}

        {/* Delivery Address Modal */}
        <Dialog
          open={showDeliveryModal}
          onClose={() => setShowDeliveryModal(false)}
          maxWidth="sm"
          fullWidth
          PaperProps={{ sx: { mx: 2 } }}
        >
          <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, pb: 1 }}>
            <LocalShippingIcon />
            Delivery Address
          </DialogTitle>
          <DialogContent>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Enter your delivery address to confirm availability in our delivery zone.
            </Typography>

            {!useManualEntry ? (
              <Box sx={{ mb: 2 }}>
                <GoogleAddressAutocomplete
                  value={null}
                  sendToCatering={({ type, address, field, value }) => {
                    if (type === 'SET_FULL_DELIVERY_ADDRESS' && address) {
                      setManualAddress({
                        address1: address.street,
                        city: address.city,
                        provinceCode: address.state,
                        zip: address.zip,
                      });
                    } else if (type === 'UPDATE_DELIVERY_ADDRESS' && field === 'street') {
                      setManualAddress(prev => ({ ...prev, address1: value }));
                    } else if (type === 'CLEAR_DELIVERY_ADDRESS') {
                      setManualAddress({ address1: '', city: '', provinceCode: '', zip: '' });
                    }
                  }}
                  onAddressSelected={(success) => {
                    if (!success) {
                      setUseManualEntry(true);
                    }
                  }}
                />
              </Box>
            ) : (
              <Stack spacing={2} sx={{ mb: 2 }}>
                <TextField
                  label="Street Address"
                  value={manualAddress.address1}
                  onChange={(e) => setManualAddress(prev => ({ ...prev, address1: e.target.value }))}
                  fullWidth
                  size="small"
                />
                <TextField
                  label="City"
                  value={manualAddress.city}
                  onChange={(e) => setManualAddress(prev => ({ ...prev, city: e.target.value }))}
                  fullWidth
                  size="small"
                />
                <Box sx={{ display: 'flex', gap: 2 }}>
                  <TextField
                    label="State"
                    value={manualAddress.provinceCode}
                    onChange={(e) => setManualAddress(prev => ({ ...prev, provinceCode: e.target.value.toUpperCase().slice(0, 2) }))}
                    sx={{ width: 100 }}
                    size="small"
                    inputProps={{ maxLength: 2 }}
                  />
                  <TextField
                    label="ZIP Code"
                    value={manualAddress.zip}
                    onChange={(e) => setManualAddress(prev => ({ ...prev, zip: e.target.value }))}
                    sx={{ flex: 1 }}
                    size="small"
                    inputProps={{ maxLength: 10 }}
                  />
                </Box>
                <Button
                  variant="text"
                  size="small"
                  onClick={() => {
                    setUseManualEntry(false);
                    setManualAddress({ address1: '', city: '', provinceCode: '', zip: '' });
                  }}
                >
                  Use address search instead
                </Button>
              </Stack>
            )}

            {deliveryError && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {deliveryError}
              </Alert>
            )}
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setShowDeliveryModal(false)} color="inherit">
              Cancel
            </Button>
            <Button
              variant="contained"
              onClick={() => handleValidateDeliveryAddress(manualAddress)}
              disabled={deliveryValidating || !manualAddress.address1 || !manualAddress.city || !manualAddress.provinceCode || !manualAddress.zip}
            >
              {deliveryValidating ? <CircularProgress size={20} sx={{ color: 'white' }} /> : 'Confirm Address'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Terminal Payment Overlay (Kiosk Mode) */}
        {isKioskMode && terminalStatus !== 'idle' && (
          <Box sx={{
            position: 'absolute',
            inset: 0,
            bgcolor: 'rgba(255,255,255,0.97)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10,
            p: 4,
          }}>
            {terminalStatus === 'sending' && (
              <>
                <CircularProgress size={48} sx={{ mb: 3 }} />
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  Sending to terminal...
                </Typography>
              </>
            )}

            {terminalStatus === 'waiting' && (
              <>
                <ContactlessIcon sx={{ fontSize: 64, color: 'primary.main', mb: 2, animation: 'pulse 1.5s ease-in-out infinite', '@keyframes pulse': { '0%, 100%': { opacity: 1 }, '50%': { opacity: 0.4 } } }} />
                <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
                  Tap or insert card
                </Typography>
                <Typography variant="body1" color="text.secondary" sx={{ mb: 1 }}>
                  Complete payment on the terminal
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 700, mb: 4 }}>
                  ${parseFloat(subtotal).toFixed(2)}
                </Typography>
                <Button variant="outlined" color="inherit" onClick={handleCancelTerminal}>
                  Cancel
                </Button>
              </>
            )}

            {terminalStatus === 'completed' && (
              <>
                <CheckCircleIcon sx={{ fontSize: 64, color: 'success.main', mb: 2 }} />
                <Typography variant="h6" sx={{ fontWeight: 600, color: 'success.main' }}>
                  Payment successful!
                </Typography>
              </>
            )}

            {(terminalStatus === 'failed' || terminalStatus === 'canceled') && (
              <>
                <ErrorOutlineIcon sx={{ fontSize: 64, color: 'error.main', mb: 2 }} />
                <Typography variant="h6" sx={{ fontWeight: 600, color: 'error.main', mb: 1 }}>
                  {terminalStatus === 'canceled' ? 'Payment Canceled' : 'Payment Failed'}
                </Typography>
                {terminalError && (
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 3, textAlign: 'center' }}>
                    {terminalError}
                  </Typography>
                )}
                <Button variant="contained" onClick={() => { setTerminalStatus('idle'); setTerminalError(null); terminalCheckoutId.current = null; }}>
                  Try Again
                </Button>
              </>
            )}
          </Box>
        )}
        {/* Remote Checkout Overlay (Partner device initiated payment) */}
        {isPairedKiosk && kioskRemoteCheckout && (
          <Box sx={{
            position: 'absolute',
            inset: 0,
            bgcolor: 'rgba(255,255,255,0.97)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10,
            p: 4,
          }}>
            {kioskRemoteCheckout.status === 'waiting' && (
              <>
                <ContactlessIcon sx={{ fontSize: 64, color: 'primary.main', mb: 2, animation: 'pulse 1.5s ease-in-out infinite', '@keyframes pulse': { '0%, 100%': { opacity: 1 }, '50%': { opacity: 0.4 } } }} />
                <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
                  Payment in progress
                </Typography>
                <Typography variant="body1" color="text.secondary">
                  Payment initiated from POS
                </Typography>
              </>
            )}
            {kioskRemoteCheckout.status === 'completed' && (
              <>
                <CheckCircleIcon sx={{ fontSize: 64, color: 'success.main', mb: 2 }} />
                <Typography variant="h6" sx={{ fontWeight: 600, color: 'success.main' }}>
                  Payment successful!
                </Typography>
              </>
            )}
            {kioskRemoteCheckout.status === 'canceled' && (
              <>
                <ErrorOutlineIcon sx={{ fontSize: 64, color: 'error.main', mb: 2 }} />
                <Typography variant="h6" sx={{ fontWeight: 600, color: 'error.main' }}>
                  Payment canceled
                </Typography>
              </>
            )}
          </Box>
        )}
      </Box>
    </Drawer>
  );
}

export default CartDrawer;
