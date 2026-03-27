import React, { createContext, useContext, useEffect, useMemo } from 'react';
import { useMachine } from '@xstate/react';
import { catalogMachine } from '@/state/catalog/catalogMachine';
import { useShopify } from '@/contexts/commerce/ShopifyContext_GraphQL';

const CatalogContext = createContext({});

export const CatalogProvider = ({ children }) => {
    const [state, send] = useMachine(catalogMachine);
    const { products: shopifyProducts, loading: shopifyLoading } = useShopify();

    // Kick off catalog + locations fetch on mount
    useEffect(() => {
        send({ type: 'LOAD' });
    }, []);

    // When Shopify products arrive, push them into the machine
    useEffect(() => {
        if (!shopifyLoading && shopifyProducts.length > 0) {
            send({ type: 'SHOPIFY_PRODUCTS_CHANGED', shopifyProducts });
        }
    }, [shopifyProducts, shopifyLoading]);

    // Listen for location changes (localStorage + custom event)
    useEffect(() => {
        const slug = localStorage.getItem('selectedLocation');
        if (slug) send({ type: 'LOCATION_CHANGED', locationSlug: slug });

        const handler = (e) => {
            send({ type: 'LOCATION_CHANGED', locationSlug: e.detail.locationId });
        };
        window.addEventListener('locationChanged', handler);
        return () => window.removeEventListener('locationChanged', handler);
    }, []);

    const value = useMemo(() => ({
        catalog: state.context.catalog,
        subcategories: state.context.subcategories,
        collectiblesSubcategories: state.context.collectiblesSubcategories,
        shopifyGidLookup: state.context.shopifyGidLookup,
        mergedProductOrder: state.context.mergedProductOrder,
        locationFilteredProducts: state.context.locationFilteredProducts,
        storeLocations: state.context.storeLocations,
        selectedLocation: state.context.selectedLocation,
        error: state.context.error,
        lastRefreshedAt: state.context.lastRefreshedAt,
        isLoading: state.matches('loading'),
        isBuilding: state.matches('building'),
        isReady: state.matches('ready'),
        isError: state.matches('error'),
        refresh: () => send({ type: 'REFRESH' }),
        retry: () => send({ type: 'RETRY' }),
    }), [state]);

    return (
        <CatalogContext.Provider value={value}>
            {children}
        </CatalogContext.Provider>
    );
};

export const useCatalog = () => useContext(CatalogContext);
