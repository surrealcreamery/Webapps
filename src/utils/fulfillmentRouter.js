/**
 * Fulfillment Router — resolves which location should fulfill each item
 * using a waterfall: local store → warehouse → other retail locations.
 */

/**
 * Get inventory quantity for a variant at a specific location.
 * Returns Infinity for untracked inventory.
 */
export function getMaxQuantityAtLocation(variant, locationId) {
  if (!variant?.inventory?.trackInventory) return Infinity;
  const entry = variant.inventory.byLocation?.find(l => l.locationId === locationId);
  return entry?.quantity ?? 0;
}

/**
 * Resolve which location should fulfill a variant, using waterfall priority:
 * 1. Selected local store (if stock > 0)
 * 2. Warehouse locations (if stock > 0)
 * 3. Other retail locations with stock
 * 4. None (out of stock everywhere)
 *
 * @param {object} variant - Variant with inventory.byLocation, inventory.trackInventory
 * @param {string} selectedLocationId - User's selected store slug
 * @param {Array} storeLocations - All locations from locations.json
 * @param {string} preferredMethod - User's preferred fulfillment method ('pickup'|'delivery'|'shipping')
 * @returns {{ locationId, locationName, fulfillmentMethod, maxQuantity, source }}
 */
export function resolveFulfillmentLocation(variant, selectedLocationId, storeLocations, preferredMethod = 'pickup') {
  if (!variant || !storeLocations?.length) {
    return { locationId: null, locationName: null, fulfillmentMethod: preferredMethod, maxQuantity: Infinity, source: 'none' };
  }

  // If inventory isn't tracked, always available at selected location
  if (!variant.inventory?.trackInventory) {
    const local = storeLocations.find(l => l.id === selectedLocationId);
    return {
      locationId: selectedLocationId,
      locationName: local?.name || selectedLocationId,
      fulfillmentMethod: preferredMethod,
      maxQuantity: Infinity,
      source: 'local',
    };
  }

  const selectedStore = storeLocations.find(l => l.id === selectedLocationId);
  const warehouses = storeLocations.filter(l => l.type === 'Warehouse');
  const otherRetail = storeLocations.filter(l => l.type !== 'Warehouse' && l.id !== selectedLocationId);

  // Step 1: Check selected local store
  if (selectedStore && selectedStore.type !== 'Warehouse') {
    const localQty = getMaxQuantityAtLocation(variant, selectedLocationId);
    if (localQty > 0) {
      return {
        locationId: selectedLocationId,
        locationName: selectedStore.name,
        fulfillmentMethod: preferredMethod,
        maxQuantity: localQty,
        source: 'local',
      };
    }
  }

  // Step 2: Check warehouses (only if shipping enabled at that warehouse)
  for (const wh of warehouses) {
    if (wh.disableShipping) continue;
    const whQty = getMaxQuantityAtLocation(variant, wh.id);
    if (whQty > 0) {
      return {
        locationId: wh.id,
        locationName: wh.name,
        fulfillmentMethod: 'shipping',
        maxQuantity: whQty,
        source: 'warehouse',
      };
    }
  }

  // Step 3: Check other retail locations (only if shipping enabled at that location)
  for (const loc of otherRetail) {
    if (loc.disableShipping) continue;
    const locQty = getMaxQuantityAtLocation(variant, loc.id);
    if (locQty > 0) {
      return {
        locationId: loc.id,
        locationName: loc.name,
        fulfillmentMethod: 'shipping',
        maxQuantity: locQty,
        source: 'retail_fallback',
      };
    }
  }

  // Step 4: Out of stock everywhere
  return {
    locationId: null,
    locationName: null,
    fulfillmentMethod: preferredMethod,
    maxQuantity: 0,
    source: 'none',
  };
}

/**
 * Group cart items by their fulfillment origin location.
 *
 * @param {Array} cart - Cart items (each should have fulfillmentLocationId)
 * @param {Array} storeLocations - All locations
 * @returns {{ groups: Array<{ locationId, locationName, items, fulfillmentMethod }>, requiresSplitShipping }}
 */
export function groupCartByFulfillmentOrigin(cart, storeLocations) {
  const groupMap = {};

  for (const item of cart) {
    const locId = item.fulfillmentLocationId || '_local';
    if (!groupMap[locId]) {
      const loc = storeLocations?.find(l => l.id === locId);
      groupMap[locId] = {
        locationId: locId === '_local' ? null : locId,
        locationName: loc?.name || (locId === '_local' ? 'Local Store' : locId),
        fulfillmentMethod: item.fulfillmentMethod || 'pickup',
        items: [],
      };
    }
    groupMap[locId].items.push(item);
  }

  const groups = Object.values(groupMap);

  // Split shipping is needed when there are multiple groups that require shipping
  const shippingGroups = groups.filter(g => g.fulfillmentMethod === 'shipping');
  const requiresSplitShipping = shippingGroups.length > 1;

  return { groups, requiresSplitShipping };
}
