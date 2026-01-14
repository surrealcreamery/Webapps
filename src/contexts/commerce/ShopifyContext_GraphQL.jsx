import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import Client from 'shopify-buy';

// Your Shopify credentials
const SHOPIFY_DOMAIN = 'surreal-9940.myshopify.com';
const STOREFRONT_ACCESS_TOKEN = 'b826d9dc5dacd8d58a91e1de899e2c9a';

// Initialize Shopify Buy SDK client (for cart/checkout)
const client = Client.buildClient({
  domain: SHOPIFY_DOMAIN,
  storefrontAccessToken: STOREFRONT_ACCESS_TOKEN
});

// GraphQL endpoint for fetching products with metafields
const STOREFRONT_API_URL = `https://${SHOPIFY_DOMAIN}/api/2024-01/graphql.json`;

const ShopifyContext = createContext();

export const ShopifyProvider = ({ children }) => {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [dessertSubcategories, setDessertSubcategories] = useState([]);
  const [merchandiseSubcategories, setMerchandiseSubcategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [checkout, setCheckout] = useState(null);

  // Test mode - hidden products tagged "test-item" are shown when user types "test"
  const [testModeEnabled, setTestModeEnabled] = useState(() => {
    return localStorage.getItem('testModeEnabled') === 'true';
  });
  const keySequenceRef = useRef('');

  // Listen for "test" keyboard sequence to toggle test mode
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ignore if user is typing in an input/textarea
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) {
        return;
      }

      // Only track letter keys
      if (e.key.length === 1 && /[a-zA-Z]/.test(e.key)) {
        keySequenceRef.current += e.key.toLowerCase();

        // Keep only last 4 characters
        if (keySequenceRef.current.length > 4) {
          keySequenceRef.current = keySequenceRef.current.slice(-4);
        }

        console.log('🔑 Key sequence:', keySequenceRef.current);

        // Check if sequence matches "test"
        if (keySequenceRef.current === 'test') {
          setTestModeEnabled(prev => {
            const newValue = !prev;
            localStorage.setItem('testModeEnabled', newValue.toString());
            alert(`🧪 Test mode ${newValue ? 'ENABLED' : 'DISABLED'}`);
            return newValue;
          });
          keySequenceRef.current = '';
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    initializeShopify();
  }, []);

  const initializeShopify = async () => {
    try {
      await Promise.all([
        fetchCategories(),
        fetchDessertSubcategories(),
        fetchMerchandiseSubcategories(),
        fetchProductsWithMetafields(),
        restoreOrCreateCheckout()
      ]);
    } catch (err) {
      console.error('Error initializing Shopify:', err);
      setError(err.message);
      setLoading(false);
    }
  };

  /**
   * Fetch product category metaobjects (top-level categories like Desserts, Merchandise)
   */
  const fetchCategories = async () => {
    try {
      const query = `
        query getProductCategories {
          metaobjects(type: "product_category", first: 20) {
            edges {
              node {
                id
                handle
                fields {
                  key
                  value
                  reference {
                    ... on MediaImage {
                      image {
                        url
                        altText
                      }
                    }
                  }
                }
              }
            }
          }
        }
      `;

      const response = await fetch(STOREFRONT_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Storefront-Access-Token': STOREFRONT_ACCESS_TOKEN
        },
        body: JSON.stringify({ query })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const { data, errors } = await response.json();

      if (errors) {
        console.warn('Error fetching product categories:', errors);
        return;
      }

      // Transform metaobjects to category format
      const cats = data.metaobjects.edges.map(edge => {
        const node = edge.node;
        const fields = {};
        let imageUrl = null;

        // Helper to find field value by normalized key (handles spaces, case, underscores)
        const normalizeKey = (key) => key.toLowerCase().replace(/[\s_-]+/g, '');
        const findFieldValue = (targetKey) => {
          const normalizedTarget = normalizeKey(targetKey);
          for (const [key, value] of Object.entries(fields)) {
            if (normalizeKey(key) === normalizedTarget) {
              return value;
            }
          }
          return null;
        };

        node.fields.forEach(field => {
          // Check for image reference fields (multiple possible structures)
          if (field.reference?.image?.url) {
            // Standard MediaImage reference structure
            fields[field.key] = {
              url: field.reference.image.url,
              alt: field.reference.image.altText
            };
            imageUrl = field.reference.image.url;
          } else if (field.reference?.url) {
            // Direct URL in reference
            fields[field.key] = { url: field.reference.url };
            imageUrl = field.reference.url;
          } else if (field.value && typeof field.value === 'string' && field.value.startsWith('http')) {
            // Direct URL string value
            fields[field.key] = field.value;
            if (field.key.toLowerCase().includes('image')) {
              imageUrl = field.value;
            }
          } else {
            fields[field.key] = field.value;
          }
        });

        // Find title using various possible field names
        const title = findFieldValue('product_category_title')
          || findFieldValue('title')
          || findFieldValue('name')
          || fields.product_category_title
          || fields.title
          || fields.name
          || node.handle;

        // Debug: Log the resolved values
        console.log(`🏷️ Category "${node.handle}" → title: "${title}", imageUrl: ${imageUrl ? 'YES' : 'NO'}, fields:`, Object.keys(fields));

        return {
          id: node.handle,
          gid: node.id,
          handle: node.handle,
          title: title,
          description: findFieldValue('product_category_description') || findFieldValue('description') || fields.description || '',
          image: imageUrl ? { url: imageUrl } : fields.image || null,
          sortOrder: parseInt(fields.sort_order || fields.sortorder || fields['sort-order'] || fields.display_order || '999', 10)
        };
      });

      // Sort by sortOrder
      cats.sort((a, b) => a.sortOrder - b.sortOrder);

      console.log('✅ Loaded product categories:', cats);
      console.log('📦 Category handles:', cats.map(c => c.handle));
      setCategories(cats);
    } catch (err) {
      console.warn('Could not fetch product categories:', err);
      // Continue without categories - fall back to hardcoded
    }
  };

  /**
   * Fetch variant dessert subcategory metaobjects
   */
  const fetchDessertSubcategories = async () => {
    try {
      const query = `
        query getVariantDessertSubcategories {
          metaobjects(type: "dessert_subcategory", first: 20) {
            edges {
              node {
                id
                handle
                fields {
                  key
                  value
                  reference {
                    ... on MediaImage {
                      image {
                        url
                        altText
                      }
                    }
                  }
                }
              }
            }
          }
        }
      `;

      const response = await fetch(STOREFRONT_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Storefront-Access-Token': STOREFRONT_ACCESS_TOKEN
        },
        body: JSON.stringify({ query })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const { data, errors } = await response.json();

      if (errors) {
        console.warn('Error fetching variant dessert subcategories:', errors);
        return;
      }

      // Transform metaobjects to subcategory format
      const subcategories = data.metaobjects.edges.map(edge => {
        const node = edge.node;
        const fields = {};
        let imageUrl = null;

        // Helper to find field value by normalized key (handles spaces, case, underscores)
        const normalizeKey = (key) => key.toLowerCase().replace(/[\s_-]+/g, '');
        const findFieldValue = (targetKey) => {
          const normalizedTarget = normalizeKey(targetKey);
          for (const [key, value] of Object.entries(fields)) {
            if (normalizeKey(key) === normalizedTarget) {
              return value;
            }
          }
          return null;
        };

        node.fields.forEach(field => {
          // Check for image reference fields (multiple possible structures)
          if (field.reference?.image?.url) {
            // Standard MediaImage reference structure
            fields[field.key] = {
              url: field.reference.image.url,
              alt: field.reference.image.altText
            };
            imageUrl = field.reference.image.url;
          } else if (field.reference?.url) {
            // Direct URL in reference
            fields[field.key] = { url: field.reference.url };
            imageUrl = field.reference.url;
          } else if (field.value && typeof field.value === 'string' && field.value.startsWith('http')) {
            // Direct URL string value
            fields[field.key] = field.value;
            if (field.key.toLowerCase().includes('image')) {
              imageUrl = field.value;
            }
          } else {
            fields[field.key] = field.value;
          }
        });

        // Find title using various possible field names
        const title = findFieldValue('product_category_title')
          || findFieldValue('title')
          || findFieldValue('name')
          || fields.product_category_title
          || fields.title
          || fields.name
          || node.handle;

        // Debug: Log the resolved values
        console.log(`🏷️ Dessert Subcategory "${node.handle}" → title: "${title}", imageUrl: ${imageUrl ? 'YES' : 'NO'}, fields:`, Object.keys(fields));

        return {
          id: node.handle,
          gid: node.id,
          handle: node.handle,
          title: title,
          description: findFieldValue('product_category_description') || findFieldValue('description') || fields.description || '',
          image: imageUrl ? { url: imageUrl } : fields.image || null,
          sortOrder: parseInt(fields.sort_order || fields.sortorder || fields['sort-order'] || fields.display_order || '999', 10)
        };
      });

      // Sort by sortOrder
      subcategories.sort((a, b) => a.sortOrder - b.sortOrder);

      console.log('✅ Loaded variant dessert subcategories:', subcategories);
      // Debug: Log all subcategories' raw fields to see actual field keys
      data.metaobjects.edges.forEach((edge, idx) => {
        const node = edge.node;
        console.log(`🔍 DEBUG Dessert subcategory [${idx}] "${node.handle}" raw fields:`,
          node.fields.map(f => ({
            key: f.key,
            value: f.value?.substring?.(0, 50) || f.value,
            hasReference: !!f.reference,
            referenceType: f.reference ? Object.keys(f.reference) : null,
            hasImageRef: !!f.reference?.image?.url,
            imageUrl: f.reference?.image?.url?.substring?.(0, 50)
          }))
        );
      });
      setDessertSubcategories(subcategories);
    } catch (err) {
      console.warn('Could not fetch variant dessert subcategories:', err);
      // Continue without subcategories - they're optional
    }
  };

  /**
   * Fetch merchandise subcategory metaobjects
   */
  const fetchMerchandiseSubcategories = async () => {
    try {
      const query = `
        query getMerchandiseSubcategories {
          metaobjects(type: "product_merchandise_subcategory", first: 20) {
            edges {
              node {
                id
                handle
                fields {
                  key
                  value
                  reference {
                    ... on MediaImage {
                      image {
                        url
                        altText
                      }
                    }
                  }
                }
              }
            }
          }
        }
      `;

      const response = await fetch(STOREFRONT_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Storefront-Access-Token': STOREFRONT_ACCESS_TOKEN
        },
        body: JSON.stringify({ query })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const { data, errors } = await response.json();

      if (errors) {
        console.warn('Error fetching merchandise subcategories:', errors);
        return;
      }

      // Transform metaobjects to subcategory format
      const subcategories = data.metaobjects.edges.map(edge => {
        const node = edge.node;
        const fields = {};
        let imageUrl = null;

        // Helper to find field value by normalized key (handles spaces, case, underscores)
        const normalizeKey = (key) => key.toLowerCase().replace(/[\s_-]+/g, '');
        const findFieldValue = (targetKey) => {
          const normalizedTarget = normalizeKey(targetKey);
          for (const [key, value] of Object.entries(fields)) {
            if (normalizeKey(key) === normalizedTarget) {
              return value;
            }
          }
          return null;
        };

        node.fields.forEach(field => {
          // Check for image reference fields (multiple possible structures)
          if (field.reference?.image?.url) {
            // Standard MediaImage reference structure
            fields[field.key] = {
              url: field.reference.image.url,
              alt: field.reference.image.altText
            };
            imageUrl = field.reference.image.url;
          } else if (field.reference?.url) {
            // Direct URL in reference
            fields[field.key] = { url: field.reference.url };
            imageUrl = field.reference.url;
          } else if (field.value && typeof field.value === 'string' && field.value.startsWith('http')) {
            // Direct URL string value
            fields[field.key] = field.value;
            if (field.key.toLowerCase().includes('image')) {
              imageUrl = field.value;
            }
          } else {
            fields[field.key] = field.value;
          }
        });

        // Find title using various possible field names
        const title = findFieldValue('product_category_title')
          || findFieldValue('title')
          || findFieldValue('name')
          || fields.product_category_title
          || fields.title
          || fields.name
          || node.handle;

        // Debug: Log the resolved values
        console.log(`🏷️ Merchandise Subcategory "${node.handle}" → title: "${title}", imageUrl: ${imageUrl ? 'YES' : 'NO'}, fields:`, Object.keys(fields));

        return {
          id: fields.name || node.handle,
          gid: node.id,
          handle: node.handle,
          title: title,
          description: findFieldValue('product_category_description') || findFieldValue('description') || fields.description || '',
          image: imageUrl ? { url: imageUrl } : fields.image || null
        };
      });

      console.log('✅ Loaded merchandise subcategories:', subcategories);
      setMerchandiseSubcategories(subcategories);
    } catch (err) {
      console.warn('Could not fetch merchandise subcategories:', err);
      // Continue without subcategories - they're optional
    }
  };

  /**
   * Restore existing checkout from localStorage or create new one
   */
  const restoreOrCreateCheckout = async () => {
    try {
      const savedCheckoutId = localStorage.getItem('shopifyCheckoutId');
      
      if (savedCheckoutId) {
        // Try to restore existing checkout
        try {
          const existingCheckout = await client.checkout.fetch(savedCheckoutId);
          
          // Check if checkout is still valid (not completed)
          if (existingCheckout && !existingCheckout.completedAt) {
            console.log('✅ Restored existing checkout:', savedCheckoutId);
            setCheckout(existingCheckout);
            return;
          } else {
            console.log('⚠️ Checkout was completed, creating new one');
            localStorage.removeItem('shopifyCheckoutId');
          }
        } catch (err) {
          console.log('⚠️ Could not restore checkout, creating new one');
          localStorage.removeItem('shopifyCheckoutId');
        }
      }
      
      // Create new checkout if no valid existing one
      await createCheckout();
    } catch (err) {
      console.error('Error restoring/creating checkout:', err);
      await createCheckout(); // Fallback to creating new checkout
    }
  };

  /**
   * Fetch all products with metafields using GraphQL
   */
  const fetchProductsWithMetafields = async () => {
    try {
      setLoading(true);

      const query = `
        query getAllProducts {
          products(first: 50) {
            edges {
              node {
                id
                handle
                title
                description
                productType
                tags
                priceRange {
                  minVariantPrice {
                    amount
                    currencyCode
                  }
                }
                variants(first: 20) {
                  edges {
                    node {
                      id
                      title
                      sku
                      availableForSale
                      quantityAvailable
                      price {
                        amount
                        currencyCode
                      }
                      image {
                        url
                        altText
                      }
                      metafields(identifiers: [
                        { namespace: "dessert", key: "subcategory" }
                        { namespace: "dessert", key: "container" }
                        { namespace: "dessert", key: "size" }
                        { namespace: "dessert", key: "has_variant_image" }
                      ]) {
                        namespace
                        key
                        value
                        type
                        reference {
                          ... on Metaobject {
                            id
                            handle
                            type
                            fields {
                              key
                              value
                            }
                          }
                        }
                      }
                    }
                  }
                }
                images(first: 20) {
                  edges {
                    node {
                      url
                      altText
                    }
                  }
                }
                metafields(identifiers: [
                  { namespace: "collectible", key: "total_in_series" }
                  { namespace: "collectible", key: "chase_variants" }
                  { namespace: "collectible", key: "material" }
                  { namespace: "collectible", key: "height" }
                  { namespace: "custom", key: "image_metadata" }
                  { namespace: "custom", key: "fulfillment_methods" }
                  { namespace: "dessert", key: "ingredients" }
                  { namespace: "dessert", key: "allergens" }
                ]) {
                  namespace
                  key
                  value
                  type
                }
                # Merchandise subcategory (product-level)
                merchandiseSubcategory: metafield(namespace: "custom", key: "product_merchandise_subcategory") {
                  value
                  reference {
                    ... on Metaobject {
                      id
                      handle
                      type
                      fields {
                        key
                        value
                      }
                    }
                  }
                }
                # Product category (top-level: Desserts, Merchandise, etc.)
                productCategory: metafield(namespace: "custom", key: "product_category") {
                  value
                  reference {
                    ... on Metaobject {
                      id
                      handle
                      type
                      fields {
                        key
                        value
                        reference {
                          ... on MediaImage {
                            image {
                              url
                              altText
                            }
                          }
                        }
                      }
                    }
                  }
                }
                # Cross-sell collection (references a collection of products)
                crosssellCollection: metafield(namespace: "custom", key: "cross_sell_collection") {
                  reference {
                    ... on Collection {
                      id
                      title
                      handle
                      # Promotion details for cross-sell banner
                      promotionTitle: metafield(namespace: "custom", key: "promotion_title") {
                        value
                      }
                      promotionDescription: metafield(namespace: "custom", key: "promotion_description") {
                        value
                      }
                      promotionDiscount: metafield(namespace: "custom", key: "promotion_discount") {
                        value
                      }
                      products(first: 8) {
                        edges {
                          node {
                            id
                            title
                            handle
                            featuredImage {
                              url
                              altText
                            }
                            priceRange {
                              minVariantPrice {
                                amount
                              }
                            }
                            variants(first: 1) {
                              edges {
                                node {
                                  id
                                }
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      `;

      const response = await fetch(STOREFRONT_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Storefront-Access-Token': STOREFRONT_ACCESS_TOKEN
        },
        body: JSON.stringify({ query })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const { data, errors } = await response.json();

      if (errors) {
        throw new Error(errors[0].message);
      }

      // Transform products
      const transformedProducts = data.products.edges.map(edge => 
        transformProduct(edge.node)
      );

      // DEBUG: Log first blind box product
      const firstBlindBox = transformedProducts.find(p => p.merchandiseType === 'blind_box_collectible');
      if (firstBlindBox) {
        console.log('🔍 DEBUG: First blind box product:', {
          name: firstBlindBox.name,
          collectibleInfo: firstBlindBox.collectibleInfo,
          tags: firstBlindBox.tags
        });
      }

      setProducts(transformedProducts);
      setLoading(false);
      console.log('✅ Products loaded successfully:', transformedProducts.length);
      console.log('✅ First product:', transformedProducts[0]);
    } catch (err) {
      console.error('❌ Error fetching products:', err);
      console.error('❌ Error message:', err.message);
      console.error('❌ Error stack:', err.stack);
      setError(err.message);
      setLoading(false);
      setProducts([]); // Explicitly set empty array on error
    }
  };

  /**
   * Transform Shopify GraphQL product to your app's format
   */
  const transformProduct = (shopifyProduct) => {
    // Extract product category from metafield reference (dynamic from Shopify)
    let categoryHandle = null;
    let categoryData = null;
    if (shopifyProduct.productCategory?.reference) {
      const ref = shopifyProduct.productCategory.reference;
      const fields = {};
      let imageUrl = null;

      // Helper to find field value by normalized key (handles spaces, case, underscores)
      const normalizeKey = (key) => key.toLowerCase().replace(/[\s_-]+/g, '');
      const findFieldValue = (targetKey) => {
        const normalizedTarget = normalizeKey(targetKey);
        for (const [key, value] of Object.entries(fields)) {
          if (normalizeKey(key) === normalizedTarget) {
            return value;
          }
        }
        return null;
      };

      ref.fields?.forEach(f => {
        fields[f.key] = f.value;
        // Check if this field has an image reference
        if (f.reference?.image?.url) {
          // Store with the field key for easy access
          fields[`${f.key}_url`] = f.reference.image.url;
          imageUrl = f.reference.image.url; // Capture any image reference
        }
      });
      categoryHandle = ref.handle;

      // Find title using various possible field names
      const title = findFieldValue('product_category_title')
        || findFieldValue('title')
        || findFieldValue('name')
        || fields.product_category_title
        || fields.title
        || fields.name
        || ref.handle;

      categoryData = {
        id: ref.handle,
        gid: ref.id,
        handle: ref.handle,
        type: ref.type,
        title: title,
        image: imageUrl || fields.product_category_image_url || fields.image_url || null,
        ...fields
      };
    }
    
    // Fallback to productType if no category metafield (backwards compatibility)
    const productTypeLower = shopifyProduct.productType?.toLowerCase();
    const category = categoryHandle || (productTypeLower === 'desserts' ? 'desserts' : 'merchandise');
    const isMerchandise = category !== 'desserts';
    const isDessert = category === 'desserts';
    
    // Debug: Log category assignment
    if (!categoryHandle) {
      console.log(`📦 Product "${shopifyProduct.title}" has no category metafield, using productType fallback: "${shopifyProduct.productType}" → category: "${category}"`);
    }
    
    const isBlindBox = shopifyProduct.tags.some(tag => 
      tag.toLowerCase().includes('blind-box') || 
      tag.toLowerCase().includes('collectible')
    );

    // Extract metafields into a map
    const metafields = {};
    shopifyProduct.metafields.forEach(mf => {
      if (mf) {
        metafields[`${mf.namespace}.${mf.key}`] = mf.value;
      }
    });

    // DEBUG: Log metafields for first product
    if (shopifyProduct.handle === 'tokidoki-20th-anniversary-blind-box') {
      console.log('🔍 DEBUG: Metafields for 20th Anniversary:', metafields);
      console.log('🔍 DEBUG: All metafield objects:', shopifyProduct.metafields);
    }

    // Parse image metadata from JSON metafield
    let imageMetadata = null;
    const imageMetaJSON = metafields['custom.image_metadata'];
    if (imageMetaJSON) {
      try {
        imageMetadata = JSON.parse(imageMetaJSON);
      } catch (e) {
        console.warn(`Failed to parse image metadata for ${shopifyProduct.handle}:`, e);
      }
    }

    // Get variant info
    const variant = shopifyProduct.variants.edges[0]?.node;
    const price = variant?.price?.amount || '0';

    // Parse inventory - Storefront API only gives total available, not by location
    // For location-specific inventory, you'd need to use the Admin API
    const totalInventory = variant?.quantityAvailable || 0;
    
    // Desserts don't track inventory (made-to-order, unlimited)
    const inventoryTracked = !isDessert && (variant?.quantityAvailable !== null);
    const inStock = variant?.availableForSale && (isDessert || totalInventory > 0);

    // Transform images with metadata
    const images = shopifyProduct.images.edges.map((edge, index) => {
      const img = edge.node;
      
      // Find metadata for this image position
      const imgMeta = imageMetadata?.images?.find(m => m.position === index + 1);

      return {
        url: img.url,
        alt: img.altText || shopifyProduct.title,
        type: imgMeta?.type || getDefaultImageType(index, isBlindBox),
        displayOrder: index + 1,
        figurineName: imgMeta?.figurineName || null,
        figurineNumber: imgMeta?.figurineNumber || null
      };
    });

    // Extract merchandise subcategory (product-level metaobject reference)
    let merchandiseSubcategory = null;
    let merchandiseSubcategoryData = null;
    if (shopifyProduct.merchandiseSubcategory?.reference) {
      const ref = shopifyProduct.merchandiseSubcategory.reference;
      const fields = {};
      ref.fields?.forEach(f => {
        fields[f.key] = f.value;
      });
      merchandiseSubcategory = fields.name || ref.handle;
      merchandiseSubcategoryData = {
        id: fields.name || ref.handle,
        gid: ref.id,
        handle: ref.handle,
        type: ref.type,
        title: fields.title || ref.handle,
        ...fields
      };
    }

    // Extract cross-sell products from collection reference
    let crosssellProducts = [];
    let crosssellPromotion = null;
    if (shopifyProduct.crosssellCollection?.reference) {
      const collection = shopifyProduct.crosssellCollection.reference;
      console.log('🛒 Cross-sell collection found for', shopifyProduct.handle, ':', collection.title);
      console.log('🛒 Full collection object:', collection);
      console.log('🛒 Collection metafields:', {
        promotionTitle: collection.promotionTitle,
        promotionDescription: collection.promotionDescription,
        promotionDiscount: collection.promotionDiscount
      });
      
      // Extract promotion details
      if (collection.promotionTitle?.value || collection.promotionDescription?.value || collection.promotionDiscount?.value) {
        crosssellPromotion = {
          title: collection.promotionTitle?.value || null,
          description: collection.promotionDescription?.value || null,
          discount: collection.promotionDiscount?.value || null
        };
        console.log('🎁 Cross-sell promotion:', crosssellPromotion);
      } else {
        console.log('⚠️ No promotion metafields found on collection');
      }
      
      crosssellProducts = collection.products?.edges?.map(edge => ({
        id: edge.node.handle,
        shopifyId: edge.node.id,
        name: edge.node.title,
        imageUrl: edge.node.featuredImage?.url,
        imageAlt: edge.node.featuredImage?.altText,
        price: `$${parseFloat(edge.node.priceRange?.minVariantPrice?.amount || 0).toFixed(2)}`,
        variantId: edge.node.variants?.edges?.[0]?.node?.id
      })).filter(p => p.id !== shopifyProduct.handle) || []; // Exclude current product
      console.log('🛒 Cross-sell products:', crosssellProducts);
    } else {
      console.log('⚠️ No crosssell collection for', shopifyProduct.handle);
    }

    return {
      // Basic product info
      id: shopifyProduct.handle,
      name: shopifyProduct.title,
      category: category, // Dynamic from metafield
      categoryData: categoryData, // Full category object
      type: isMerchandise ? 'merchandise' : 'dessert',
      merchandiseType: isBlindBox ? 'blind_box_collectible' : null,
      price: `$${parseFloat(price).toFixed(2)}`,
      
      // Images
      imageUrl: images[0]?.url || '',
      imageAlt: images[0]?.alt || shopifyProduct.title,
      images: images,
      
      // Description
      description: shopifyProduct.description,
      
      // Shopify-specific data
      shopifyId: shopifyProduct.id,
      variantId: variant?.id,
      availableForSale: variant?.availableForSale || true,
      tags: shopifyProduct.tags,
      productType: shopifyProduct.productType, // Keep original for backwards compatibility
      
      // Merchandise subcategory (product-level)
      merchandiseSubcategory: merchandiseSubcategory,
      merchandiseSubcategoryData: merchandiseSubcategoryData,
      
      // All variants (for products with multiple options)
      variants: shopifyProduct.variants.edges.map(edge => {
        const variantNode = edge.node;
        
        // Extract variant metafields
        const variantMetafields = {};
        variantNode.metafields?.forEach(mf => {
          if (mf) {
            variantMetafields[`${mf.namespace}.${mf.key}`] = mf;
          }
        });
        
        // Parse metaobject references for subcategory, container, size
        const subcategoryMf = variantMetafields['dessert.subcategory'];
        const containerMf = variantMetafields['dessert.container'];
        const sizeMf = variantMetafields['dessert.size'];
        const hasVariantImageMf = variantMetafields['dessert.has_variant_image'];
        
        // Extract metaobject data
        const getMetaobjectData = (mf) => {
          if (!mf?.reference) return null;
          const fields = {};
          mf.reference.fields?.forEach(f => {
            fields[f.key] = f.value;
          });
          return {
            id: mf.reference.handle,
            gid: mf.reference.id,
            type: mf.reference.type,
            title: fields.title || mf.reference.handle,
            ...fields
          };
        };
        
        const subcategoryData = getMetaobjectData(subcategoryMf);
        const containerData = getMetaobjectData(containerMf);
        const sizeData = getMetaobjectData(sizeMf);
        
        return {
          id: variantNode.id,
          title: variantNode.title,
          sku: variantNode.sku || null,
          price: variantNode.price?.amount,
          availableForSale: variantNode.availableForSale,
          quantityAvailable: variantNode.quantityAvailable,
          image: variantNode.image ? {
            url: variantNode.image.url,
            alt: variantNode.image.altText
          } : null,
          // Variant metafield data
          subcategory: subcategoryData?.id || null,
          subcategoryData: subcategoryData,
          container: containerData?.id || null,
          containerData: containerData,
          size: sizeData?.id || null,
          sizeData: sizeData,
          hasVariantImage: hasVariantImageMf?.value === 'true'
        };
      }),
      
      // Collectible info (for blind boxes)
      collectibleInfo: isBlindBox ? {
        totalInSeries: parseInt(metafields['collectible.total_in_series']) || 0,
        chaseVariants: parseInt(metafields['collectible.chase_variants']) || 0,
        material: metafields['collectible.material'] || 'PVC',
        height: metafields['collectible.height'] || '3 inches'
      } : null,

      // DEBUG: Log collectibleInfo for first blind box
      ...(isBlindBox && shopifyProduct.handle === 'tokidoki-20th-anniversary-blind-box' ? 
        console.log('🔍 DEBUG: collectibleInfo created:', {
          totalInSeries: parseInt(metafields['collectible.total_in_series']) || 0,
          chaseVariants: parseInt(metafields['collectible.chase_variants']) || 0,
          raw_total: metafields['collectible.total_in_series'],
          raw_chase: metafields['collectible.chase_variants']
        }) || {} : {}),

      // Dessert info (for desserts)
      ingredients: metafields['dessert.ingredients'] || null,
      allergens: metafields['dessert.allergens'] || null,

      // Fulfillment methods (e.g., "shipping", "pickup", "local_delivery")
      // Can be a JSON array like ["shipping", "pickup"] or comma-separated string
      fulfillmentMethods: (() => {
        const raw = metafields['custom.fulfillment_methods'];
        if (!raw) return null;
        try {
          // Try parsing as JSON array first
          return JSON.parse(raw);
        } catch {
          // Fall back to comma-separated string
          return raw.split(',').map(s => s.trim().toLowerCase());
        }
      })(),
      canShip: (() => {
        const raw = metafields['custom.fulfillment_methods'];
        if (!raw) return null; // Unknown - no metafield set
        try {
          const methods = JSON.parse(raw);
          return methods.some(m => m.toLowerCase() === 'shipping');
        } catch {
          return raw.toLowerCase().includes('shipping');
        }
      })(),

      // Inventory data (total only - Storefront API limitation)
      inventoryTracked: inventoryTracked,
      totalInventory: totalInventory,
      inStock: inStock,
      
      // Note: Location-specific inventory requires Admin API
      // For now, we show total inventory across all locations
      
      // Cross-sell products from collection reference
      crosssellProducts: crosssellProducts,
      
      // Cross-sell promotion details (from collection metafields)
      crosssellPromotion: crosssellPromotion
    };
  };

  /**
   * Fallback for image type if metadata is missing
   */
  const getDefaultImageType = (index, isBlindBox) => {
    if (!isBlindBox) return 'product';
    if (index === 0) return 'product_packaging';
    if (index === 1) return 'full_set';
    return 'individual_figurine';
  };

  /**
   * Create a new checkout session
   */
  const createCheckout = async () => {
    try {
      const newCheckout = await client.checkout.create();
      setCheckout(newCheckout);

      // Save checkout ID to localStorage
      localStorage.setItem('shopifyCheckoutId', newCheckout.id);
      console.log('✅ Created new checkout:', newCheckout.id);

      return newCheckout;
    } catch (err) {
      console.error('Error creating checkout:', err);
      throw err;
    }
  };

  /**
   * Add item to cart
   * @param {string} variantId - Shopify variant ID
   * @param {number} quantity - Quantity to add
   * @param {Array} customAttributes - Custom attributes for the line item (e.g., modifiers)
   */
  const addToCart = async (variantId, quantity = 1, customAttributes = []) => {
    console.log('🛒 addToCart called:', { variantId, quantity, customAttributes });
    console.log('🛒 Current checkout:', checkout);

    try {
      let currentCheckout = checkout;
      if (!currentCheckout) {
        console.log('🛒 No checkout exists, creating new one...');
        currentCheckout = await createCheckout();
      }

      console.log('🛒 Adding line items to cart:', currentCheckout.id);

      // Use Cart API (not Checkout API) - Shopify Buy SDK v3 uses Cart API
      const mutation = `
        mutation cartLinesAdd($cartId: ID!, $lines: [CartLineInput!]!) {
          cartLinesAdd(cartId: $cartId, lines: $lines) {
            cart {
              id
              checkoutUrl
              cost {
                subtotalAmount {
                  amount
                  currencyCode
                }
                totalAmount {
                  amount
                  currencyCode
                }
              }
              lines(first: 250) {
                edges {
                  node {
                    id
                    quantity
                    attributes {
                      key
                      value
                    }
                    merchandise {
                      ... on ProductVariant {
                        id
                        title
                        price {
                          amount
                          currencyCode
                        }
                        image {
                          url
                          altText
                        }
                        product {
                          id
                          title
                          handle
                        }
                      }
                    }
                  }
                }
              }
            }
            userErrors {
              code
              field
              message
            }
          }
        }
      `;

      const variables = {
        cartId: currentCheckout.id,
        lines: [{
          merchandiseId: variantId,
          quantity,
          attributes: customAttributes.map(attr => ({
            key: attr.key,
            value: attr.value
          }))
        }]
      };

      console.log('🛒 GraphQL mutation variables:', JSON.stringify(variables, null, 2));

      const response = await fetch(STOREFRONT_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Storefront-Access-Token': STOREFRONT_ACCESS_TOKEN
        },
        body: JSON.stringify({ query: mutation, variables })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const { data, errors } = await response.json();

      if (errors) {
        console.error('🛒 ❌ GraphQL errors:', errors);
        throw new Error(errors[0]?.message || 'GraphQL error');
      }

      if (data?.cartLinesAdd?.userErrors?.length > 0) {
        const userErrors = data.cartLinesAdd.userErrors;
        console.error('🛒 ❌ Cart user errors:', userErrors);
        throw new Error(userErrors[0]?.message || 'Cart error');
      }

      // Transform the GraphQL response to match the SDK's checkout format
      const cartData = data.cartLinesAdd.cart;
      const updatedCheckout = {
        id: cartData.id,
        webUrl: cartData.checkoutUrl,
        subtotalPrice: cartData.cost?.subtotalAmount,
        totalPrice: cartData.cost?.totalAmount,
        currencyCode: cartData.cost?.totalAmount?.currencyCode,
        lineItems: cartData.lines.edges.map(edge => ({
          id: edge.node.id,
          title: edge.node.merchandise?.product?.title || edge.node.merchandise?.title,
          quantity: edge.node.quantity,
          customAttributes: edge.node.attributes || [],
          variant: edge.node.merchandise ? {
            id: edge.node.merchandise.id,
            title: edge.node.merchandise.title,
            price: edge.node.merchandise.price?.amount,
            image: edge.node.merchandise.image ? {
              src: edge.node.merchandise.image.url,
              altText: edge.node.merchandise.image.altText
            } : null,
            product: edge.node.merchandise.product
          } : null
        }))
      };

      console.log('🛒 ✅ Successfully added to cart!', updatedCheckout);
      console.log('🛒 Line items with attributes:', updatedCheckout.lineItems.map(li => ({
        title: li.title,
        customAttributes: li.customAttributes
      })));
      setCheckout(updatedCheckout);

      return updatedCheckout;
    } catch (err) {
      console.error('🛒 ❌ Error adding to cart:', err);
      console.error('🛒 ❌ Error details:', err.message, err.stack);
      throw err;
    }
  };

  /**
   * Remove item from cart
   */
  const removeFromCart = async (lineItemId) => {
    try {
      const updatedCheckout = await client.checkout.removeLineItems(
        checkout.id,
        [lineItemId]
      );
      setCheckout(updatedCheckout);
      return updatedCheckout;
    } catch (err) {
      console.error('Error removing from cart:', err);
      throw err;
    }
  };

  /**
   * Update item quantity in cart
   */
  const updateCartItem = async (lineItemId, quantity) => {
    try {
      const lineItemsToUpdate = [{ id: lineItemId, quantity }];
      const updatedCheckout = await client.checkout.updateLineItems(
        checkout.id,
        lineItemsToUpdate
      );
      setCheckout(updatedCheckout);
      return updatedCheckout;
    } catch (err) {
      console.error('Error updating cart:', err);
      throw err;
    }
  };

  /**
   * Go to Shopify checkout via Online Store channel
   * Uses form submission so discount apps (DealEasy, Buy X Get Y) work
   */
  /**
   * Go to Shopify checkout via cart's checkoutUrl
   * This preserves line item attributes (modifiers)
   */
  const goToCheckout = async () => {
    if (!checkout?.lineItems?.length) return;

    // Use the cart's checkoutUrl to preserve line item attributes
    if (checkout.webUrl) {
      console.log('🛒 Redirecting to checkout:', checkout.webUrl);
      window.location.href = checkout.webUrl;
    } else {
      // Fallback: Build cart URL (loses attributes - not ideal)
      console.warn('🛒 No checkoutUrl available, using fallback (attributes may be lost)');
      const cartItems = checkout.lineItems.map(item => {
        const variantId = item.variant.id.split('/').pop();
        return `${variantId}:${item.quantity}`;
      }).join(',');
      window.location.href = `https://${SHOPIFY_DOMAIN}/cart/${cartItems}?redirect=checkout`;
    }
  };

  /**
   * Get cart count
   */
  const getCartCount = () => {
    if (!checkout || !checkout.lineItems) return 0;
    return checkout.lineItems.reduce((total, item) => total + item.quantity, 0);
  };

  /**
   * Get cart total
   */
  const getCartTotal = () => {
    if (!checkout) return '$0.00';
    return `$${checkout.totalPrice}`;
  };

  // Filter out test-item tagged products unless test mode is enabled
  const filteredProducts = testModeEnabled
    ? products
    : products.filter(product => {
        const hasTestTag = product.tags?.some(tag =>
          tag.toLowerCase() === 'test-item'
        );
        return !hasTestTag;
      });

  const value = {
    // Products (filtered based on test mode)
    products: filteredProducts,
    allProducts: products, // Unfiltered for admin purposes
    loading,
    error,
    fetchProducts: fetchProductsWithMetafields,

    // Test mode
    testModeEnabled,

    // Categories (top-level)
    categories,

    // Subcategories
    dessertSubcategories,
    merchandiseSubcategories,

    // Cart
    checkout,
    addToCart,
    removeFromCart,
    updateCartItem,
    goToCheckout,
    getCartCount,
    getCartTotal,

    // Client (for advanced usage)
    client
  };

  return (
    <ShopifyContext.Provider value={value}>
      {children}
    </ShopifyContext.Provider>
  );
};

/**
 * Hook to use Shopify context
 */
export const useShopify = () => {
  const context = useContext(ShopifyContext);
  if (!context) {
    throw new Error('useShopify must be used within a ShopifyProvider');
  }
  return context;
};

export default ShopifyContext;
