import { useState, useEffect, useRef, useCallback } from 'react';
import { useKioskWebSocket } from '@/hooks/useKioskWebSocket';

const TERMINAL_API_URL = 'https://oquxxk2q56me3ve7mk7nz2gav40apced.lambda-url.us-east-1.on.aws';

/**
 * Consolidates all kiosk-specific state and side effects.
 *
 * @param {object} options
 * @param {boolean} options.enabled - Whether kiosk mode is active
 * @param {object}  options.localCart - useCart() hook instance
 * @param {Function} options.onViewProduct - Callback when POS sends view_product
 * @param {Function} [options.sendToCommerce] - Commerce state machine dispatcher
 * @param {object[]} [options.allProducts] - Full product list for SKU lookup
 */
export function useKioskMode({ enabled, localCart, onViewProduct, onCloseProduct, sendToCommerce, allProducts }) {
    // ── Terminal state ──
    const [kioskTerminal, setKioskTerminal] = useState(() => {
        try { const s = localStorage.getItem('kioskTerminal'); return s ? JSON.parse(s) : null; } catch { return null; }
    });
    const kioskTerminalRef = useRef(kioskTerminal);
    kioskTerminalRef.current = kioskTerminal;

    const [showKioskDialog, setShowKioskDialog] = useState(() => !kioskTerminal);
    const [kioskCodeInput, setKioskCodeInput] = useState('');
    const [kioskCodeLoading, setKioskCodeLoading] = useState(false);
    const [kioskCodeError, setKioskCodeError] = useState('');

    // Persist kiosk terminal info
    useEffect(() => {
        if (!enabled) return;
        if (kioskTerminal) {
            localStorage.setItem('kioskTerminal', JSON.stringify(kioskTerminal));
            // Auto-set store location from terminal
            if (kioskTerminal.locationId) {
                localStorage.setItem('selectedLocation', kioskTerminal.locationId);
                // Dispatch storage event so header updates (same-window setItem doesn't trigger storage event)
                window.dispatchEvent(new StorageEvent('storage', { key: 'selectedLocation', newValue: kioskTerminal.locationId }));
            }
        } else {
            localStorage.removeItem('kioskTerminal');
            localStorage.removeItem('surreal_kiosk_device_id');
        }
    }, [kioskTerminal, enabled]);

    // Refresh pairing info on mount (kioskTerminal from localStorage may be stale)
    useEffect(() => {
        if (!enabled || !kioskTerminal?.kioskDeviceId) return;
        const refreshPairing = async () => {
            try {
                const res = await fetch(TERMINAL_API_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'getKioskDevice', deviceId: kioskTerminal.kioskDeviceId }),
                });
                const data = await res.json();
                const result = typeof data.body === 'string' ? JSON.parse(data.body) : data;
                if (result.error) { console.warn('[Kiosk] refreshPairing error:', result.error); return; }
                // Update kioskTerminal with fresh pairing/location info
                setKioskTerminal(prev => {
                    const updated = {
                        ...prev,
                        pairedDevice: result.pairedDevice || null,
                        locationId: result.locationId || prev?.locationId,
                        locationName: result.locationName || prev?.locationName,
                        ...(result.taxRate != null ? { taxRate: result.taxRate } : {}),
                    };
                    // Only update if something changed
                    if (JSON.stringify(prev) === JSON.stringify(updated)) return prev;
                    console.log('[Kiosk] Refreshed pairing info:', updated.pairedDevice ? 'paired' : 'unpaired');
                    return updated;
                });
            } catch (err) {
                console.warn('[Kiosk] Failed to refresh pairing:', err.message);
            }
        };
        refreshPairing();
    }, [enabled]); // Only on mount — kioskTerminal.kioskDeviceId is stable

    // ── Disable pinch-to-zoom (iOS ignores viewport meta) ──
    useEffect(() => {
        if (!enabled) return;
        const preventZoom = (e) => { if (e.touches?.length > 1) e.preventDefault(); };
        const preventGesture = (e) => e.preventDefault();
        document.addEventListener('touchmove', preventZoom, { passive: false });
        document.addEventListener('gesturestart', preventGesture);
        document.addEventListener('gesturechange', preventGesture);
        return () => {
            document.removeEventListener('touchmove', preventZoom);
            document.removeEventListener('gesturestart', preventGesture);
            document.removeEventListener('gesturechange', preventGesture);
        };
    }, [enabled]);

    // ── Wake Lock ──
    const kioskWakeLockRef = useRef(null);
    useEffect(() => {
        if (!enabled) return;
        let isMounted = true;
        const requestWakeLock = async () => {
            if (!('wakeLock' in navigator)) return;
            try {
                if (kioskWakeLockRef.current) await kioskWakeLockRef.current.release();
                kioskWakeLockRef.current = await navigator.wakeLock.request('screen');
                console.log('[Kiosk] Wake lock acquired');
                kioskWakeLockRef.current.addEventListener('release', () => {
                    console.log('[Kiosk] Wake lock released');
                });
            } catch (err) {
                console.warn('[Kiosk] Wake lock failed:', err.message);
            }
        };
        requestWakeLock();
        const handleVisibility = () => {
            if (isMounted && document.visibilityState === 'visible') requestWakeLock();
        };
        document.addEventListener('visibilitychange', handleVisibility);
        const interval = setInterval(() => {
            if (isMounted && (!kioskWakeLockRef.current || kioskWakeLockRef.current.released)) requestWakeLock();
        }, 30000);
        return () => {
            isMounted = false;
            kioskWakeLockRef.current?.release().catch(() => {});
            kioskWakeLockRef.current = null;
            document.removeEventListener('visibilitychange', handleVisibility);
            clearInterval(interval);
        };
    }, [enabled]);

    // ── WebSocket integration ──
    const isRemoteCartUpdateRef = useRef(false);
    const [kioskRemoteCheckout, setKioskRemoteCheckout] = useState(null);
    const [kioskCancelSignal, setKioskCancelSignal] = useState(0); // bumped when POS cancels our checkout
    const kioskWsDeviceId = kioskTerminal?.kioskDeviceId || localStorage.getItem('surreal_kiosk_device_id');
    const isKioskPaired = !!kioskTerminal?.pairedDevice;
    const kioskSendForwardRef = useRef(null);
    const allProductsRef = useRef(allProducts);
    allProductsRef.current = allProducts;
    const sendToCommerceRef = useRef(sendToCommerce);
    sendToCommerceRef.current = sendToCommerce;
    const onViewProductRef = useRef(onViewProduct);
    onViewProductRef.current = onViewProduct;
    const onCloseProductRef = useRef(onCloseProduct);
    onCloseProductRef.current = onCloseProduct;

    const { isConnected: kioskWsConnected, sendForward: kioskSendForward } = useKioskWebSocket({
        enabled: enabled && !!kioskTerminal && !!kioskWsDeviceId,
        deviceId: kioskWsDeviceId,
        onViewProduct: useCallback((payload) => {
            console.log('[Kiosk] view_product from POS:', payload);
            const products = allProductsRef.current || [];
            const skuUpper = (payload.sku || '').toUpperCase();
            const nameLower = (payload.name || '').toLowerCase();
            const product = products.find(p =>
                (p.sku && p.sku.toUpperCase() === skuUpper) ||
                p.variants?.some(v => v.sku && v.sku.toUpperCase() === skuUpper)
            ) || products.find(p =>
                p.title?.toLowerCase() === nameLower ||
                p.name?.toLowerCase() === nameLower
            );
            if (product) {
                console.log('[Kiosk] Found product:', product.id, product.title);
                onViewProductRef.current?.(product.id);
            }
        }, []),
        onCloseProduct: useCallback(() => {
            console.log('[Kiosk] close_product from POS');
            onCloseProductRef.current?.();
        }, []),
        onCartSync: useCallback((payload) => {
            console.log('[Kiosk] cart_sync from POS:', payload.items?.length, 'items');
            isRemoteCartUpdateRef.current = true;
            // For kiosk-in-Commerce, we sync the local cart
            if (localCart) {
                localCart.clearCart();
                (payload.items || []).forEach(item => {
                    localCart.addToCart(
                        { id: item.sku, name: item.name, imageUrl: item.image },
                        { id: item.variantSku, sku: item.variantSku, title: item.variantName, price: item.unitPrice },
                        item.quantity,
                        item.modifiers || []
                    );
                });
            }
            if (payload.items?.length > 0) {
                sendToCommerceRef.current?.({ type: 'OPEN_CART' });
            }
        }, [localCart]),
        onCheckoutStatus: useCallback((payload) => {
            console.log('[Kiosk] checkout_status from POS:', payload.status);
            if (payload.status === 'completed' || payload.status === 'canceled' || payload.status === 'failed') {
                setKioskRemoteCheckout(null);
                // Signal CartDrawer to stop its own terminal polling if kiosk initiated the checkout
                if (payload.status === 'canceled') {
                    setKioskCancelSignal(v => v + 1);
                }
            } else {
                setKioskRemoteCheckout(payload);
                // Open cart drawer so the checkout overlay is visible
                sendToCommerceRef.current?.({ type: 'OPEN_CART' });
            }
        }, []),
        onCartRequest: useCallback(() => {
            // Respond with current cart state
            const items = localCart?.cart || [];
            const kioskItems = items.map(item => ({
                sku: item.sku || item.productId,
                variantSku: item.variantSku || item.variantId,
                name: item.name || '',
                variantName: item.variantName || '',
                unitPrice: item.unitPrice || 0,
                quantity: item.quantity || 1,
                modifiers: item.modifiers || [],
                image: item.image || '',
            }));
            kioskSendForwardRef.current?.('cart_sync', { items: kioskItems });
        }, [localCart]),
        onLocationSync: useCallback((payload) => {
            console.log('[Kiosk] location_sync from POS:', payload.locationId);
            if (payload.locationId) {
                localStorage.setItem('selectedLocation', payload.locationId);
                // Force header to re-read — dispatch storage event for same-window listeners
                window.dispatchEvent(new StorageEvent('storage', { key: 'selectedLocation', newValue: payload.locationId }));
            }
        }, []),
    });
    kioskSendForwardRef.current = kioskSendForward;

    // Broadcast local cart changes to paired POS
    useEffect(() => {
        if (!enabled || !isKioskPaired || !kioskTerminal) return;
        if (isRemoteCartUpdateRef.current) {
            isRemoteCartUpdateRef.current = false;
            return;
        }
        const items = localCart?.cart || [];
        const kioskItems = items.map(item => ({
            sku: item.sku || item.productId,
            variantSku: item.variantSku || item.variantId,
            name: item.name || '',
            variantName: item.variantName || '',
            unitPrice: item.unitPrice || 0,
            quantity: item.quantity || 1,
            modifiers: item.modifiers || [],
            image: item.image || '',
        }));
        console.log('[Kiosk] Broadcasting cart_sync:', kioskItems.length, 'items, paired:', isKioskPaired, 'wsConnected:', kioskWsConnected);
        kioskSendForward('cart_sync', { items: kioskItems });
    }, [localCart?.cart, isKioskPaired, kioskTerminal, kioskSendForward, enabled]);

    // ── Code entry handler ──
    const handleKioskCodeSubmit = useCallback(async () => {
        if (!kioskCodeInput.trim()) return;
        setKioskCodeLoading(true);
        setKioskCodeError('');
        try {
            const clientUUID = localStorage.getItem('surreal_client_uuid')
                || crypto.randomUUID?.()
                || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
            if (!localStorage.getItem('surreal_client_uuid')) {
                localStorage.setItem('surreal_client_uuid', clientUUID);
            }
            const res = await fetch(TERMINAL_API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'resolveKioskCode',
                    kioskCode: kioskCodeInput.trim(),
                    clientUUID,
                    userAgent: navigator.userAgent,
                }),
            });
            const data = await res.json();
            const result = typeof data.body === 'string' ? JSON.parse(data.body) : data;
            if (result.error) {
                setKioskCodeError(result.error);
                return;
            }
            setKioskTerminal({
                deviceId: result.deviceId,
                locationId: result.locationId,
                terminalName: result.terminalName,
                locationName: result.locationName,
                kioskDeviceId: result.kioskDeviceId,
                pairedDevice: result.pairedDevice || null,
                ...(result.taxRate != null ? { taxRate: result.taxRate } : {}),
            });
            if (result.kioskDeviceId) {
                localStorage.setItem('surreal_kiosk_device_id', result.kioskDeviceId);
            }
            setShowKioskDialog(false);
            setKioskCodeInput('');
        } catch (err) {
            console.error('[Kiosk] Code validation error:', err);
            setKioskCodeError('Failed to validate code. Check your connection and try again.');
        } finally {
            setKioskCodeLoading(false);
        }
    }, [kioskCodeInput]);

    // ── "kiosk" keyboard shortcut ──
    useEffect(() => {
        if (!enabled) return;
        let buffer = '';
        let timeout;
        const handleKeyDown = (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
            buffer += e.key.toLowerCase();
            clearTimeout(timeout);
            timeout = setTimeout(() => { buffer = ''; }, 1500);
            if (buffer.includes('kiosk')) {
                buffer = '';
                if (kioskTerminalRef.current) {
                    setKioskTerminal(null);
                    window.location.href = '/';
                } else {
                    setShowKioskDialog(true);
                    setKioskCodeInput('');
                    setKioskCodeError('');
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            clearTimeout(timeout);
        };
    }, [enabled]);

    return {
        kioskTerminal,
        showKioskDialog,
        setShowKioskDialog,
        kioskCodeInput,
        setKioskCodeInput,
        kioskCodeLoading,
        kioskCodeError,
        setKioskCodeError,
        handleKioskCodeSubmit,
        isKioskPaired,
        kioskWsConnected,
        kioskSendForward,
        kioskRemoteCheckout,
        kioskCancelSignal,
    };
}
