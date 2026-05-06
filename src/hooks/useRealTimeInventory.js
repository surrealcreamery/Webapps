import { useState, useEffect } from 'react';
import { getProductInventory } from '@/services/inventoryService';

export const useRealTimeInventory = (productSku) => {
  const [inventory, setInventory] = useState(null);

  useEffect(() => {
    if (!productSku) return;
    let cancelled = false;

    getProductInventory(productSku)
      .then(inv => { if (!cancelled) setInventory(inv); })
      .catch(err => console.warn('[useRealTimeInventory]', err.message));

    return () => { cancelled = true; };
  }, [productSku]);

  return inventory;
};
