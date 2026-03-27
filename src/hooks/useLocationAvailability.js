import { useMemo } from 'react';
import { checkLocationAvailability } from '@/state/catalog/catalogUtils';

// Check if a variant is available at the user's selected pickup location.
// Returns { available, locationName } — available=true means either no location selected
// or the variant's inventory.byLocation includes that location with stock.
export const useLocationAvailability = (variant, product, storeLocations) => {
    return useMemo(() => {
        const selectedSlug = localStorage.getItem('selectedLocation');
        return checkLocationAvailability(variant, product, storeLocations, selectedSlug);
    }, [variant?.id, variant?.inventory, product?.id, storeLocations]);
};
