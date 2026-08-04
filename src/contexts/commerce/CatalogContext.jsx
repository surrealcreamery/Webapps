import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useMachine } from '@xstate/react';
import { catalogMachine } from '@/state/catalog/catalogMachine';
import { filterTestItems } from '@/state/catalog/catalogUtils';

const CatalogContext = createContext({});

export const CatalogProvider = ({ children }) => {
    const [state, send] = useMachine(catalogMachine);
    const [testModeEnabled, setTestModeEnabled] = useState(
        () => localStorage.getItem('testModeEnabled') === 'true'
    );

    // Kick off catalog + locations fetch on mount
    useEffect(() => {
        send({ type: 'LOAD' });
    }, []);

    // Listen for location changes (localStorage + custom event)
    useEffect(() => {
        const slug = localStorage.getItem('selectedLocation');
        if (slug) send({ type: 'LOCATION_CHANGED', locationSlug: slug });

        const handler = (e) => {
            const id = e.detail?.locationId || localStorage.getItem('selectedLocation');
            if (id) send({ type: 'LOCATION_CHANGED', locationSlug: id });
        };
        window.addEventListener('locationChanged', handler);
        return () => window.removeEventListener('locationChanged', handler);
    }, []);

    // Listen for test mode toggle (custom event from commerceLayout)
    useEffect(() => {
        const handler = () => {
            setTestModeEnabled(localStorage.getItem('testModeEnabled') === 'true');
        };
        window.addEventListener('testModeChanged', handler);
        return () => window.removeEventListener('testModeChanged', handler);
    }, []);

    const value = useMemo(() => {
        const allProducts = filterTestItems(state.context.allProducts || [], testModeEnabled);
        const locationFilteredProducts = filterTestItems(state.context.locationFilteredProducts || [], testModeEnabled);

        // Filter test items from subcategory containers/products
        // Build a set of test item SKUs from raw catalog data
        const testItemSkus = new Set(
            (state.context.catalog?.products || [])
                .filter(p => p.testItem)
                .map(p => p.sku)
        );
        const filterSubcategories = (subcats) => {
            if (!subcats?.length) return subcats;
            return subcats.map(sub => {
                const containers = sub.containers.filter(c => {
                    const sku = c.product?.sku || c.product?.id;
                    return !testItemSkus.has(sku);
                });
                return { ...sub, containers, products: containers.map(c => c.product) };
            }).filter(sub => sub.containers.length > 0);
        };

        const isTestEnv = typeof window !== 'undefined' && (
            window.location.hostname === 'localhost' ||
            window.location.hostname === '127.0.0.1' ||
            window.location.hostname.startsWith('beta')
        );
        const showTestItems = isTestEnv && testModeEnabled;

        const subcategories = showTestItems
            ? state.context.subcategories
            : filterSubcategories(state.context.subcategories);
        const collectiblesSubcategories = showTestItems
            ? state.context.collectiblesSubcategories
            : filterSubcategories(state.context.collectiblesSubcategories);

        return {
            catalog: state.context.catalog,
            categories: state.context.catalog?.categories || [],
            categoryHelpers: state.context.categoryHelpers,
            allProducts,
            subcategories,
            collectiblesSubcategories,
            mergedProductOrder: state.context.mergedProductOrder,
            locationFilteredProducts,
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
        };
    }, [state, testModeEnabled]);

    return (
        <CatalogContext.Provider value={value}>
            {children}
        </CatalogContext.Provider>
    );
};

export const useCatalog = () => useContext(CatalogContext);
