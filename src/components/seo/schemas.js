const SCHEMA_DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function buildOrganizationSchema() {
    return {
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name: 'Surreal Creamery',
        url: 'https://surrealcreamery.com',
        logo: 'https://surrealcreamery.com/src/assets/images/svg/logo.svg',
        sameAs: [
            'https://www.instagram.com/surrealcreamery/',
            'https://www.facebook.com/surrealcreamery/',
        ],
        contactPoint: {
            '@type': 'ContactPoint',
            telephone: '+1-646-455-0093',
            contactType: 'customer service',
        },
    };
}

export function buildLocalBusinessSchema(location) {
    const schema = {
        '@context': 'https://schema.org',
        '@type': 'IceCreamShop',
        name: `Surreal Creamery - ${location.name}`,
        image: 'https://surrealcreamery.com/src/assets/images/svg/logo.svg',
        url: 'https://surrealcreamery.com/locations',
        telephone: location.phone || undefined,
        address: {
            '@type': 'PostalAddress',
            streetAddress: location.address,
            addressLocality: location.city,
            addressRegion: location.state,
            postalCode: location.zip,
            addressCountry: 'US',
        },
        parentOrganization: {
            '@type': 'Organization',
            name: 'Surreal Creamery',
        },
    };

    if (location.latitude && location.longitude) {
        schema.geo = {
            '@type': 'GeoCoordinates',
            latitude: location.latitude,
            longitude: location.longitude,
        };
    }

    if (location.googlePlaceId) {
        schema.hasMap = `https://www.google.com/maps/place/?q=place_id:${location.googlePlaceId}`;
    }

    if (location.hours && Object.keys(location.hours).length > 0) {
        schema.openingHoursSpecification = Object.entries(location.hours).map(([dayIdx, times]) => ({
            '@type': 'OpeningHoursSpecification',
            dayOfWeek: SCHEMA_DAY_NAMES[Number(dayIdx)],
            opens: times.open,
            closes: times.close,
        }));
    }

    return schema;
}

export function buildProductSchema(product) {
    if (!product) return null;

    const schema = {
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: product.name || product.title,
        description: product.description || `Shop ${product.name || product.title} at Surreal Creamery`,
        brand: {
            '@type': 'Brand',
            name: 'Surreal Creamery',
        },
    };

    const imageUrl = product.imageUrl || product.images?.[0]?.url;
    if (imageUrl) {
        schema.image = imageUrl;
    }

    // Build offers from variants or product price
    const variants = product.variants || [];
    if (variants.length > 0) {
        const prices = variants
            .map(v => parseFloat(v.price?.amount || v.price || 0))
            .filter(p => p > 0);
        if (prices.length > 0) {
            schema.offers = {
                '@type': 'AggregateOffer',
                priceCurrency: 'USD',
                lowPrice: Math.min(...prices).toFixed(2),
                highPrice: Math.max(...prices).toFixed(2),
                offerCount: variants.length,
                availability: 'https://schema.org/InStock',
            };
        }
    } else if (product.price) {
        schema.offers = {
            '@type': 'Offer',
            priceCurrency: 'USD',
            price: parseFloat(product.price?.amount || product.price || 0).toFixed(2),
            availability: 'https://schema.org/InStock',
        };
    }

    return schema;
}

export function buildItemListSchema(products, listName) {
    if (!products?.length) return null;

    return {
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        name: listName,
        numberOfItems: products.length,
        itemListElement: products.slice(0, 30).map((product, index) => ({
            '@type': 'ListItem',
            position: index + 1,
            item: {
                '@type': 'Product',
                name: product.name || product.title,
                image: product.imageUrl || product.images?.[0]?.url,
                url: `https://surrealcreamery.com/product/${product.id}`,
            },
        })),
    };
}

export function buildWebSiteSchema() {
    return {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: 'Surreal Creamery',
        url: 'https://surrealcreamery.com',
        potentialAction: {
            '@type': 'SearchAction',
            target: {
                '@type': 'EntryPoint',
                urlTemplate: 'https://surrealcreamery.com/desserts?q={search_term_string}',
            },
            'query-input': 'required name=search_term_string',
        },
    };
}
