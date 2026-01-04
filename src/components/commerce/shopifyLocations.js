/**
 * Shopify Locations API Integration
 * 
 * NOTE: This requires Shopify Admin API access, which cannot be done from the frontend.
 * You need to create a backend endpoint that calls Shopify Admin API.
 * 
 * Setup required:
 * 1. Create a Custom App in Shopify Admin
 * 2. Get Admin API access token with 'read_locations' scope
 * 3. Create backend endpoint: /api/shopify/locations
 * 4. Backend calls this function
 */

const SHOPIFY_ADMIN_API_VERSION = '2024-01';

/**
 * Fetch all locations from Shopify (BACKEND ONLY)
 * @param {string} shopDomain - e.g., 'surreal-9940.myshopify.com'
 * @param {string} adminAccessToken - Admin API access token
 * @returns {Promise<Array>} Array of location objects
 */
export async function fetchShopifyLocations(shopDomain, adminAccessToken) {
  const url = `https://${shopDomain}/admin/api/${SHOPIFY_ADMIN_API_VERSION}/locations.json`;
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'X-Shopify-Access-Token': adminAccessToken,
      'Content-Type': 'application/json',
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch locations: ${response.statusText}`);
  }

  const data = await response.json();
  
  // Transform to our format
  return data.locations.map(location => ({
    id: location.id.toString(),
    name: location.name,
    address: `${location.address1}, ${location.city}, ${location.province} ${location.zip}`,
    city: location.city,
    province: location.province,
    zip: location.zip,
    country: location.country,
    phone: location.phone,
    active: location.active,
    // Shopify location fields
    shopifyLocationId: location.id,
    legacy: location.legacy
  }));
}

/**
 * Frontend function to fetch locations from YOUR backend endpoint
 * This is what your React app should call
 */
export async function getLocations() {
  try {
    // Call YOUR backend endpoint that wraps the Shopify Admin API
    const response = await fetch('/api/shopify/locations');
    
    if (!response.ok) {
      throw new Error('Failed to fetch locations');
    }
    
    const locations = await response.json();
    return locations;
  } catch (error) {
    console.error('Error fetching locations:', error);
    
    // Fallback to hardcoded locations if API fails
    return getDefaultLocations();
  }
}

/**
 * Default/fallback locations
 * These should match your actual Shopify locations
 * Add latitude/longitude for each location for geolocation
 */
export function getDefaultLocations() {
  return [
    {
      id: 'kips-bay',
      name: 'Kips Bay, NYC',
      address: '123 Main St, New York, NY 10016',
      phone: '(212) 555-0100',
      latitude: 40.7450,
      longitude: -73.9781,
      shopifyLocationId: null // Get from Shopify
    },
    {
      id: 'new-brunswick',
      name: 'New Brunswick, NJ',
      address: '456 George St, New Brunswick, NJ 08901',
      phone: '(732) 555-0200',
      latitude: 40.4862,
      longitude: -74.4518,
      shopifyLocationId: null // Get from Shopify
    },
    // TODO: Add your other 6 locations here with lat/lon
    // You can get coordinates from Google Maps by right-clicking the location
  ];
}

/**
 * Example backend endpoint (Node.js/Express)
 * 
 * app.get('/api/shopify/locations', async (req, res) => {
 *   try {
 *     const locations = await fetchShopifyLocations(
 *       process.env.SHOPIFY_DOMAIN,
 *       process.env.SHOPIFY_ADMIN_ACCESS_TOKEN
 *     );
 *     res.json(locations);
 *   } catch (error) {
 *     console.error('Error fetching locations:', error);
 *     res.status(500).json({ error: 'Failed to fetch locations' });
 *   }
 * });
 */
