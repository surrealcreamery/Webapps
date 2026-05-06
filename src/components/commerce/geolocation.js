/**
 * IP-based Geolocation (No permissions needed)
 * Uses multiple providers with fallback and caching
 */

const CACHE_KEY = 'user_geolocation';
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

/**
 * Get cached location from sessionStorage
 */
function getCachedLocation() {
  try {
    const cached = sessionStorage.getItem(CACHE_KEY);
    if (!cached) return null;

    const { data, timestamp } = JSON.parse(cached);
    if (Date.now() - timestamp > CACHE_DURATION) {
      sessionStorage.removeItem(CACHE_KEY);
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

/**
 * Cache location in sessionStorage
 */
function cacheLocation(data) {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({
      data,
      timestamp: Date.now()
    }));
  } catch {
    // Ignore storage errors
  }
}

/**
 * Get user's approximate location from IP address
 * Uses caching and multiple providers for reliability
 * @returns {Promise<Object>} Location data { city, region, postal, latitude, longitude }
 */
export async function getLocationFromIP() {
  // Check cache first
  const cached = getCachedLocation();
  if (cached) {
    console.log('[Geolocation] Using cached location:', cached.city);
    return cached;
  }

  const providers = [
    {
      name: 'ipwho.is',
      url: 'https://ipwho.is/',
      parse: (data) => data.success ? {
        city: data.city, region: data.region, regionCode: data.region_code,
        postal: data.postal, country: data.country, countryCode: data.country_code,
        latitude: data.latitude, longitude: data.longitude, timezone: data.timezone?.id
      } : null
    },
    {
      name: 'ipapi.co',
      url: 'https://ipapi.co/json/',
      parse: (data) => !data.error ? {
        city: data.city, region: data.region, regionCode: data.region_code,
        postal: data.postal, country: data.country_name, countryCode: data.country_code,
        latitude: data.latitude, longitude: data.longitude, timezone: data.timezone
      } : null
    },
    {
      name: 'ip-api.com',
      url: 'http://ip-api.com/json/?fields=status,city,region,regionName,zip,country,countryCode,lat,lon,timezone',
      parse: (data) => data.status === 'success' ? {
        city: data.city, region: data.regionName, regionCode: data.region,
        postal: data.zip, country: data.country, countryCode: data.countryCode,
        latitude: data.lat, longitude: data.lon, timezone: data.timezone
      } : null
    }
  ];

  for (const provider of providers) {
    try {
      const response = await fetch(provider.url);
      if (response.ok) {
        const data = await response.json();
        const location = provider.parse(data);
        if (location && location.latitude) {
          cacheLocation(location);
          console.log(`[Geolocation] Location from ${provider.name}:`, location.city, location.regionCode);
          return location;
        }
      }
      console.warn(`[Geolocation] ${provider.name}: bad response (status ${response.status})`);
    } catch (error) {
      console.warn(`[Geolocation] ${provider.name} failed:`, error.message);
    }
  }

  console.error('[Geolocation] All providers failed');
  return null;
}

/**
 * Calculate distance between two points (Haversine formula)
 * @param {number} lat1 
 * @param {number} lon1 
 * @param {number} lat2 
 * @param {number} lon2 
 * @returns {number} Distance in miles
 */
export function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 3959; // Earth's radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const distance = R * c;
  
  return distance;
}

/**
 * Format distance for display
 * @param {number} miles - Distance in miles
 * @returns {string} Formatted distance (e.g., "2.5 mi" or "0.3 mi")
 */
export function formatDistance(miles) {
  if (miles < 0.1) {
    return '< 0.1 mi';
  } else if (miles < 10) {
    return `${miles.toFixed(1)} mi`;
  } else {
    return `${Math.round(miles)} mi`;
  }
}

/**
 * Get all stores with distances from user's IP location
 * @param {Array} locations - Array of store locations with lat/lon
 * @returns {Promise<Array>} Locations with distance added, sorted by nearest
 */
export async function getStoresWithDistances(locations) {
  try {
    const userLocation = await getLocationFromIP();
    
    if (!userLocation || !userLocation.latitude) {
      console.log('Could not determine user location');
      return locations.map(loc => ({ ...loc, distance: null, distanceText: null }));
    }
    
    console.log('User location detected:', userLocation.city, userLocation.region);
    
    // Calculate distances to all stores
    const locationsWithDistance = locations.map(location => {
      if (!location.latitude || !location.longitude) {
        return { ...location, distance: null, distanceText: null };
      }
      
      const distance = calculateDistance(
        userLocation.latitude,
        userLocation.longitude,
        location.latitude,
        location.longitude
      );
      
      return { 
        ...location, 
        distance,
        distanceText: formatDistance(distance)
      };
    });
    
    // Sort by distance (nearest first)
    locationsWithDistance.sort((a, b) => {
      if (a.distance === null) return 1;
      if (b.distance === null) return -1;
      return a.distance - b.distance;
    });
    
    return locationsWithDistance;
  } catch (error) {
    console.error('Error calculating distances:', error);
    return locations.map(loc => ({ ...loc, distance: null, distanceText: null }));
  }
}

/**
 * Find nearest store location based on user's IP location
 * @param {Array} locations - Array of store locations with lat/lon
 * @returns {Promise<Object>} Nearest location with distance
 */
export async function findNearestStore(locations, maxDistance = 25) {
  try {
    const storesWithDistances = await getStoresWithDistances(locations);
    const nearest = storesWithDistances[0];

    if (nearest.distance !== null) {
      console.log(`Nearest store: ${nearest.name} (${nearest.distanceText} away)`);
      if (nearest.distance > maxDistance) {
        console.log(`Nearest store is ${nearest.distanceText} away (>${maxDistance} mi) — no auto-selection`);
        return null;
      }
    }

    return nearest;
  } catch (error) {
    console.error('Error finding nearest store:', error);
    return null;
  }
}

/**
 * Initialize location selection with geolocation
 * Call this on app load
 */
export async function initializeLocationSelection(locations, maxDistance = 25) {
  // Check if user has previously selected a location
  const savedLocationId = localStorage.getItem('selectedLocation');
  
  if (savedLocationId) {
    console.log('Using saved location:', savedLocationId);
    const savedLocation = locations.find(loc => loc.id === savedLocationId);
    if (savedLocation) {
      // Still calculate distance for the saved location
      const userLocation = await getLocationFromIP();
      if (userLocation?.latitude && savedLocation.latitude) {
        const distance = calculateDistance(
          userLocation.latitude,
          userLocation.longitude,
          savedLocation.latitude,
          savedLocation.longitude
        );
        return { 
          ...savedLocation, 
          distance, 
          distanceText: formatDistance(distance) 
        };
      }
      return savedLocation;
    }
  }
  
  // No saved location - use IP geolocation to find nearest
  console.log('No saved location, detecting nearest store...');
  const nearest = await findNearestStore(locations, maxDistance);
  if (nearest) {
    // Auto-select and save for future visits
    localStorage.setItem('selectedLocation', nearest.id);
  }
  return nearest; // null if too far away — consumer app shows "Select Location"
}

/**
 * Delivery rate tiers based on distance
 * Customize these rates based on your business needs
 */
const DELIVERY_RATE_TIERS = [
  { maxMiles: 2, fee: 3.99, label: 'Near' },
  { maxMiles: 4, fee: 5.99, label: 'Local' },
  { maxMiles: 6, fee: 7.99, label: 'Extended' },
  { maxMiles: 8, fee: 9.99, label: 'Far' },
  { maxMiles: 20, fee: 19.99, label: 'Test' }, // TODO: Remove after testing
];

const MAX_DELIVERY_DISTANCE = 20; // miles (TODO: Change back to 8 after testing)

/**
 * Get delivery fee estimate based on distance
 * @param {number} distanceMiles - Distance in miles
 * @returns {Object|null} Delivery estimate or null if out of range
 */
export function getDeliveryFeeForDistance(distanceMiles) {
  if (distanceMiles > MAX_DELIVERY_DISTANCE) {
    return null;
  }
  
  const tier = DELIVERY_RATE_TIERS.find(t => distanceMiles <= t.maxMiles);
  
  if (!tier) {
    return null;
  }
  
  return {
    fee: tier.fee,
    feeText: `$${tier.fee.toFixed(2)}`,
    tier: tier.label,
    maxDistance: MAX_DELIVERY_DISTANCE
  };
}

/**
 * Get delivery estimate for user's IP location to a specific store
 * @param {Object} storeLocation - Store with latitude/longitude
 * @returns {Promise<Object>} Delivery estimate with availability, fee, distance
 */
export async function getDeliveryEstimate(storeLocation) {
  try {
    if (!storeLocation?.latitude || !storeLocation?.longitude) {
      console.log('Store location missing coordinates');
      return { available: false, reason: 'store_no_coords' };
    }
    
    const userLocation = await getLocationFromIP();
    
    if (!userLocation?.latitude || !userLocation?.longitude) {
      console.log('Could not determine user location');
      return { available: false, reason: 'user_location_unknown' };
    }
    
    const distance = calculateDistance(
      userLocation.latitude,
      userLocation.longitude,
      storeLocation.latitude,
      storeLocation.longitude
    );
    
    const deliveryFee = getDeliveryFeeForDistance(distance);
    
    if (!deliveryFee) {
      return {
        available: false,
        reason: 'out_of_range',
        distance,
        distanceText: formatDistance(distance),
        maxDistance: MAX_DELIVERY_DISTANCE,
        userCity: userLocation.city,
        userRegion: userLocation.regionCode
      };
    }
    
    return {
      available: true,
      fee: deliveryFee.fee,
      feeText: deliveryFee.feeText,
      tier: deliveryFee.tier,
      distance,
      distanceText: formatDistance(distance),
      storeName: storeLocation.name,
      userCity: userLocation.city,
      userRegion: userLocation.regionCode
    };
  } catch (error) {
    console.error('Error getting delivery estimate:', error);
    return { available: false, reason: 'error', error: error.message };
  }
}

/**
 * Get delivery estimates for multiple stores
 * Returns the best (cheapest/nearest) delivery option
 * @param {Array} locations - Array of store locations
 * @returns {Promise<Object>} Best delivery estimate
 */
export async function getBestDeliveryEstimate(locations) {
  try {
    const userLocation = await getLocationFromIP();
    
    if (!userLocation?.latitude) {
      return { available: false, reason: 'user_location_unknown' };
    }
    
    // Calculate delivery estimates for all stores
    const estimates = locations
      .filter(loc => loc.latitude && loc.longitude)
      .map(location => {
        const distance = calculateDistance(
          userLocation.latitude,
          userLocation.longitude,
          location.latitude,
          location.longitude
        );
        
        const deliveryFee = getDeliveryFeeForDistance(distance);
        
        return {
          location,
          distance,
          distanceText: formatDistance(distance),
          deliveryFee,
          available: deliveryFee !== null
        };
      })
      .sort((a, b) => a.distance - b.distance);
    
    // Find the best available delivery option (nearest with delivery available)
    const bestOption = estimates.find(e => e.available);
    
    if (!bestOption) {
      // No delivery available, return nearest store info
      const nearest = estimates[0];
      return {
        available: false,
        reason: 'out_of_range',
        nearestStore: nearest?.location?.name,
        distance: nearest?.distance,
        distanceText: nearest?.distanceText,
        maxDistance: MAX_DELIVERY_DISTANCE,
        userCity: userLocation.city
      };
    }
    
    return {
      available: true,
      fee: bestOption.deliveryFee.fee,
      feeText: bestOption.deliveryFee.feeText,
      tier: bestOption.deliveryFee.tier,
      distance: bestOption.distance,
      distanceText: bestOption.distanceText,
      storeName: bestOption.location.name,
      storeId: bestOption.location.id,
      userCity: userLocation.city,
      userRegion: userLocation.regionCode
    };
  } catch (error) {
    console.error('Error getting best delivery estimate:', error);
    return { available: false, reason: 'error' };
  }
}

/**
 * Shipping estimate tiers based on distance from fulfillment center
 * Customize based on your actual shipping carrier performance
 */
const SHIPPING_TIERS = [
  { maxMiles: 100, minDays: 2, maxDays: 3, label: 'Local' },
  { maxMiles: 300, minDays: 3, maxDays: 4, label: 'Regional' },
  { maxMiles: 800, minDays: 4, maxDays: 5, label: 'Standard' },
  { maxMiles: 1500, minDays: 5, maxDays: 7, label: 'Extended' },
  { maxMiles: 3000, minDays: 6, maxDays: 8, label: 'Cross-Country' },
  { maxMiles: Infinity, minDays: 7, maxDays: 10, label: 'Remote' },
];

/**
 * Get shipping time estimate for a given distance
 * @param {number} distanceMiles - Distance in miles
 * @returns {Object} Shipping estimate
 */
export function getShippingTimeForDistance(distanceMiles) {
  const tier = SHIPPING_TIERS.find(t => distanceMiles <= t.maxMiles);
  
  if (!tier) {
    return SHIPPING_TIERS[SHIPPING_TIERS.length - 1]; // Return last tier as fallback
  }
  
  return {
    minDays: tier.minDays,
    maxDays: tier.maxDays,
    label: tier.label,
    estimateText: tier.minDays === tier.maxDays 
      ? `${tier.minDays} business days`
      : `${tier.minDays}-${tier.maxDays} business days`
  };
}

/**
 * Get shipping estimate based on user's IP location and nearest store
 * Ships from the closest store to the customer
 * @param {Array} locations - Array of store locations with lat/lng
 * @returns {Promise<Object>} Shipping estimate with time and distance info
 */
export async function getShippingEstimate(locations) {
  try {
    const userLocation = await getLocationFromIP();
    
    if (!userLocation?.latitude || !userLocation?.longitude) {
      console.log('Could not determine user location for shipping estimate');
      return { 
        available: true,
        estimateText: '5-7 business days',
        minDays: 5,
        maxDays: 7,
        label: 'Standard',
        reason: 'default_estimate'
      };
    }
    
    // Find the nearest store to ship from
    const storesWithDistance = locations
      .filter(loc => loc.latitude && loc.longitude)
      .map(location => {
        const distance = calculateDistance(
          userLocation.latitude,
          userLocation.longitude,
          location.latitude,
          location.longitude
        );
        return { ...location, distance };
      })
      .sort((a, b) => a.distance - b.distance);
    
    const nearestStore = storesWithDistance[0];
    
    if (!nearestStore) {
      return { 
        available: true,
        estimateText: '5-7 business days',
        minDays: 5,
        maxDays: 7,
        label: 'Standard',
        reason: 'no_stores'
      };
    }
    
    const shippingTime = getShippingTimeForDistance(nearestStore.distance);
    
    console.log(`📦 Shipping estimate: ${shippingTime.estimateText} (${formatDistance(nearestStore.distance)} from ${nearestStore.name})`);
    
    return {
      available: true,
      ...shippingTime,
      distance: nearestStore.distance,
      distanceText: formatDistance(nearestStore.distance),
      shipsFrom: nearestStore.name,
      shipsFromId: nearestStore.id,
      userCity: userLocation.city,
      userRegion: userLocation.regionCode,
      userState: userLocation.region
    };
  } catch (error) {
    console.error('Error getting shipping estimate:', error);
    return { 
      available: true,
      estimateText: '5-7 business days',
      minDays: 5,
      maxDays: 7,
      label: 'Standard',
      reason: 'error_fallback'
    };
  }
}

/**
 * Get estimated delivery date range
 * @param {number} minDays - Minimum business days
 * @param {number} maxDays - Maximum business days
 * @returns {Object} Date range with formatted strings
 */
export function getEstimatedDeliveryDates(minDays, maxDays) {
  const addBusinessDays = (date, days) => {
    let result = new Date(date);
    let added = 0;
    while (added < days) {
      result.setDate(result.getDate() + 1);
      // Skip weekends (0 = Sunday, 6 = Saturday)
      if (result.getDay() !== 0 && result.getDay() !== 6) {
        added++;
      }
    }
    return result;
  };
  
  const today = new Date();
  const minDate = addBusinessDays(today, minDays);
  const maxDate = addBusinessDays(today, maxDays);
  
  const formatOptions = { weekday: 'short', month: 'short', day: 'numeric' };
  
  return {
    minDate,
    maxDate,
    minDateText: minDate.toLocaleDateString('en-US', formatOptions),
    maxDateText: maxDate.toLocaleDateString('en-US', formatOptions),
    rangeText: minDays === maxDays
      ? minDate.toLocaleDateString('en-US', formatOptions)
      : `${minDate.toLocaleDateString('en-US', formatOptions)} - ${maxDate.toLocaleDateString('en-US', formatOptions)}`
  };
}
