import { sortProductsByOrder } from '@/services/catalogService';

// Derive readable text color from a hex background color
// Returns 'white' for dark backgrounds, '#1a1a2e' for light backgrounds
export const getTextColorForBackground = (bgHex) => {
    if (!bgHex || !bgHex.startsWith('#')) return 'white';
    const hex = bgHex.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.5 ? '#1a1a2e' : 'white';
};

// Compute CSS gradient/background from item's color data
export const getItemBackground = (item) => {
    const bgColor = item?.backgroundColor || '#1a1a2e';
    const gradientDir = item?.gradientDirection;
    const startColor = item?.gradientStartColor || bgColor;
    const endColor = item?.gradientEndColor || bgColor;
    if (!gradientDir) return bgColor;
    if (gradientDir.startsWith('linear:') || gradientDir.startsWith('radial:')) {
        const parts = gradientDir.split(':');
        const type = parts[0];
        if (type === 'radial') {
            const position = parts[1]?.replace('-', ' ') || 'center';
            return `radial-gradient(circle at ${position}, ${startColor} 0%, ${endColor} 100%)`;
        }
        const startPos = parts[1] || 'top-left';
        const endPos = parts[2] || 'bottom-right';
        const posToCoord = {
            'top-left': { x: 0, y: 0 }, 'top': { x: 1, y: 0 }, 'top-right': { x: 2, y: 0 },
            'left': { x: 0, y: 1 }, 'center': { x: 1, y: 1 }, 'right': { x: 2, y: 1 },
            'bottom-left': { x: 0, y: 2 }, 'bottom': { x: 1, y: 2 }, 'bottom-right': { x: 2, y: 2 },
        };
        const start = posToCoord[startPos] || posToCoord['top-left'];
        const end = posToCoord[endPos] || posToCoord['bottom-right'];
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const angle = Math.round(Math.atan2(dx, -dy) * (180 / Math.PI) + 360) % 360;
        return `linear-gradient(${angle}deg, ${startColor} 0%, ${endColor} 100%)`;
    }
    const legacyAngles = {
        'to-bottom-right': '135deg', 'to-bottom-left': '225deg', 'to-bottom': '180deg',
        'to-right': '90deg', 'to-top-right': '45deg', 'to-top-left': '315deg',
        'to-top': '0deg', 'to-left': '270deg',
    };
    const angle = legacyAngles[gradientDir];
    return angle ? `linear-gradient(${angle}, ${startColor} 0%, ${endColor} 100%)` : bgColor;
};

// Resolve display modifiers from catalog data (modifier/option IDs → full details)
export const resolveDisplayModifiers = (displayModifiers = [], allModifiers = []) => {
    if (!displayModifiers.length || !allModifiers.length) return [];
    const modMap = new Map(allModifiers.map(m => [m.modifierId, m]));
    return displayModifiers.map(dm => {
        const mod = modMap.get(dm.modifierId);
        if (!mod) return null;
        const opts = (mod.options || [])
            .filter(o => dm.selectedOptionIds?.includes(o.optionId))
            .sort((a, b) => (a.position || 0) - (b.position || 0));
        return opts.length ? {
            modifierId: dm.modifierId,
            name: mod.name,
            options: opts.map(o => ({ optionId: o.optionId, name: o.name, price: o.price, image: o.image })),
        } : null;
    }).filter(Boolean);
};

// Get all descendant category IDs for a given parent
export const getDescendantIds = (parentId, categories) => {
    const ids = new Set([parentId]);
    const findChildren = (pid) => {
        categories.filter(c => c.parentId === pid).forEach(child => {
            ids.add(child.id);
            findChildren(child.id);
        });
    };
    findChildren(parentId);
    return ids;
};

// Build SKU → Shopify variant GID lookup from Shopify products
export const buildShopifyGidLookup = (shopifyProducts) => {
    const map = {};
    for (const sp of shopifyProducts) {
        for (const sv of sp.variants || []) {
            if (sv.sku) map[sv.sku.toUpperCase()] = { variantGid: sv.id, productGid: sp.shopifyId, productHandle: sp.id };
        }
    }
    return map;
};

// Build catalog-first variant objects with Shopify GID resolution
export const buildCatalogFirstVariants = (catalogVariants, shopifyGidLookup) => {
    return (catalogVariants || []).map(cv => {
        const skuUpper = cv.sku?.toUpperCase();
        const gidFallback = skuUpper ? shopifyGidLookup[skuUpper] : null;
        const _locSlug = typeof window !== 'undefined' ? localStorage.getItem('selectedLocation') : null;
        const _locPrice = _locSlug && cv.locationPrices?.[_locSlug];
        return {
            sku: cv.sku,
            name: cv.name,
            price: _locPrice != null ? _locPrice : cv.price,
            compareAtPrice: cv.compareAtPrice,
            optionValues: cv.optionValues,
            isDefault: cv.isDefault,
            catalogImage: cv.catalogImage,
            locationPrices: cv.locationPrices || null,
            shopifyVariantGid: cv.platformIds?.shopify || gidFallback?.variantGid || null,
            id: cv.platformIds?.shopify || gidFallback?.variantGid || cv.sku,
            availableForSale: cv.inventory?.inStock !== false,
            inventory: cv.inventory || {},
        };
    });
};

// Build aggregate product inventory from catalog variants
export const buildProductInventory = (catalogVariants) => {
    const variants = catalogVariants || [];
    const anyTracked = variants.some(v => v.inventory?.trackInventory);
    const totalQty = variants.reduce((sum, v) => sum + (v.inventory?.totalQuantity || 0), 0);

    // Aggregate byLocation across all variants
    const locationMap = {};
    for (const v of variants) {
        for (const loc of (v.inventory?.byLocation || [])) {
            if (!locationMap[loc.locationId]) locationMap[loc.locationId] = { locationId: loc.locationId, quantity: 0 };
            locationMap[loc.locationId].quantity += (loc.quantity || 0);
        }
    }

    return {
        trackInventory: anyTracked,
        totalQuantity: totalQty,
        inStock: !anyTracked || totalQty > 0,
        byLocation: Object.values(locationMap),
    };
};

// Get merged productOrder from ALL categories in catalog
export const getMergedProductOrder = (categories) => {
    if (!categories?.length) return [];
    const allOrdered = [];
    for (const category of categories) {
        if (category.productOrder?.length) {
            for (const sku of category.productOrder) {
                if (!allOrdered.includes(sku)) {
                    allOrdered.push(sku);
                }
            }
        }
    }
    return allOrdered;
};

// Filter Shopify products by location availability (catalog + Shopify checks)
export const filterProductsByLocation = (shopifyProducts, catalog, storeLocations, locationSlug) => {
    if (!locationSlug || storeLocations.length === 0) return shopifyProducts;
    const store = storeLocations.find(loc => loc.id === locationSlug);
    if (!store?.shopifyLocationId) return shopifyProducts;
    const shopifyGid = `gid://shopify/Location/${store.shopifyLocationId}`;

    // Build catalog locationAvailability lookup by product name (lowercase)
    const catalogLocAvail = {};
    if (catalog?.products) {
        for (const cp of catalog.products) {
            if (cp.locationAvailability && cp.name) {
                catalogLocAvail[cp.name.toLowerCase()] = cp.locationAvailability;
            }
        }
    }

    return shopifyProducts.filter(product => {
        // Check catalog locationAvailability (master location toggle)
        const locAvail = catalogLocAvail[(product.name || product.title || '').toLowerCase()];
        if (locAvail && locAvail[locationSlug] === false) return false;
        // Check Shopify store availability
        if (product.storeAvailableLocationIds?.length &&
            !product.storeAvailableLocationIds.includes(shopifyGid)) return false;
        return true;
    });
};

// Build subcategories from catalog data (catalog-first approach)
// rootName: e.g. 'desserts', 'collectibles' — matches category name or slug (case-insensitive)
// storeLocations: array of location objects with { id, type } — used for warehouse-based visibility
export const buildSubcategoriesFromCatalog = (catalog, shopifyGidLookup, locationSlug, rootName = 'desserts', storeLocations = []) => {
    if (!catalog?.categories?.length || !catalog?.products?.length) return [];

    const rootNameLower = rootName.toLowerCase();

    // Find the root category by slug or name
    const rootCategory = catalog.categories.find(c =>
        c.slug === rootNameLower || c.name?.toLowerCase() === rootNameLower
    );
    if (!rootCategory) {
        console.log(`📦 [Catalog] No "${rootName}" root category found`);
        return [];
    }

    // Get all subcategories under the root
    const subcategories = catalog.categories
        .filter(c => c.parentId === rootCategory.id)
        .sort((a, b) => (a.position || 0) - (b.position || 0));

    console.log(`📦 [Catalog:${rootName}] Found subcategories:`, subcategories.map(s => s.name));

    return subcategories.map(subcat => {
        // Find catalog products in this category OR any descendant category
        const subcatIds = getDescendantIds(subcat.id, catalog.categories);
        const catalogProductsInCategory = catalog.products.filter(p =>
            p.categoryIds?.some(catId => subcatIds.has(catId))
        );

        // Sort by productOrder — merge from children if parent has none
        let productOrder = subcat.productOrder || [];
        if (productOrder.length === 0) {
            const childCategories = catalog.categories
                .filter(c => c.parentId === subcat.id)
                .sort((a, b) => (a.position || 0) - (b.position || 0));
            productOrder = childCategories.flatMap(child => child.productOrder || []);
        }
        const sortedCatalogProducts = productOrder.length > 0
            ? sortProductsByOrder(catalogProductsInCategory, productOrder, catalog.products)
            : catalogProductsInCategory;

        // Get Level 3 child categories for this subcategory
        const childCategories = catalog.categories
            .filter(c => c.parentId === subcat.id)
            .sort((a, b) => (a.position || 0) - (b.position || 0));

        // Build a map of child category ID → child category for tagging products
        const childCategoryMap = new Map();
        childCategories.forEach(child => {
            const childDescendants = getDescendantIds(child.id, catalog.categories);
            childDescendants.forEach(id => childCategoryMap.set(id, child));
        });

        // Warehouse IDs for collectibles visibility check
        const warehouseIds = storeLocations.filter(l => l.type === 'Warehouse').map(l => l.id);
        const isCollectibles = rootNameLower === 'collectibles';

        // Build containers from catalog products (catalog-first: no Shopify product required)
        const containers = sortedCatalogProducts.filter(catalogProduct => {
            if (isCollectibles && warehouseIds.length > 0) {
                // Collectibles: visible if ANY warehouse has it visible
                const anyWarehouseVisible = warehouseIds.some(wId => catalogProduct.locationAvailability?.[wId] !== false);
                if (!anyWarehouseVisible) return false;
            } else {
                // Desserts/default: filter out products hidden at selected location
                if (locationSlug && catalogProduct.locationAvailability?.[locationSlug] === false) return false;
            }
            return true;
        }).map(catalogProduct => {
            // Determine which Level 3 child category this product belongs to
            let subSubcategory = null;
            if (childCategories.length > 0) {
                for (const catId of (catalogProduct.categoryIds || [])) {
                    const matched = childCategoryMap.get(catId);
                    if (matched) { subSubcategory = matched; break; }
                }
            }

            // Get image and colors from catalog masterImage
            const masterImage = catalogProduct.masterImage;
            const firstImage = catalogProduct.images?.[0];
            const s3Image = masterImage?.url || firstImage?.url || null;
            const backgroundColor = masterImage?.backgroundColor || firstImage?.backgroundColor || null;
            const textColor = masterImage?.textColor || firstImage?.textColor || null;
            const gradientDirection = masterImage?.gradientDirection || firstImage?.gradientDirection || null;
            const gradientStartColor = masterImage?.gradientStartColor || firstImage?.gradientStartColor || null;
            const gradientEndColor = masterImage?.gradientEndColor || firstImage?.gradientEndColor || null;

            // Build variants directly from catalog data
            const catalogVariants = buildCatalogFirstVariants(catalogProduct.variants, shopifyGidLookup);

            // Product-level Shopify GID for cart
            const firstSku = catalogProduct.variants?.[0]?.sku?.toUpperCase();
            const productShopifyGid = catalogProduct.platformIds?.shopify || shopifyGidLookup[firstSku]?.productGid || null;

            // Skip products with NO checkout capability (no Shopify GIDs anywhere)
            const hasAnyGid = productShopifyGid || catalogVariants.some(v => v.shopifyVariantGid);
            if (!hasAnyGid) {
                console.log('📦 [Catalog] No Shopify GIDs for:', catalogProduct.name, '(skipping)');
                return null;
            }

            // Build catalog-first product object
            const productObj = {
                id: shopifyGidLookup[firstSku]?.productHandle || catalogProduct.productId || catalogProduct.name,
                shopifyId: productShopifyGid,
                platformIds: catalogProduct.platformIds,
                name: catalogProduct.name,
                description: catalogProduct.description || '',
                category: catalogProduct.categoryIds?.[0] || null,
                variants: catalogVariants,
                imageUrl: s3Image,
                fulfillmentMethods: catalogProduct.fulfillmentMethods || [],
            };

            return {
                id: `${productObj.id}-${subcat.id}`,
                title: catalogProduct.name,
                product: productObj,
                image: s3Image,
                catalogImages: (catalogProduct.images || []).sort((a, b) => (a.order || 0) - (b.order || 0)),
                catalogImageStyles: (catalogProduct.images || []).sort((a, b) => (a.order || 0) - (b.order || 0)),
                pwa: masterImage?.pwa || null,
                backgroundColor,
                textColor,
                gradientDirection,
                gradientStartColor,
                gradientEndColor,
                variantId: catalogVariants[0]?.id,
                variants: catalogVariants,
                catalogVariants: catalogProduct.variants || [],
                displayModifiers: resolveDisplayModifiers(catalogProduct.displayModifiers, catalog.modifiers),
                isMYO: (catalogProduct.name || '').toLowerCase().includes('make your own'),
                subSubcategoryId: subSubcategory?.id || null,
                subSubcategoryName: subSubcategory?.name || null,
                inventory: buildProductInventory(catalogProduct.variants),
            };
        }).filter(Boolean);

        console.log(`📦 [Catalog:${rootName}] Products for`, subcat.name, ':', containers.map(c => c.title));

        return {
            id: subcat.id,
            title: subcat.name,
            description: subcat.description || '',
            image: subcat.image?.url || `https://placehold.co/300x300/e0e0e0/666666?text=${encodeURIComponent(subcat.name)}`,
            containers: containers,
            products: containers.map(c => c.product),
            childCategories: childCategories.map(c => ({ id: c.id, name: c.name, position: c.position })),
            filter: (p) => {
                const catalogProd = catalog.products?.find(cp =>
                    cp.name?.toLowerCase() === p.name?.toLowerCase()
                );
                return catalogProd?.categoryIds?.some(catId => subcatIds.has(catId));
            }
        };
    }).filter(subcat => subcat.containers.length > 0);
};

// Check location availability for a variant (used as a pure function helper)
export const checkLocationAvailability = (variant, product, storeLocations, selectedSlug) => {
    if (!selectedSlug || !storeLocations?.length) return { available: true, locationName: null };
    const store = storeLocations.find(loc => loc.id === selectedSlug);
    if (!store?.shopifyLocationId) return { available: true, locationName: null };

    // Primary: check catalog variant inventory.byLocation
    if (variant?.inventory?.byLocation?.length) {
        const locEntry = variant.inventory.byLocation.find(l => l.locationId === selectedSlug);
        if (!locEntry) {
            // No inventory record for this location — only unavailable if inventory is tracked
            if (variant.inventory.trackInventory) return { available: false, locationName: store.name };
            // Not tracked = available everywhere (inventory records are informational only)
            return { available: true, locationName: store.name };
        }
        // Only check quantity when inventory is actually tracked
        if (variant.inventory.trackInventory && locEntry.quantity <= 0) {
            return { available: false, locationName: store.name };
        }
        return { available: true, locationName: store.name };
    }

    // Fallback: Shopify storeAvailability (legacy non-catalog-first products)
    const shopifyGid = `gid://shopify/Location/${store.shopifyLocationId}`;
    if (variant?.storeAvailability?.length) {
        const locEntry = variant.storeAvailability.find(sa => sa.locationId === shopifyGid);
        if (locEntry && !locEntry.available) return { available: false, locationName: store.name };
        if (!locEntry) return { available: false, locationName: store.name };
    }
    // Fallback: check product-level storeAvailableLocationIds
    if (product?.storeAvailableLocationIds?.length) {
        if (!product.storeAvailableLocationIds.includes(shopifyGid)) {
            return { available: false, locationName: store.name };
        }
    }
    return { available: true, locationName: store.name };
};
