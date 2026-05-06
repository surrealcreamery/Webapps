import { setup, assign, fromPromise } from 'xstate';
import { fetchPublishedCatalog } from '@/services/catalogService';
import {
    buildAllProducts,
    buildCategoryHelpers,
    getMergedProductOrder,
    filterProductsByLocation,
    buildSubcategoriesFromCatalog,
} from './catalogUtils';

const LOCATIONS_URL = 'https://data.surrealcreamery.com/locations.json';

const initialContext = {
    catalog: null,
    storeLocations: [],
    allProducts: [],
    subcategories: [],
    collectiblesSubcategories: [],
    mergedProductOrder: [],
    locationFilteredProducts: [],
    categoryHelpers: {},
    selectedLocation: typeof window !== 'undefined'
        ? localStorage.getItem('selectedLocation') || null
        : null,
    error: null,
    lastRefreshedAt: null,
};

export const catalogMachine = setup({
    actors: {
        fetchCatalogData: fromPromise(async () => {
            const [catalog, locationsRes] = await Promise.all([
                fetchPublishedCatalog(),
                fetch(LOCATIONS_URL).then(r => r.json()).catch(() => []),
            ]);
            if (!catalog) throw new Error('Failed to fetch catalog');
            const storeLocations = Array.isArray(locationsRes) ? locationsRes : [];
            return { catalog, storeLocations };
        }),
    },
    actions: {
        assignFetchedData: assign(({ event }) => ({
            catalog: event.output.catalog,
            storeLocations: event.output.storeLocations,
            lastRefreshedAt: Date.now(),
        })),
        assignError: assign(({ event }) => ({
            error: event.error?.message || 'Unknown error',
        })),
        assignLocation: assign(({ event }) => ({
            selectedLocation: event.locationSlug,
        })),
        deriveAllData: assign(({ context }) => {
            const { catalog, storeLocations, selectedLocation } = context;
            const allProducts = buildAllProducts(catalog);
            const categoryHelpers = buildCategoryHelpers(catalog?.categories);
            const mergedProductOrder = getMergedProductOrder(catalog?.categories);

            // Sort allProducts by mergedProductOrder (SKU-based), preserving natural order for unordered products
            if (mergedProductOrder.length > 0) {
                const orderMap = new Map(mergedProductOrder.map((sku, idx) => [sku.toUpperCase(), idx]));
                allProducts.sort((a, b) => {
                    const aidx = orderMap.get((a.sku || '').toUpperCase()) ?? Infinity;
                    const bidx = orderMap.get((b.sku || '').toUpperCase()) ?? Infinity;
                    if (aidx !== Infinity && bidx !== Infinity) return aidx - bidx;
                    if (aidx !== Infinity) return -1;
                    if (bidx !== Infinity) return 1;
                    return 0;
                });
            }

            const locationFilteredProducts = filterProductsByLocation(
                allProducts, catalog, storeLocations, selectedLocation
            );
            const subcategories = buildSubcategoriesFromCatalog(
                catalog, {}, selectedLocation, 'desserts', storeLocations
            );
            const collectiblesSubcategories = buildSubcategoriesFromCatalog(
                catalog, {}, selectedLocation, 'collectibles', storeLocations
            );
            return { allProducts, categoryHelpers, mergedProductOrder, locationFilteredProducts, subcategories, collectiblesSubcategories };
        }),
    },
    guards: {
        hasCatalog: ({ context }) => !!context.catalog,
    },
}).createMachine({
    id: 'catalog',
    initial: 'idle',
    context: initialContext,

    // Global events — accepted in ANY state so they're never dropped
    on: {
        LOCATION_CHANGED: {
            actions: 'assignLocation',
        },
    },

    states: {
        idle: {
            on: { LOAD: 'loading' },
        },
        loading: {
            invoke: {
                src: 'fetchCatalogData',
                onDone: {
                    target: 'building',
                    actions: 'assignFetchedData',
                },
                onError: {
                    target: 'error',
                    actions: 'assignError',
                },
            },
        },
        building: {
            entry: 'deriveAllData',
            always: 'ready',
        },
        ready: {
            on: {
                LOCATION_CHANGED: {
                    target: 'building',
                    actions: 'assignLocation',
                },
                REFRESH: 'loading',
            },
        },
        error: {
            on: {
                RETRY: 'loading',
            },
        },
    },
});
