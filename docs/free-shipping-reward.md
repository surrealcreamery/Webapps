# Free Shipping Reward

The free shipping reward was a progress bar shown in the cart drawer and added-to-cart view that tracked how close the customer was to unlocking free shipping (e.g., "Free Shipping for orders over $75").

It was removed because it was hardcoded and not connected to any actual Shopify shipping rule.

## How to Re-enable

### 1. Add the config constant

Add this to both `src/pages/Commerce.jsx` and `src/components/commerce/CartDrawer.jsx`:

```jsx
const REWARDS_CONFIG = {
    freeShipping: {
        threshold: 75, // dollar amount for free shipping
        icon: 'shipping',
        title: 'Free Shipping',
        unlockedMessage: 'Free shipping unlocked!'
    }
};
```

### 2. Add the progress calculation

In both files, add this `useMemo` near the other discount calculations:

```jsx
const shippingProgress = useMemo(() => {
    const threshold = REWARDS_CONFIG.freeShipping.threshold;
    const progress = Math.min((cartTotal / threshold) * 100, 100);
    const remaining = Math.max(threshold - cartTotal, 0);
    const unlocked = cartTotal >= threshold;
    return { progress, remaining, unlocked, threshold };
}, [cartTotal]);
```

### 3. Add the discount entry to the `allDiscounts` array

In the rewards IIFE (search for `const allDiscounts = []`), push the shipping entry:

```jsx
allDiscounts.push({
    id: 'free-shipping',
    type: 'shipping',
    title: `Free Shipping for orders over $${REWARDS_CONFIG.freeShipping.threshold}`,
    shortTitle: 'Free Shipping',
    threshold: REWARDS_CONFIG.freeShipping.threshold,
    current: cartTotal,
    progress: shippingProgress.progress,
    unlocked: shippingProgress.unlocked,
    remaining: shippingProgress.remaining,
    priority: 3
});
```

### 4. Add the shipping icon rendering

Import the icon:
```jsx
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined';
```

In the discount rendering loop, add a case for `type === 'shipping'`:
```jsx
{discount.type === 'shipping' && (
    <LocalShippingOutlinedIcon sx={{
        fontSize: '1.6rem',
        color: discount.unlocked ? 'success.main' : 'text.secondary'
    }} />
)}
```

And update the progress bar condition to include shipping:
```jsx
{(discount.type === 'shipping' || discount.type === 'order') && (
```

### 5. Match to actual Shopify shipping rules

For this to be accurate, the `threshold` value should match your Shopify shipping rate configuration. You can either:
- Hardcode it (as above)
- Pull it from a Shopify metafield on the shop object
- Store it in the DynamoDB config table
