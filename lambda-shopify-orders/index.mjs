/**
 * Shopify to Square/Shipday Lambda
 * Multi-location delivery dispatch with DynamoDB audit logging
 * Config loaded from DynamoDB with environment variable fallback
 */

import { Client, Environment } from 'square';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { broadcastNewOrder } from './broadcast.mjs';
import { getConfig, getConfigValue } from './config.mjs';
import crypto from 'crypto';

// Initialize DynamoDB client
const ddbClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(ddbClient);
const TABLE_NAME = 'surreal-orders';

/**
 * Verify Shopify webhook HMAC signature
 * @param {string} body - Raw request body
 * @param {string} hmacHeader - X-Shopify-Hmac-Sha256 header value
 * @returns {Promise<boolean>} Whether the signature is valid
 */
async function verifyShopifyWebhook(body, hmacHeader) {
  if (!hmacHeader) {
    console.log('No HMAC header provided');
    return false;
  }

  const webhookSecret = await getConfigValue('SHOPIFY_WEBHOOK_SECRET');
  if (!webhookSecret) {
    console.warn('SHOPIFY_WEBHOOK_SECRET not configured - skipping HMAC verification');
    return true; // Allow if not configured (for backwards compatibility during setup)
  }

  const calculatedHmac = crypto
    .createHmac('sha256', webhookSecret)
    .update(body, 'utf8')
    .digest('base64');

  const isValid = crypto.timingSafeEqual(
    Buffer.from(calculatedHmac),
    Buffer.from(hmacHeader)
  );

  if (!isValid) {
    console.log('HMAC verification failed');
    console.log('Expected:', calculatedHmac);
    console.log('Received:', hmacHeader);
  }

  return isValid;
}

// Square client cache - keyed by access token to support per-location credentials
const squareClientCache = new Map();

/**
 * Get or initialize Square client with config from DynamoDB or per-location credentials
 * @param {string} locationAccessToken - Optional access token from linked location
 */
async function getSquareClient(locationAccessToken = null) {
  let accessToken = locationAccessToken;

  // Fall back to global config if no location-specific token
  if (!accessToken) {
    accessToken = await getConfigValue('SQUARE_ACCESS_TOKEN');
  }

  if (!accessToken) {
    throw new Error('SQUARE_ACCESS_TOKEN not configured in DynamoDB or location secrets');
  }

  // Check cache for existing client with this token
  if (!squareClientCache.has(accessToken)) {
    squareClientCache.set(accessToken, new Client({
      accessToken,
      environment: Environment.Production,
    }));
  }

  return squareClientCache.get(accessToken);
}

/**
 * Get Shopify credentials from location secrets or fall back to DynamoDB/environment
 * @param {Object} locationCredentials - Optional credentials from linked location
 */
async function getShopifyCredentials(locationCredentials = null) {
  // Prefer location-specific credentials if provided
  if (locationCredentials?.shopifyAccessToken && locationCredentials?.shopifyStoreDomain) {
    return {
      SHOPIFY_ACCESS_TOKEN: locationCredentials.shopifyAccessToken,
      SHOPIFY_STORE_DOMAIN: locationCredentials.shopifyStoreDomain,
    };
  }
  // Fall back to global config
  return await getConfig(['SHOPIFY_STORE_DOMAIN', 'SHOPIFY_ACCESS_TOKEN']);
}

/**
 * Look up linked Square and Shipday locations from DynamoDB
 * @param {string} shopifyLocationId - The Shopify location ID
 * @param {string} locationName - The location name (for matching)
 * @returns {Object} { squareLocationId, shipdayApiKey, name } or throws error
 */
async function getLinkedLocationConfig(shopifyLocationId, locationName) {
  const { ScanCommand } = await import('@aws-sdk/lib-dynamodb');
  const CONFIG_TABLE = 'surreal-admin-config';

  console.log(`Looking up linked locations for Shopify location: ${shopifyLocationId} (${locationName})`);

  // Get all locations from DynamoDB
  const result = await docClient.send(new ScanCommand({
    TableName: CONFIG_TABLE,
    FilterExpression: 'pk = :pk',
    ExpressionAttributeValues: { ':pk': 'LOCATION' },
  }));

  const locations = result.Items || [];
  console.log(`Found ${locations.length} locations in DynamoDB`);

  // Find the Shopify location by ID or name
  const shopifyLocation = locations.find(loc =>
    loc.platform === 'shopify' &&
    (loc.platformId === String(shopifyLocationId) ||
     loc.sk === `SHOPIFY#${shopifyLocationId}` ||
     (locationName && loc.name?.toLowerCase() === locationName.toLowerCase()))
  );

  if (!shopifyLocation) {
    console.error(`Shopify location not found in DynamoDB: ${shopifyLocationId} (${locationName})`);
    throw new Error(`Shopify location "${locationName || shopifyLocationId}" not configured. Please set up location linking in Settings.`);
  }

  console.log(`Found Shopify location: ${shopifyLocation.name} with links:`, Object.keys(shopifyLocation.links || {}));

  if (!shopifyLocation.links || Object.keys(shopifyLocation.links).length === 0) {
    throw new Error(`Shopify location "${shopifyLocation.name}" has no linked locations. Please link it to Square and Shipday in Settings.`);
  }

  // Get Shopify credentials from location secrets
  const shopifyAccessToken = shopifyLocation.secrets?.accessToken;
  const shopifyStoreDomain = shopifyLocation.secrets?.storeDomain;

  if (!shopifyAccessToken || !shopifyStoreDomain) {
    console.warn(`Shopify location "${shopifyLocation.name}" missing credentials in secrets, will fall back to config`);
  }

  // Find linked Square and Shipday locations
  let squareLocationId = null;
  let squareAccessToken = null;
  let shipdayApiKey = null;

  for (const linkedSk of Object.keys(shopifyLocation.links)) {
    const linkedLoc = locations.find(loc => loc.sk === linkedSk);
    if (!linkedLoc) continue;

    if (linkedLoc.platform === 'square' && linkedLoc.platformId) {
      squareLocationId = linkedLoc.platformId;
      squareAccessToken = linkedLoc.secrets?.accessToken;
      console.log(`Found linked Square location: ${linkedLoc.name} (${squareLocationId})`);
    }

    if (linkedLoc.platform === 'shipday') {
      shipdayApiKey = linkedLoc.secrets?.apiKey || linkedLoc.platformId;
      console.log(`Found linked Shipday location: ${linkedLoc.name}`);
    }
  }

  if (!squareLocationId) {
    throw new Error(`Shopify location "${shopifyLocation.name}" has no linked Square location. Please link it in Settings.`);
  }

  if (!shipdayApiKey) {
    throw new Error(`Shopify location "${shopifyLocation.name}" has no linked Shipday location. Please link it in Settings.`);
  }

  return {
    shopifyLocationId,
    squareLocationId,
    shipdayApiKey,
    name: shopifyLocation.name,
    // Credentials from location secrets
    shopifyAccessToken,
    shopifyStoreDomain,
    squareAccessToken,
  };
}

/**
 * Fetch exact transaction fees from Shopify GraphQL API
 * @param {string} orderId - Shopify order ID
 * @param {Object} locationCredentials - Optional credentials from linked location
 */
async function fetchShopifyTransactionFees(orderId, locationCredentials = null) {
  const { SHOPIFY_STORE_DOMAIN, SHOPIFY_ACCESS_TOKEN } = await getShopifyCredentials(locationCredentials);

  const shopifyGid = `gid://shopify/Order/${orderId}`;

  const query = `{
    order(id: "${shopifyGid}") {
      id
      name
      totalPriceSet {
        shopMoney {
          amount
        }
      }
      transactions {
        id
        kind
        status
        amountSet {
          shopMoney {
            amount
          }
        }
        fees {
          amount {
            amount
          }
          type
        }
      }
    }
  }`;

  const response = await fetch(`https://${SHOPIFY_STORE_DOMAIN}/admin/api/2024-01/graphql.json`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN,
    },
    body: JSON.stringify({ query }),
  });

  if (!response.ok) {
    throw new Error(`Shopify GraphQL error: ${response.status}`);
  }

  const result = await response.json();

  if (result.errors) {
    console.error('GraphQL errors:', result.errors);
    throw new Error(`GraphQL errors: ${JSON.stringify(result.errors)}`);
  }

  const order = result.data?.order;
  if (!order) {
    throw new Error('Order not found in Shopify');
  }

  // Find the successful sale transaction
  const saleTransaction = order.transactions?.find(
    t => t.kind === 'SALE' && t.status === 'SUCCESS'
  );

  if (!saleTransaction) {
    console.warn('No successful sale transaction found, using order total as gross');
    const grossAmount = parseFloat(order.totalPriceSet.shopMoney.amount);
    return {
      grossAmount,
      fee: 0,
      netAmount: grossAmount,
      transactionId: null,
    };
  }

  const grossAmount = parseFloat(saleTransaction.amountSet.shopMoney.amount);
  const fee = saleTransaction.fees?.reduce((sum, f) => sum + parseFloat(f.amount.amount), 0) || 0;
  const netAmount = grossAmount - fee;

  return {
    grossAmount,
    fee,
    netAmount,
    transactionId: saleTransaction.id,
  };
}

/**
 * Determine fulfillment location from Shopify order
 * Gets location from fulfillment_orders API, then looks up linked Square/Shipday from DynamoDB
 */
async function determineFulfillmentLocation(shopifyOrder) {
  const { SHOPIFY_STORE_DOMAIN, SHOPIFY_ACCESS_TOKEN } = await getShopifyCredentials();

  if (!SHOPIFY_STORE_DOMAIN || !SHOPIFY_ACCESS_TOKEN) {
    throw new Error('Shopify credentials not configured in DynamoDB');
  }

  // Get the fulfillment location from Shopify
  const url = `https://${SHOPIFY_STORE_DOMAIN}/admin/api/2024-01/orders/${shopifyOrder.id}/fulfillment_orders.json`;
  console.log(`Fetching fulfillment orders from: ${url}`);

  const response = await fetch(url, {
    headers: {
      'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to get fulfillment orders: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const fulfillmentOrders = data.fulfillment_orders || [];

  if (fulfillmentOrders.length === 0) {
    throw new Error('No fulfillment orders found for this order. Check Shopify app permissions.');
  }

  const fulfillmentOrder = fulfillmentOrders[0];
  const assignedLocation = fulfillmentOrder.assigned_location;
  const locationId = fulfillmentOrder.assigned_location_id;
  const locationName = assignedLocation?.name;

  console.log(`Found fulfillment location: ${locationId} - ${locationName}`);

  // Look up linked Square and Shipday locations from DynamoDB
  return await getLinkedLocationConfig(locationId, locationName);
}

/**
 * Create order in Square with external payment
 */
async function createSquareOrder(shopifyOrder, locationConfig, feeData) {
  const { squareLocationId } = locationConfig;

  // Build line items from Shopify order
  const lineItems = shopifyOrder.line_items.map(item => {
    // Parse Square catalog data from _square_catalog property
    const squareCatalogProp = item.properties?.find(p => p.name === '_square_catalog');
    let squareModifiers = [];

    if (squareCatalogProp?.value) {
      try {
        const catalogData = JSON.parse(squareCatalogProp.value);
        if (catalogData.modifiers && Array.isArray(catalogData.modifiers)) {
          squareModifiers = catalogData.modifiers.map(mod => ({
            catalogObjectId: mod.modifierId,
            name: mod.modifierName,
            basePriceMoney: {
              amount: BigInt(Math.round((mod.price || 0) * 100)),
              currency: 'USD',
            },
          }));
        }
      } catch (e) {
        console.error('Failed to parse _square_catalog:', e);
      }
    }

    // Build note from non-hidden properties (for display)
    const noteParts = [];
    if (item.properties && item.properties.length > 0) {
      item.properties.forEach(prop => {
        if (prop.name && prop.value && !prop.name.startsWith('_')) {
          noteParts.push(`${prop.name}: ${prop.value}`);
        }
      });
    }

    const lineItem = {
      name: item.name,
      quantity: String(item.quantity),
      basePriceMoney: {
        amount: BigInt(Math.round(parseFloat(item.price) * 100)),
        currency: 'USD',
      },
    };

    if (squareModifiers.length > 0) {
      lineItem.modifiers = squareModifiers;
    }

    if (noteParts.length > 0) {
      lineItem.note = noteParts.join('\n');
    }

    return lineItem;
  });

  // Add shipping as a line item if present
  if (shopifyOrder.shipping_lines?.length > 0) {
    const shipping = shopifyOrder.shipping_lines[0];
    lineItems.push({
      name: `Delivery: ${shipping.title}`,
      quantity: '1',
      basePriceMoney: {
        amount: BigInt(Math.round(parseFloat(shipping.price) * 100)),
        currency: 'USD',
      },
    });
  }

  // Create Square order
  const orderRequest = {
    order: {
      locationId: squareLocationId,
      referenceId: shopifyOrder.order_number?.toString() || shopifyOrder.name,
      lineItems,
      fulfillments: [
        {
          type: 'PICKUP',
          state: 'PROPOSED',
          pickupDetails: {
            recipient: {
              displayName: `${shopifyOrder.shipping_address?.first_name || ''} ${shopifyOrder.shipping_address?.last_name || ''}`.trim() || 'Customer',
              phoneNumber: shopifyOrder.shipping_address?.phone || shopifyOrder.phone || '',
            },
            note: `Shopify #${shopifyOrder.order_number} - DELIVERY to ${shopifyOrder.shipping_address?.address1 || 'address'}\n\n⚠️ Tap 'Dispatch' on Shipday App when order is made`,
            scheduleType: 'ASAP',
          },
        },
      ],
      ticketName: `#${shopifyOrder.order_number} ${shopifyOrder.shipping_address?.first_name || 'Customer'}`,
    },
    idempotencyKey: `order-${shopifyOrder.id}`,
  };

  console.log('Creating Square order:', JSON.stringify(orderRequest, (key, value) =>
    typeof value === 'bigint' ? Number(value) : value
  ));

  // Use location-specific credentials if available
  const client = await getSquareClient(locationConfig.squareAccessToken);
  const result = await client.ordersApi.createOrder(orderRequest);
  console.log('Square order created:', result.result.order.id);

  // Update fulfillment to RESERVED to show on KDS
  const updateRequest = {
    order: {
      locationId: squareLocationId,
      version: result.result.order.version,
      fulfillments: [
        {
          uid: result.result.order.fulfillments[0].uid,
          state: 'RESERVED',
        },
      ],
    },
    idempotencyKey: `update-${shopifyOrder.id}`,
  };

  const updateResult = await client.ordersApi.updateOrder(
    result.result.order.id,
    updateRequest
  );
  console.log('Square order updated to RESERVED');

  // Create external payment for GROSS amount (must match order total exactly)
  // Square SDK v35 returns amount as BigInt - use it directly
  const orderTotalMoney = updateResult.result.order.totalMoney;
  const orderTotal = orderTotalMoney.amount;
  const orderCurrency = orderTotalMoney.currency;

  console.log(`Square order total: ${orderTotal} ${orderCurrency}`);
  console.log(`Order total type: ${typeof orderTotal}`);

  // Use the exact amount from Square's order response - already BigInt in SDK v35
  const paymentAmount = typeof orderTotal === 'bigint' ? orderTotal : BigInt(String(orderTotal));

  console.log(`Creating payment for: ${paymentAmount} cents`);

  const paymentRequest = {
    sourceId: 'EXTERNAL',
    idempotencyKey: `pay-${shopifyOrder.id}-${Date.now()}`,
    amountMoney: {
      amount: paymentAmount,
      currency: orderCurrency,
    },
    orderId: result.result.order.id,
    locationId: squareLocationId,
    externalDetails: {
      type: 'OTHER',
      source: `Shopify #${shopifyOrder.order_number} (Gross: $${feeData.grossAmount.toFixed(2)}, Fee: $${feeData.fee.toFixed(2)}, Net: $${feeData.netAmount.toFixed(2)})`,
    },
  };

  console.log('Creating Square payment:', JSON.stringify(paymentRequest, (key, value) =>
    typeof value === 'bigint' ? Number(value) : value
  ));

  const paymentResult = await client.paymentsApi.createPayment(paymentRequest);
  console.log('Square payment created:', paymentResult.result.payment.id);

  return {
    orderId: result.result.order.id,
    paymentId: paymentResult.result.payment.id,
  };
}

/**
 * Create delivery order in Shipday
 */
async function createShipdayOrder(shopifyOrder, locationConfig, squareOrderId) {
  const { shipdayApiKey } = locationConfig;

  const shipdayOrder = {
    orderNumber: shopifyOrder.order_number?.toString() || shopifyOrder.name,
    customerName: `${shopifyOrder.shipping_address?.first_name || ''} ${shopifyOrder.shipping_address?.last_name || ''}`.trim() || 'Customer',
    customerAddress: [
      shopifyOrder.shipping_address?.address1,
      shopifyOrder.shipping_address?.address2,
      shopifyOrder.shipping_address?.city,
      shopifyOrder.shipping_address?.province_code,
      shopifyOrder.shipping_address?.zip,
    ].filter(Boolean).join(', '),
    customerEmail: shopifyOrder.email || '',
    customerPhoneNumber: shopifyOrder.shipping_address?.phone || shopifyOrder.phone || '',
    orderItem: shopifyOrder.line_items.map(item => {
      // Build detail from variant title and properties (modifiers)
      const detailParts = [];
      if (item.variant_title) {
        detailParts.push(item.variant_title);
      }
      if (item.properties && item.properties.length > 0) {
        item.properties.forEach(prop => {
          if (prop.name && prop.value && !prop.name.startsWith('_')) {
            detailParts.push(`${prop.name}: ${prop.value}`);
          }
        });
      }

      return {
        name: item.name,
        quantity: item.quantity,
        unitPrice: parseFloat(item.price),
        detail: detailParts.join(' | '),
      };
    }),
    deliveryInstruction: shopifyOrder.note || '',
    orderSource: 'Shopify',
    additionalId: squareOrderId,
    totalOrderCost: parseFloat(shopifyOrder.total_price),
    deliveryFee: parseFloat(shopifyOrder.shipping_lines?.[0]?.price || 0),
    paymentMethod: 'Prepaid',
  };

  console.log('Creating Shipday order:', JSON.stringify(shipdayOrder));

  const response = await fetch('https://api.shipday.com/orders', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Basic ${shipdayApiKey}`,
    },
    body: JSON.stringify(shipdayOrder),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Shipday error:', errorText);
    throw new Error(`Shipday error: ${response.status} - ${errorText}`);
  }

  const result = await response.json();
  console.log('Shipday order created:', result);

  return result;
}

/**
 * Log order to DynamoDB
 */
async function logOrderToDynamoDB(shopifyOrder, locationConfig, feeData, squareResult, shipdayResult, status) {
  const now = new Date();
  const nowIso = now.toISOString();
  // Use Eastern Time for date grouping (handles EST/EDT automatically)
  const dateStr = now.toLocaleDateString('en-CA', { timeZone: 'America/New_York' }); // YYYY-MM-DD format

  // Determine delivery type from shipping lines
  const shippingLine = shopifyOrder.shipping_lines?.[0];
  const shippingMethod = shippingLine?.title || shippingLine?.code || '';
  const isLocalDelivery = shippingMethod.toLowerCase().includes('local') ||
                          shippingMethod.toLowerCase().includes('delivery') ||
                          shippingLine?.source === 'shopify-local-delivery';
  const deliveryType = isLocalDelivery ? 'local' : 'shipping';

  // Calculate subtotal from line items and shipping price
  const subtotalPrice = shopifyOrder.line_items?.reduce((sum, item) =>
    sum + (parseFloat(item.price) * item.quantity), 0) || 0;
  const shippingPrice = parseFloat(shippingLine?.price || 0);

  const item = {
    pk: `ORDER#${shopifyOrder.id}`,
    sk: `SHOPIFY#${shopifyOrder.id}`,
    orderNumber: shopifyOrder.order_number,
    orderName: shopifyOrder.name,
    shopifyOrderId: shopifyOrder.id,
    squareOrderId: squareResult?.orderId || null,
    squarePaymentId: squareResult?.paymentId || null,
    shipdayOrderId: shipdayResult?.orderId || null,
    locationName: locationConfig.name,
    shopifyLocationId: locationConfig.shopifyLocationId,
    squareLocationId: locationConfig.squareLocationId,
    customerName: `${shopifyOrder.shipping_address?.first_name || ''} ${shopifyOrder.shipping_address?.last_name || ''}`.trim(),
    customerEmail: shopifyOrder.email,
    customerPhone: shopifyOrder.shipping_address?.phone || shopifyOrder.phone,
    shippingAddress: shopifyOrder.shipping_address,
    shippingMethod,
    deliveryType,
    subtotalPrice,
    shippingPrice,
    grossAmount: feeData.grossAmount,
    transactionFee: feeData.fee,
    netAmount: feeData.netAmount,
    shopifyTransactionId: feeData.transactionId,
    totalPrice: parseFloat(shopifyOrder.total_price),
    currency: shopifyOrder.currency,
    lineItems: shopifyOrder.line_items.map(item => ({
      name: item.name,
      quantity: item.quantity,
      price: item.price,
      variant: item.variant_title,
      properties: item.properties?.filter(p => !p.name.startsWith('_')) || [],
    })),
    status,
    createdAt: nowIso,
    updatedAt: nowIso,
    date: dateStr,
    'location-date': `${locationConfig.squareLocationId}#${dateStr}`,
  };

  await docClient.send(new PutCommand({
    TableName: TABLE_NAME,
    Item: item,
  }));

  console.log('Order logged to DynamoDB:', item.pk);
  return item;
}

/**
 * Main Lambda handler
 */
export const handler = async (event) => {
  console.log('Received event:', JSON.stringify(event));

  try {
    // Verify Shopify webhook signature
    const hmacHeader = event.headers?.['x-shopify-hmac-sha256'] || event.headers?.['X-Shopify-Hmac-Sha256'];
    const rawBody = typeof event.body === 'string' ? event.body : JSON.stringify(event.body);

    const isValidWebhook = await verifyShopifyWebhook(rawBody, hmacHeader);
    if (!isValidWebhook) {
      console.log('Webhook verification failed - rejecting request');
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'Invalid webhook signature' }),
      };
    }
    console.log('Webhook signature verified');

    // Parse Shopify webhook payload
    const shopifyOrder = typeof event.body === 'string' ? JSON.parse(event.body) : event.body || event;

    if (!shopifyOrder || !shopifyOrder.id) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Invalid order payload' }),
      };
    }

    console.log(`Processing Shopify order #${shopifyOrder.order_number} (ID: ${shopifyOrder.id})`);

    // Determine fulfillment location
    const locationConfig = await determineFulfillmentLocation(shopifyOrder);
    console.log('Using location config:', locationConfig);

    // Validate required config (should already be validated by getLinkedLocationConfig)
    if (!locationConfig.squareLocationId) {
      throw new Error('Square location not configured. Please set up location linking in Settings.');
    }

    // Fetch exact transaction fees from Shopify (using location-specific credentials)
    let feeData;
    try {
      feeData = await fetchShopifyTransactionFees(shopifyOrder.id, locationConfig);
      console.log('Transaction fees:', feeData);
    } catch (feeError) {
      console.error('Failed to fetch fees, using order total:', feeError);
      feeData = {
        grossAmount: parseFloat(shopifyOrder.total_price),
        fee: 0,
        netAmount: parseFloat(shopifyOrder.total_price),
        transactionId: null,
      };
    }

    // Create Square order with payment
    const squareResult = await createSquareOrder(shopifyOrder, locationConfig, feeData);

    // Create Shipday delivery order
    let shipdayResult = null;
    try {
      shipdayResult = await createShipdayOrder(shopifyOrder, locationConfig, squareResult.orderId);
    } catch (shipdayError) {
      console.error('Shipday order failed:', shipdayError);
      // Continue - Square order was created successfully
    }

    // Log to DynamoDB
    const orderRecord = await logOrderToDynamoDB(
      shopifyOrder,
      locationConfig,
      feeData,
      squareResult,
      shipdayResult,
      shipdayResult ? 'NEW' : 'SQUARE_ONLY'
    );

    // Broadcast new order to connected WebSocket clients
    await broadcastNewOrder(orderRecord);

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        shopifyOrderId: shopifyOrder.id,
        shopifyOrderNumber: shopifyOrder.order_number,
        squareOrderId: squareResult.orderId,
        squarePaymentId: squareResult.paymentId,
        shipdayOrderId: shipdayResult?.orderId || null,
        location: locationConfig.name,
        fees: feeData,
      }, (key, value) => typeof value === 'bigint' ? Number(value) : value),
    };

  } catch (error) {
    console.error('Error processing order:', error);

    // Try to log the error to DynamoDB
    try {
      const shopifyOrder = typeof event.body === 'string' ? JSON.parse(event.body) : event.body || event;
      if (shopifyOrder?.id) {
        await docClient.send(new PutCommand({
          TableName: TABLE_NAME,
          Item: {
            pk: `ORDER#${shopifyOrder.id}`,
            sk: `ERROR#${Date.now()}`,
            orderNumber: shopifyOrder.order_number,
            error: error.message,
            errorStack: error.stack,
            status: 'FAILED',
            createdAt: new Date().toISOString(),
          },
        }));
      }
    } catch (logError) {
      console.error('Failed to log error to DynamoDB:', logError);
    }

    return {
      statusCode: 500,
      body: JSON.stringify({
        error: error.message,
        details: error.errors || error.stack,
      }, (key, value) => typeof value === 'bigint' ? Number(value) : value),
    };
  }
};
