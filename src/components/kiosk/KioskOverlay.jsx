import React, { createContext, useCallback, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '@/hooks/useCart';
import { useKioskMode } from '@/hooks/useKioskMode';
import { KioskCodeDialog } from './KioskCodeDialog';
import { LayoutContext } from '@/contexts/commerce/CommerceLayoutContext';
import { useCatalog } from '@/contexts/commerce/CatalogContext';

export const KioskContext = createContext(null);

export function KioskOverlay({ children }) {
    const localCart = useCart();
    const navigate = useNavigate();
    const { sendToCommerce } = useContext(LayoutContext);
    const { allProducts } = useCatalog();

    const onViewProduct = useCallback((productId) => {
        sendToCommerce({ type: 'CLOSE_CART' });
        navigate(`/kiosk/product/${productId}`);
    }, [navigate, sendToCommerce]);

    const onCloseProduct = useCallback(() => {
        sendToCommerce({ type: 'CLOSE_PRODUCT' });
        navigate('/kiosk', { replace: true });
    }, [sendToCommerce, navigate]);

    const kiosk = useKioskMode({
        enabled: true,
        localCart,
        onViewProduct,
        onCloseProduct,
        sendToCommerce,
        allProducts,
    });

    return (
        <KioskContext.Provider value={{ ...kiosk, localCart }}>
            {children}
            <KioskCodeDialog
                open={kiosk.showKioskDialog}
                onClose={() => { kiosk.setShowKioskDialog(false); kiosk.setKioskCodeError(''); kiosk.setKioskCodeInput(''); }}
                codeInput={kiosk.kioskCodeInput}
                onCodeInputChange={(val) => { kiosk.setKioskCodeInput(val); kiosk.setKioskCodeError(''); }}
                loading={kiosk.kioskCodeLoading}
                error={kiosk.kioskCodeError}
                onSubmit={kiosk.handleKioskCodeSubmit}
            />
        </KioskContext.Provider>
    );
}
