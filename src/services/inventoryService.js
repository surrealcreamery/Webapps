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
