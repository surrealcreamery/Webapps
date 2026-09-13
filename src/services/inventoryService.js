const CATALOG_API_URL = 'https://ou6oqgnnqjo542342x64srup4q0ofoua.lambda-url.us-east-1.on.aws';

export async function getProductInventory(sku) {
  const res = await fetch(CATALOG_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'getProductInventory', sku }),
  });
  const data = await res.json();
  const result = typeof data.body === 'string' ? JSON.parse(data.body) : data;
  if (result.error) throw new Error(result.error);
  return result.inventory;
}

// Batch live inventory for many SKUs (storefront grid). Returns a map keyed by uppercased
// product AND variant SKU → { trackInventory, totalQuantity, inStock, byLocation }.
export async function getInventoryForSkus(skus) {
  const list = [...new Set((skus || []).filter(Boolean).map(s => String(s).toUpperCase()))];
  if (!list.length) return {};
  const res = await fetch(CATALOG_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'getInventoryForSkus', skus: list }),
  });
  const data = await res.json();
  const result = typeof data.body === 'string' ? JSON.parse(data.body) : data;
  if (result.error) throw new Error(result.error);
  return result.inventory || {};
}
