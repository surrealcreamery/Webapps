import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';

// Your Shopify credentials
const SHOPIFY_DOMAIN = 'surreal-9940.myshopify.com';
const STOREFRONT_ACCESS_TOKEN = '7c5bd87859d6a652f014fe891e2c49ab';

// GraphQL endpoint for fetching products with metafields
const STOREFRONT_API_URL = `https://${SHOPIFY_DOMAIN}/api/2024-04/graphql.json`;

// PWA Categories API (for image aspect ratios and DynamoDB category data)
const CATALOG_API_URL = 'https://ou6oqgnnqjo542342x64srup4q0ofoua.lambda-url.us-east-1.on.aws/';

const ShopifyContext = createContext();

export const ShopifyProvider = ({ children }) => {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [dessertSubcategories, setDessertSubcategories] = useState([]);
  const [merchandiseSubcategories, setMerchandiseSubcategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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
      // Fetch categories with parent reference for hierarchy support
      const query = `
        query getProductCategories {
          metaobjects(type: "product_category", first: 50) {
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
                    ... on Metaobject {
                      id
                      handle
                      type
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
        let parentGid = null;
        let parentHandle = null;

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
          // Check for parent metaobject reference (handles various key names)
          const normalizedKey = normalizeKey(field.key);
          const isParentField = normalizedKey === 'parent' ||
                                normalizedKey === 'parentcategory' ||
                                normalizedKey === 'parent_category' ||
                                normalizedKey === 'categoryparent' ||
                                field.key.toLowerCase().includes('parent');

          // Handle parent as resolved reference object
          if (isParentField && field.reference?.id) {
            parentGid = field.reference.id;
            parentHandle = field.reference.handle;
            fields[field.key] = { gid: parentGid, handle: parentHandle };
            console.log(`🔗 Found parent reference for ${node.handle}: ${parentHandle} (field key: "${field.key}")`);
          }
          // Handle parent as GID string value (e.g., "gid://shopify/Metaobject/123456")
          else if (isParentField && field.value && field.value.startsWith('gid://shopify/Metaobject/')) {
            parentGid = field.value;
            // Handle will be resolved after all categories are loaded
            fields[field.key] = { gid: parentGid, handle: null };
            console.log(`🔗 Found parent GID for ${node.handle}: ${parentGid} (field key: "${field.key}", will resolve handle later)`);
          }
          // Check for image reference fields (multiple possible structures)
          else if (field.reference?.image?.url) {
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

        return {
          id: node.handle,
          gid: node.id,
          handle: node.handle,
          title: title,
          description: findFieldValue('product_category_description') || findFieldValue('description') || fields.description || '',
          image: imageUrl ? { url: imageUrl } : fields.image || null,
          sortOrder: parseInt(fields.sort_order || fields.sortorder || fields['sort-order'] || fields.display_order || '999', 10),
          parentGid: parentGid,
          parentHandle: parentHandle
        };
      });

      // Build hierarchy: calculate level and ancestors for each category
      const categoryMap = new Map(cats.map(c => [c.handle, c]));
      const categoryMapByGid = new Map(cats.map(c => [c.gid, c]));

      // First pass: resolve parentHandle from parentGid where needed
      cats.forEach(cat => {
        if (cat.parentGid && !cat.parentHandle) {
          const parentCat = categoryMapByGid.get(cat.parentGid);
          if (parentCat) {
            cat.parentHandle = parentCat.handle;
            console.log(`🔗 Resolved parent for ${cat.handle}: ${cat.parentHandle} (from GID ${cat.parentGid})`);
          } else {
            console.log(`⚠️ Could not resolve parent GID for ${cat.handle}: ${cat.parentGid}`);
          }
        }
      });

      cats.forEach(cat => {
        // Build ancestor chain (from root to parent)
        const ancestors = [];
        let current = cat;
        let depth = 0;
        const maxDepth = 10;

        while ((current.parentHandle || current.parentGid) && depth < maxDepth) {
          const parent = categoryMap.get(current.parentHandle) || categoryMapByGid.get(current.parentGid);
          if (parent) {
            ancestors.unshift(parent); // Add to beginning (root first)
            current = parent;
          } else {
            break;
          }
          depth++;
        }

        cat.ancestors = ancestors;
        cat.level = ancestors.length + 1; // Level 1 = root, Level 2 = child, Level 3 = grandchild
        cat.isLeaf = !cats.some(c => c.parentHandle === cat.handle || c.parentGid === cat.gid); // No children = leaf

        // For hierarchy-based grouping: identify level 2 (subcategory) and level 3 (container)
        if (cat.level === 1) {
          cat.rootCategory = cat;
          cat.subcategory = null;
          cat.container = null;
        } else if (cat.level === 2) {
          cat.rootCategory = ancestors[0];
          cat.subcategory = cat;
          cat.container = null;
        } else if (cat.level >= 3) {
          cat.rootCategory = ancestors[0];
          cat.subcategory = ancestors[1] || ancestors[0];
          cat.container = cat; // Level 3+ = container equivalent
        }
      });

      // Sort by sortOrder
      cats.sort((a, b) => a.sortOrder - b.sortOrder);

      console.log('✅ Loaded product categories with hierarchy:', cats);
      console.log('📦 Category hierarchy:', cats.map(c => `${c.handle} (L${c.level}, parent: ${c.parentHandle || 'none'})`));

      // Debug: Show raw fields from ALL categories to find parent field
      console.log('🔍 Raw category fields from Shopify (FULL DATA):');
      data.metaobjects.edges.forEach(edge => {
        console.log(`  📁 ${edge.node.handle}:`);
        edge.node.fields.forEach(f => {
          if (f.reference) {
            console.log(`      "${f.key}": [REFERENCE] →`, f.reference);
          } else {
            console.log(`      "${f.key}": "${f.value}"`);
          }
        });
      });

      // Fetch catalog category data and use as source of truth for hierarchy, ordering, images
      try {
        const pwaResponse = await fetch(CATALOG_API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'getCategories' })
        });
        const pwaData = await pwaResponse.json();

        if (pwaData.success && pwaData.categories) {
          // Build lookups for catalog categories
          const catalogByGid = new Map();   // shopifyCategoryId → catalog category
          const catalogById = new Map();    // catalog sk (ID) → catalog category
          pwaData.categories.forEach(pwaCat => {
            const shopifyGid = pwaCat.platformIds?.shopifyCategoryId;
            if (shopifyGid) catalogByGid.set(shopifyGid, pwaCat);
            if (pwaCat.sk) catalogById.set(pwaCat.sk, pwaCat);
          });

          // Merge catalog data into Shopify categories (images, aspect ratio, hierarchy, ordering)
          cats.forEach(cat => {
            const pwaCat = catalogByGid.get(cat.gid);
            if (!pwaCat) return;

            // Merge imageAspectRatio and images
            cat.imageAspectRatio = pwaCat.imageAspectRatio || '1:1';
            if (pwaCat.image?.url) {
              cat.image = { url: pwaCat.image.url };
            }

            // Merge productOrder and position from catalog (source of truth)
            if (pwaCat.productOrder?.length) {
              cat.productOrder = pwaCat.productOrder;
            }
            if (pwaCat.position != null) {
              cat.sortOrder = pwaCat.position;
            }

            // Use catalog parentId to establish hierarchy (source of truth)
            if (pwaCat.parentId) {
              const parentCatalog = catalogById.get(pwaCat.parentId);
              if (parentCatalog) {
                const parentShopifyGid = parentCatalog.platformIds?.shopifyCategoryId;
                if (parentShopifyGid) {
                  // Find the matching Shopify category for the parent
                  const parentCat = cats.find(c => c.gid === parentShopifyGid);
                  if (parentCat) {
                    cat.parentGid = parentShopifyGid;
                    cat.parentHandle = parentCat.handle;
                    console.log(`🔗 Catalog hierarchy: ${cat.handle} → parent ${parentCat.handle}`);
                  }
                }
              }
            } else {
              // Root category in catalog — clear any Shopify parent
              cat.parentGid = null;
              cat.parentHandle = null;
            }
          });

          // Rebuild hierarchy after catalog merge (parent relationships may have changed)
          cats.forEach(cat => {
            const ancestors = [];
            let current = cat;
            let depth = 0;
            while ((current.parentHandle || current.parentGid) && depth < 10) {
              const parent = categoryMap.get(current.parentHandle) || categoryMapByGid.get(current.parentGid);
              if (parent) {
                ancestors.unshift(parent);
                current = parent;
              } else break;
              depth++;
            }
            cat.ancestors = ancestors;
            cat.level = ancestors.length + 1;
            cat.isLeaf = !cats.some(c => c.parentHandle === cat.handle || c.parentGid === cat.gid);
            if (cat.level === 1) {
              cat.rootCategory = cat;
              cat.subcategory = null;
              cat.container = null;
            } else if (cat.level === 2) {
              cat.rootCategory = ancestors[0];
              cat.subcategory = cat;
              cat.container = null;
            } else if (cat.level >= 3) {
              cat.rootCategory = ancestors[0];
              cat.subcategory = ancestors[1] || ancestors[0];
              cat.container = cat;
            }
          });

          // Re-sort by catalog position
          cats.sort((a, b) => (a.sortOrder ?? 999) - (b.sortOrder ?? 999));

          console.log('📦 Merged catalog category data (hierarchy, ordering, images) into categories');
          console.log('📦 Category hierarchy after catalog merge:', cats.map(c => `${c.handle} (L${c.level}, parent: ${c.parentHandle || 'none'})`));
        }
      } catch (pwaErr) {
        console.warn('Could not fetch catalog categories:', pwaErr);
      }

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
   * Fetch all products with metafields using GraphQL
   */
  const fetchProductsWithMetafields = async () => {
    try {
      setLoading(true);

      const query = `
        query getAllProducts($cursor: String) {
          products(first: 50, after: $cursor) {
            pageInfo {
              hasNextPage
              endCursor
            }
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
                      storeAvailability(first: 10) {
                        edges {
                          node {
                            available
                            location { id name }
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

      // Paginate through all products
      let allEdges = [];
      let cursor = null;
      let hasNextPage = true;

      while (hasNextPage) {
        const response = await fetch(STOREFRONT_API_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Shopify-Storefront-Access-Token': STOREFRONT_ACCESS_TOKEN
          },
          body: JSON.stringify({ query, variables: { cursor } })
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const { data, errors } = await response.json();

        if (errors) {
          throw new Error(errors[0].message);
        }

        allEdges.push(...data.products.edges);
        hasNextPage = data.products.pageInfo.hasNextPage;
        cursor = data.products.pageInfo.endCursor;
      }

      // Transform products
      const transformedProducts = allEdges.map(edge =>
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
    
    // Use category metafield from Shopify; fallback to productType only if it matches a known root category
    const productTypeLower = shopifyProduct.productType?.toLowerCase();
    const category = categoryHandle || productTypeLower || null;
    const isMerchandise = category === 'merchandise';
    const isDessert = category === 'desserts';
    
    // Debug: Log category assignment for ALL products
    console.log(`📦 Product "${shopifyProduct.title}" → category: "${category}" (from metafield: ${categoryHandle || 'none'}, fallback: ${productTypeLower})`);
    if (categoryData) {
      console.log(`   Category data:`, categoryData);
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
    const totalInventory = variant?.quantityAvailable ?? 0;

    // Determine if inventory is actually tracked:
    // - If availableForSale=true but quantityAvailable=0, Shopify is NOT tracking inventory
    //   (because if it were tracking, it would mark as unavailable when qty=0)
    // - If availableForSale=false and quantityAvailable=0, Shopify IS tracking and it's out of stock
    const isAvailableWithZeroQty = variant?.availableForSale && (variant?.quantityAvailable === 0 || variant?.quantityAvailable === null);
    const inventoryTracked = !isDessert && !isAvailableWithZeroQty;
    const inStock = variant?.availableForSale || isDessert;

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
      type: isMerchandise ? 'merchandise' : (isDessert ? 'dessert' : (productTypeLower || 'dessert')),
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
          hasVariantImage: hasVariantImageMf?.value === 'true',
          storeAvailability: (variantNode.storeAvailability?.edges || []).map(edge => ({
            available: edge.node.available,
            locationId: edge.node.location.id,
          })),
        };
      }),

      // Aggregate location IDs where ANY variant is available (for filtering)
      storeAvailableLocationIds: (() => {
        const ids = new Set();
        shopifyProduct.variants.edges.forEach(e => {
          (e.node.storeAvailability?.edges || []).forEach(sa => {
            if (sa.node.available) ids.add(sa.node.location.id);
          });
        });
        return [...ids];
      })(),
      
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

  // Filter out test-item tagged products unless test mode is enabled
  const filteredProducts = testModeEnabled
    ? products
    : products.filter(product => {
        const hasTestTag = product.tags?.some(tag =>
          tag.toLowerCase() === 'test-item'
        );
        return !hasTestTag;
      });

  // ═══════════════════════════════════════════════════════════════════════════
  // CATEGORY HIERARCHY HELPERS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Get a category by its handle or GID
   */
  const getCategoryByHandle = useCallback((handle) => {
    return categories.find(c => c.handle === handle || c.gid === handle);
  }, [categories]);

  /**
   * Get all categories at a specific level (1 = root, 2 = subcategory, 3 = container)
   */
  const getCategoriesByLevel = useCallback((level) => {
    return categories.filter(c => c.level === level);
  }, [categories]);

  /**
   * Get children of a category
   */
  const getCategoryChildren = useCallback((parentHandle) => {
    return categories.filter(c => c.parentHandle === parentHandle);
  }, [categories]);

  /**
   * Get leaf categories (categories with no children - these are what products are assigned to)
   */
  const getLeafCategories = useCallback(() => {
    return categories.filter(c => c.isLeaf);
  }, [categories]);

  /**
   * Get the full hierarchy path for a category (from root to category)
   */
  const getCategoryPath = useCallback((categoryHandle) => {
    const category = getCategoryByHandle(categoryHandle);
    if (!category) return [];
    return [...(category.ancestors || []), category];
  }, [getCategoryByHandle]);

  /**
   * Get level 2 categories (subcategories) under a root category
   */
  const getSubcategories = useCallback((rootCategoryHandle) => {
    return categories.filter(c =>
      c.level === 2 &&
      c.rootCategory?.handle === rootCategoryHandle
    );
  }, [categories]);

  /**
   * Get level 3 categories (containers) under a subcategory
   */
  const getContainerCategories = useCallback((subcategoryHandle) => {
    return categories.filter(c =>
      c.level === 3 &&
      c.subcategory?.handle === subcategoryHandle
    );
  }, [categories]);

  /**
   * Get hierarchy info for a product based on its category
   * Returns: { rootCategory, subcategory, container, categoryPath }
   */
  const getProductHierarchy = useCallback((product) => {
    if (!product?.category) {
      console.log(`🔍 getProductHierarchy: Product "${product?.name}" has no category`);
      return null;
    }

    const category = categories.find(c =>
      c.handle === product.category ||
      c.gid === product.category ||
      c.handle === product.categoryData?.handle
    );

    if (!category) {
      console.log(`🔍 getProductHierarchy: Product "${product.name}" category "${product.category}" NOT FOUND in categories. Available: ${categories.map(c => c.handle).join(', ')}`);
      return null;
    }

    console.log(`🔍 getProductHierarchy: Product "${product.name}" → category "${category.handle}" (L${category.level}), subcategory: ${category.subcategory?.handle || 'none'}, container: ${category.container?.handle || 'none'}`);

    return {
      category,
      rootCategory: category.rootCategory,
      subcategory: category.subcategory,
      container: category.container,
      categoryPath: [...(category.ancestors || []), category],
      level: category.level
    };
  }, [categories]);

  /**
   * Group products by their category hierarchy for display
   * Returns products organized by subcategory → container
   */
  const groupProductsByHierarchy = useCallback((productList) => {
    const grouped = {};

    productList.forEach(product => {
      const hierarchy = getProductHierarchy(product);
      if (!hierarchy) {
        // Fallback for products without hierarchy
        const key = 'uncategorized|uncategorized';
        if (!grouped[key]) {
          grouped[key] = {
            subcategory: null,
            subcategoryTitle: 'Other',
            container: null,
            containerTitle: 'Other',
            products: []
          };
        }
        grouped[key].products.push(product);
        return;
      }

      const subcategoryHandle = hierarchy.subcategory?.handle || hierarchy.rootCategory?.handle || 'other';
      const containerHandle = hierarchy.container?.handle || 'default';
      const key = `${subcategoryHandle}|${containerHandle}`;

      if (!grouped[key]) {
        grouped[key] = {
          subcategory: hierarchy.subcategory || hierarchy.rootCategory,
          subcategoryTitle: hierarchy.subcategory?.title || hierarchy.rootCategory?.title || 'Other',
          container: hierarchy.container,
          containerTitle: hierarchy.container?.title || null,
          products: []
        };
      }
      grouped[key].products.push(product);
    });

    return Object.values(grouped);
  }, [getProductHierarchy]);

  const value = {
    // Products (filtered based on test mode)
    products: filteredProducts,
    allProducts: products, // Unfiltered for admin purposes
    loading,
    error,
    fetchProducts: fetchProductsWithMetafields,

    // Test mode
    testModeEnabled,

    // Categories (with hierarchy)
    categories,

    // Category hierarchy helpers
    getCategoryByHandle,
    getCategoriesByLevel,
    getCategoryChildren,
    getLeafCategories,
    getCategoryPath,
    getSubcategories,
    getContainerCategories,
    getProductHierarchy,
    groupProductsByHierarchy,

    // Legacy subcategories (for backward compatibility)
    dessertSubcategories,
    merchandiseSubcategories,

    // Store availability (product catalog data includes storeAvailability)
    storeLocations: [],
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
