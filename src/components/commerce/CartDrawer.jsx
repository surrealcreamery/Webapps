import React, { useMemo, useEffect, useState } from 'react';
import { Drawer, Box, Button, Typography, IconButton, Divider, Stack, Alert } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined';
import CardGiftcardIcon from '@mui/icons-material/CardGiftcard';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import LockIcon from '@mui/icons-material/Lock';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import { useShopify } from '@/contexts/commerce/ShopifyContext_GraphQL';
import { BlindBoxProgressIndicator } from '@/components/commerce/BlindBoxProgressIndicator';

// Reward thresholds configuration (can be moved to Shopify metafields later)
const REWARDS_CONFIG = {
    freeShipping: {
        threshold: 75,
        icon: 'shipping',
        title: 'Free Shipping',
        unlockedMessage: 'Free shipping unlocked!'
    }
};

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
    onAddBlindBox
}) {
  const { checkout, removeFromCart, updateCartItem, goToCheckout, products } = useShopify();

  // Debug: Log checkout object to see discount data
  useEffect(() => {
    if (checkout) {
      console.log('🛒 Cart Debug - Checkout object:', checkout);
      console.log('🛒 Cart Debug - Line items:', checkout.lineItems);
      console.log('🛒 Cart Debug - Subtotal:', checkout.subtotalPrice);
      checkout.lineItems?.forEach((item, i) => {
        console.log(`🛒 Cart Debug - Item ${i} discounts:`, item.discountAllocations);
      });
    }
  }, [checkout]);

  const lineItems = checkout?.lineItems || [];
  const subtotal = checkout?.subtotalPrice?.amount || 0;
  const lineItemsSubtotal = checkout?.lineItemsSubtotalPrice?.amount || subtotal;
  const totalItems = lineItems.reduce((sum, item) => sum + item.quantity, 0);
  
  // Calculate total savings from all discounts
  const totalSavings = useMemo(() => {
    return lineItems.reduce((total, item) => {
      const discountAllocations = item.discountAllocations || [];
      const itemDiscount = discountAllocations.reduce((sum, alloc) => {
        const amount = parseFloat(alloc.allocatedAmount?.amount || alloc.amount?.amount || 0);
        return sum + amount;
      }, 0);
      return total + itemDiscount;
    }, 0);
  }, [lineItems]);
  
  const hasSavings = totalSavings > 0;
  
  // Calculate progress toward rewards
  const cartTotal = parseFloat(subtotal) || 0;
  
  const shippingProgress = useMemo(() => {
    const threshold = REWARDS_CONFIG.freeShipping.threshold;
    const progress = Math.min((cartTotal / threshold) * 100, 100);
    const remaining = Math.max(threshold - cartTotal, 0);
    const unlocked = cartTotal >= threshold;
    return { progress, remaining, unlocked, threshold };
  }, [cartTotal]);
  
  // State for showing reward selection in cart drawer
  const [showRewardSelection, setShowRewardSelection] = useState(false);

  // Detect mixed cart (non-shippable desserts + merchandise)
  const { hasNonShippableDesserts, hasShippableDesserts, hasMerchandise } = useMemo(() => {
    let hasNonShippableDesserts = false;
    let hasShippableDesserts = false;
    let hasMerchandise = false;

    lineItems.forEach(item => {
      const productType = item.variant?.product?.productType?.toLowerCase();
      const variantId = item.variant?.id;
      const matchedProduct = products?.find(p =>
        p.variantId === variantId ||
        p.variants?.some(v => v.id === variantId)
      );

      const isDessert =
        productType === 'desserts' ||
        productType === 'dessert' ||
        matchedProduct?.category === 'desserts' ||
        matchedProduct?.productType === 'desserts';

      if (isDessert) {
        // Check if this dessert can be shipped via fulfillment_methods metafield
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
  }, [lineItems, products]);

  // Mixed cart warning only shows if there are non-shippable desserts with merchandise
  const isMixedCart = hasNonShippableDesserts && hasMerchandise;
  // Show desserts-only message only if there are non-shippable desserts and no merchandise
  const hasDessertsOnly = hasNonShippableDesserts && !hasMerchandise;

  const handleCheckout = () => {
    onClose();
    goToCheckout();
  };

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

        {lineItems.length === 0 ? (
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
                overflow: 'hidden'
              }}>
                {(() => {
                  // Build unified list of all discounts with progress info
                  const allDiscounts = [];
                  
                  // 1. Free Shipping
                  allDiscounts.push({
                    id: 'free-shipping',
                    type: 'shipping',
                    title: `Free Shipping for orders over $${REWARDS_CONFIG.freeShipping.threshold}`,
                    shortTitle: 'Free Shipping',
                    threshold: REWARDS_CONFIG.freeShipping.threshold,
                    current: parseFloat(subtotal),
                    progress: shippingProgress.progress,
                    unlocked: shippingProgress.unlocked,
                    remaining: shippingProgress.remaining,
                    priority: 3 // lowest priority
                  });
                  
                  // 2. Order Discounts (percentage off)
                  orderDiscounts?.forEach(discount => {
                    const current = parseFloat(subtotal);
                    const threshold = discount.threshold;
                    const progress = Math.min((current / threshold) * 100, 100);
                    const unlocked = current >= threshold;
                    const remaining = Math.max(0, threshold - current);
                    
                    allDiscounts.push({
                      id: discount.id,
                      type: 'order',
                      title: `${discount.percentOff}% Off Your Order for orders over $${threshold}`,
                      shortTitle: `${discount.percentOff}% Off`,
                      threshold,
                      current,
                      progress,
                      unlocked,
                      remaining,
                      percentOff: discount.percentOff,
                      priority: 2 // medium priority
                    });
                  });
                  
                  // 3. Quantity-based rewards
                  if (quantityProgress?.hasActiveReward) {
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
                            {discount.type === 'shipping' && (
                              <LocalShippingOutlinedIcon sx={{ 
                                fontSize: '1.6rem', 
                                color: discount.unlocked ? 'success.main' : 'text.secondary'
                              }} />
                            )}
                            {discount.type === 'order' && (
                              <Box sx={{ 
                                fontSize: '1.6rem', 
                                fontWeight: 700,
                                color: discount.unlocked ? 'success.main' : '#e65100',
                                minWidth: 36
                              }}>
                                {discount.percentOff}%
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
                              {(discount.type === 'shipping' || discount.type === 'order') && (
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
                                      bgcolor: discount.type === 'shipping' ? 'primary.main' : '#ff9800',
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
              
              <Divider sx={{ mb: 2 }} />

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

              {/* Desserts Only - Informational (only for non-shippable desserts) */}
              {hasDessertsOnly && (
                <Alert 
                  severity="success" 
                  icon={<LocalShippingOutlinedIcon />}
                  sx={{ '& .MuiAlert-message': { fontSize: '1.6rem' }, mb: 2 }}
                >
                  <Typography variant="body2" sx={{ fontSize: '1.6rem' }}>
                    Desserts are available for <strong>local pickup</strong> or <strong>local delivery</strong>.
                  </Typography>
                </Alert>
              )}

              {/* Cart Items */}
              <Stack spacing={2} divider={<Divider />}>
                {lineItems.map((item) => {
                  const variant = item.variant;
                  const title = item.title;
                  const variantTitle = variant?.title;
                  const price = variant?.price?.amount || variant?.price;
                  const imageUrl = variant?.image?.src || variant?.image?.url;
                  const imageAlt = variant?.image?.altText || title;
                  
                  // Calculate discounts
                  const discountAllocations = item.discountAllocations || [];
                  const itemDiscount = discountAllocations.reduce((sum, alloc) => {
                    const amount = parseFloat(alloc.allocatedAmount?.amount || alloc.amount?.amount || 0);
                    return sum + amount;
                  }, 0);
                  const hasDiscount = itemDiscount > 0;
                  const originalTotal = parseFloat(price || 0) * item.quantity;
                  const discountedTotal = originalTotal - itemDiscount;
                  
                  const discountTitle = discountAllocations[0]?.discountApplication?.title || 
                                       discountAllocations[0]?.title || 
                                       'Discount';

                  // Check if this item is a dessert and if it can be shipped
                  const productType = variant?.product?.productType?.toLowerCase();
                  const variantId = variant?.id;
                  const matchedProduct = products?.find(p =>
                    p.variantId === variantId ||
                    p.variants?.some(v => v.id === variantId)
                  );
                  const isDessert =
                    productType === 'desserts' ||
                    productType === 'dessert' ||
                    matchedProduct?.category === 'desserts' ||
                    matchedProduct?.productType === 'desserts';
                  // Check if this dessert can be shipped (has shipping in fulfillment methods)
                  const canShip = matchedProduct?.canShip === true;
                  const isNonShippableDessert = isDessert && !canShip;

                  return (
                    <Box key={item.id}>
                      <Box sx={{ display: 'flex', gap: 2 }}>
                        {/* Product Image */}
                        <Box
                          sx={{
                            width: 80,
                            height: 80,
                            flexShrink: 0,
                            borderRadius: 2,
                            overflow: 'hidden',
                            bgcolor: 'grey.100',
                            position: 'relative'
                          }}
                        >
                          {imageUrl ? (
                            <img
                              src={imageUrl}
                              alt={imageAlt}
                              style={{
                                width: '100%',
                                height: '100%',
                                objectFit: 'cover'
                              }}
                            />
                          ) : (
                            <Box sx={{ 
                              width: '100%', 
                              height: '100%', 
                              display: 'flex', 
                              alignItems: 'center', 
                              justifyContent: 'center',
                              bgcolor: 'grey.200'
                            }}>
                              <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '1.6rem' }}>
                                No image
                              </Typography>
                            </Box>
                          )}
                        </Box>

                        {/* Product Details */}
                        <Box sx={{ flex: 1 }}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <Box>
                              <Typography variant="body1" sx={{ fontWeight: 500, fontSize: '1.6rem' }}>
                                {title}
                              </Typography>
                              {isMixedCart && isNonShippableDessert && (
                                <Typography
                                  variant="body2"
                                  sx={{ color: 'info.main', fontWeight: 500, fontSize: '1.6rem' }}
                                >
                                  Pickup/Local Delivery Only
                                </Typography>
                              )}
                            </Box>
                            <Button 
                              color="primary" 
                              onClick={() => removeFromCart(item.id)} 
                              sx={{ padding: 0, minWidth: 'auto', ml: 1, fontSize: '1.6rem' }}
                            >
                              Remove
                            </Button>
                          </Box>
                          
                          {variantTitle && variantTitle !== 'Default Title' && (
                            <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5, fontSize: '1.6rem' }}>
                              {variantTitle}
                            </Typography>
                          )}

                          <Typography variant="body1" sx={{ mt: 0.5, fontSize: '1.6rem' }}>
                            ${parseFloat(price || 0).toFixed(2)}
                          </Typography>
                          
                          {hasDiscount && (
                            <Typography 
                              variant="body2" 
                              sx={{ color: 'success.main', fontWeight: 600, display: 'block', mt: 0.5, fontSize: '1.6rem' }}
                            >
                              {discountTitle}
                            </Typography>
                          )}

                          <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <CartQuantitySelector 
                              value={item.quantity} 
                              onIncrement={() => updateCartItem(item.id, item.quantity + 1)} 
                              onDecrement={() => updateCartItem(item.id, item.quantity - 1)} 
                            />
                            <Box sx={{ textAlign: 'right' }}>
                              <Typography variant="body1" sx={{ fontWeight: 'bold', color: hasDiscount ? 'success.main' : 'inherit' }}>
                                ${discountedTotal.toFixed(2)}
                              </Typography>
                              {hasDiscount && (
                                <Typography 
                                  variant="body2" 
                                  sx={{ textDecoration: 'line-through', color: 'text.disabled' }}
                                >
                                  ${originalTotal.toFixed(2)}
                                </Typography>
                              )}
                            </Box>
                          </Box>
                        </Box>
                      </Box>
                    </Box>
                  );
                })}
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
              
              {/* Summary - Inside scrollable area */}
              <Box sx={{ mt: 3, pt: 2, borderTop: 1, borderColor: 'divider' }}>
                <Stack spacing={1.5}>
                  {hasSavings ? (
                    <>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="body1" color="text.secondary">Subtotal</Typography>
                        <Typography variant="body1" color="text.secondary" sx={{ textDecoration: 'line-through' }}>
                          ${parseFloat(lineItemsSubtotal).toFixed(2)}
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="body1" color="success.main">You save</Typography>
                        <Typography variant="body1" color="success.main">-${totalSavings.toFixed(2)}</Typography>
                      </Box>
                    </>
                  ) : (
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body1" color="text.secondary">Subtotal</Typography>
                      <Typography variant="body1" color="text.secondary">${parseFloat(subtotal).toFixed(2)}</Typography>
                    </Box>
                  )}
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body1" sx={{ fontWeight: 'bold' }}>Total</Typography>
                    <Typography variant="body1" sx={{ fontWeight: 'bold' }}>${parseFloat(subtotal).toFixed(2)}</Typography>
                  </Box>
                </Stack>
              </Box>
            </Box>

            {/* Checkout Footer - Docked at bottom */}
            <Box sx={{ 
              borderTop: 1, 
              borderColor: 'divider',
              p: 2,
              bgcolor: 'white'
            }}>
              {/* Total with optional strikethrough subtotal */}
              <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <Box>
                  <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
                    <Typography sx={{ fontWeight: 'bold', fontSize: '1.8rem', color: 'success.main' }}>
                      ${parseFloat(subtotal).toFixed(2)}
                    </Typography>
                    {hasSavings && (
                      <Typography 
                        sx={{ 
                          textDecoration: 'line-through', 
                          color: 'text.disabled',
                          fontSize: '1.8rem'
                        }}
                      >
                        ${parseFloat(lineItemsSubtotal).toFixed(2)}
                      </Typography>
                    )}
                  </Box>
                  <Typography variant="body2" color="text.secondary" sx={{ fontSize: '1.6rem' }}>
                    Delivery or Shipping Calculated at Checkout
                  </Typography>
                </Box>
                <Button
                  variant="contained"
                  onClick={handleCheckout}
                >
                  Checkout
                </Button>
              </Box>
            </Box>
          </>
        )}
      </Box>
    </Drawer>
  );
}

export default CartDrawer;
