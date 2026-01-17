/**
 * Orders API Lambda
 * Fetches order data from DynamoDB for the admin dashboard
 * Supports healing/re-processing orders
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, UpdateCommand, QueryCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';

const ddbClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(ddbClient);
const TABLE_NAME = 'surreal-orders';

// Shopify API config
const SHOPIFY_STORE_DOMAIN = process.env.SHOPIFY_STORE_DOMAIN;
const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;

// CORS headers
const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

/**
 * Fetch order from Shopify Admin API
 */
async function fetchShopifyOrder(orderId) {
  if (!SHOPIFY_STORE_DOMAIN || !SHOPIFY_ACCESS_TOKEN) {
    throw new Error('Shopify credentials not configured');
  }

  const url = `https://${SHOPIFY_STORE_DOMAIN}/admin/api/2024-01/orders/${orderId}.json`;
  const response = await fetch(url, {
    headers: {
      'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch order from Shopify: ${response.status}`);
  }

  const data = await response.json();
  return data.order;
}

/**
 * Fetch fulfillment orders from Shopify to get assigned location
 * Returns { locationId, locationName } or null
 */
async function fetchFulfillmentLocation(orderId) {
  if (!SHOPIFY_STORE_DOMAIN || !SHOPIFY_ACCESS_TOKEN) {
    return null;
  }

  try {
    const url = `https://${SHOPIFY_STORE_DOMAIN}/admin/api/2024-01/orders/${orderId}/fulfillment_orders.json`;
    console.log(`Fetching fulfillment orders from: ${url}`);

    const response = await fetch(url, {
      headers: {
        'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN,
      },
    });

    if (response.ok) {
      const data = await response.json();
      const fulfillmentOrders = data.fulfillment_orders || [];

      if (fulfillmentOrders.length > 0) {
        const assignedLocation = fulfillmentOrders[0].assigned_location;
        return {
          locationId: fulfillmentOrders[0].assigned_location_id,
          locationName: assignedLocation?.name || null,
        };
      }
    }
  } catch (error) {
    console.error('Error fetching fulfillment orders:', error);
  }
  return null;
}

/**
 * Heal/re-process an order
 */
async function healOrder(orderId) {
  console.log(`Healing order: ${orderId}`);
  console.log(`Shopify config - Domain: ${SHOPIFY_STORE_DOMAIN ? 'SET' : 'NOT SET'}, Token: ${SHOPIFY_ACCESS_TOKEN ? 'SET' : 'NOT SET'}`);

  // Fetch order from Shopify
  const shopifyOrder = await fetchShopifyOrder(orderId);
  if (!shopifyOrder) {
    throw new Error('Order not found in Shopify');
  }
  console.log(`Fetched Shopify order: ${shopifyOrder.order_number}`);

  // Get location directly from fulfillment_orders API (includes name)
  const fulfillmentLocation = await fetchFulfillmentLocation(orderId);
  console.log(`Fulfillment location:`, JSON.stringify(fulfillmentLocation));

  const locationName = fulfillmentLocation?.locationName || 'Unknown';
  const shopifyLocationId = fulfillmentLocation?.locationId || null;

  // Determine delivery type from shipping lines
  const shippingLine = shopifyOrder.shipping_lines?.[0];
  const shippingMethod = shippingLine?.title || shippingLine?.code || '';
  const isLocalDelivery = shippingMethod.toLowerCase().includes('local') ||
                          shippingMethod.toLowerCase().includes('delivery') ||
                          shippingLine?.source === 'shopify-local-delivery';
  const deliveryType = isLocalDelivery ? 'local' : 'shipping';

  // Calculate subtotal and shipping price
  const subtotalPrice = shopifyOrder.line_items?.reduce((sum, item) =>
    sum + (parseFloat(item.price) * item.quantity), 0) || 0;
  const shippingPrice = parseFloat(shippingLine?.price || 0);

  // Build lineItems with properties (modifiers)
  const lineItems = shopifyOrder.line_items?.map(item => ({
    name: item.name,
    quantity: item.quantity,
    price: item.price,
    variant: item.variant_title,
    properties: item.properties?.filter(p => !p.name.startsWith('_')) || [],
  })) || [];

  // Build customer info
  const customerName = `${shopifyOrder.shipping_address?.first_name || ''} ${shopifyOrder.shipping_address?.last_name || ''}`.trim();
  const customerEmail = shopifyOrder.email;
  const customerPhone = shopifyOrder.shipping_address?.phone || shopifyOrder.phone;

  // Update DynamoDB record with all healable fields
  const updateParams = {
    TableName: TABLE_NAME,
    Key: {
      pk: `ORDER#${orderId}`,
      sk: `SHOPIFY#${orderId}`,
    },
    UpdateExpression: `SET
      #locationName = :locationName,
      #shopifyLocationId = :shopifyLocationId,
      #shippingMethod = :shippingMethod,
      #deliveryType = :deliveryType,
      #subtotalPrice = :subtotalPrice,
      #shippingPrice = :shippingPrice,
      #totalPrice = :totalPrice,
      #lineItems = :lineItems,
      #customerName = :customerName,
      #customerEmail = :customerEmail,
      #customerPhone = :customerPhone,
      #shippingAddress = :shippingAddress,
      #updatedAt = :updatedAt,
      #healedAt = :healedAt`,
    ExpressionAttributeNames: {
      '#locationName': 'locationName',
      '#shopifyLocationId': 'shopifyLocationId',
      '#shippingMethod': 'shippingMethod',
      '#deliveryType': 'deliveryType',
      '#subtotalPrice': 'subtotalPrice',
      '#shippingPrice': 'shippingPrice',
      '#totalPrice': 'totalPrice',
      '#lineItems': 'lineItems',
      '#customerName': 'customerName',
      '#customerEmail': 'customerEmail',
      '#customerPhone': 'customerPhone',
      '#shippingAddress': 'shippingAddress',
      '#updatedAt': 'updatedAt',
      '#healedAt': 'healedAt',
    },
    ExpressionAttributeValues: {
      ':locationName': locationName,
      ':shopifyLocationId': shopifyLocationId,
      ':shippingMethod': shippingMethod,
      ':deliveryType': deliveryType,
      ':subtotalPrice': subtotalPrice,
      ':shippingPrice': shippingPrice,
      ':totalPrice': parseFloat(shopifyOrder.total_price),
      ':lineItems': lineItems,
      ':customerName': customerName,
      ':customerEmail': customerEmail,
      ':customerPhone': customerPhone,
      ':shippingAddress': shopifyOrder.shipping_address,
      ':updatedAt': new Date().toISOString(),
      ':healedAt': new Date().toISOString(),
    },
    ReturnValues: 'ALL_NEW',
  };

  const result = await docClient.send(new UpdateCommand(updateParams));
  console.log('Order healed:', result.Attributes);

  return {
    orderId,
    orderNumber: shopifyOrder.order_number,
    locationName,
    shopifyLocationId,
    deliveryType,
    shippingMethod,
    subtotalPrice,
    shippingPrice,
    totalPrice: parseFloat(shopifyOrder.total_price),
    lineItemsCount: lineItems.length,
    customerName,
    healedAt: new Date().toISOString(),
  };
}

/**
 * Heal multiple orders
 */
async function healOrders(orderIds) {
  const results = [];
  const errors = [];

  for (const orderId of orderIds) {
    try {
      const result = await healOrder(orderId);
      results.push(result);
    } catch (error) {
      console.error(`Failed to heal order ${orderId}:`, error);
      errors.push({ orderId, error: error.message });
    }
  }

  return { results, errors };
}

/**
 * Fix dates on all orders - convert from UTC to Eastern Time
 */
async function fixOrderDates() {
  console.log('Starting date fix for all orders...');

  // Scan all records
  const scanResult = await docClient.send(new ScanCommand({
    TableName: TABLE_NAME,
  }));

  const items = scanResult.Items || [];
  console.log(`Found ${items.length} total records`);

  let fixedCount = 0;
  let skippedCount = 0;
  const fixedOrders = [];

  for (const item of items) {
    // Only process SHOPIFY# records (success orders)
    if (!item.sk?.startsWith('SHOPIFY#')) {
      skippedCount++;
      continue;
    }

    // Need createdAt to calculate correct date
    if (!item.createdAt) {
      console.log(`Skipping ${item.pk} - no createdAt`);
      skippedCount++;
      continue;
    }

    try {
      // Parse the createdAt timestamp and get Eastern Time date
      const createdDate = new Date(item.createdAt);
      const easternDate = createdDate.toLocaleDateString('en-CA', { timeZone: 'America/New_York' }); // YYYY-MM-DD

      // Check if date needs fixing
      if (item.date === easternDate) {
        console.log(`Skipping ${item.pk} - date already correct (${easternDate})`);
        skippedCount++;
        continue;
      }

      const oldDate = item.date;

      // Build new location-date if we have squareLocationId
      const locationDate = item.squareLocationId ? `${item.squareLocationId}#${easternDate}` : null;

      // Update the record
      const updateParams = {
        TableName: TABLE_NAME,
        Key: {
          pk: item.pk,
          sk: item.sk,
        },
        UpdateExpression: locationDate
          ? 'SET #date = :date, #locationDate = :locationDate, #updatedAt = :updatedAt'
          : 'SET #date = :date, #updatedAt = :updatedAt',
        ExpressionAttributeNames: locationDate
          ? { '#date': 'date', '#locationDate': 'location-date', '#updatedAt': 'updatedAt' }
          : { '#date': 'date', '#updatedAt': 'updatedAt' },
        ExpressionAttributeValues: locationDate
          ? { ':date': easternDate, ':locationDate': locationDate, ':updatedAt': new Date().toISOString() }
          : { ':date': easternDate, ':updatedAt': new Date().toISOString() },
      };

      await docClient.send(new UpdateCommand(updateParams));

      fixedCount++;
      fixedOrders.push({
        orderId: item.pk.replace('ORDER#', ''),
        orderNumber: item.orderNumber,
        oldDate,
        newDate: easternDate,
      });
      console.log(`Fixed ${item.pk}: ${oldDate} -> ${easternDate}`);
    } catch (error) {
      console.error(`Failed to fix ${item.pk}:`, error);
    }
  }

  console.log(`Date fix complete. Fixed: ${fixedCount}, Skipped: ${skippedCount}`);
  return { fixedCount, skippedCount, fixedOrders };
}

/**
 * Cleanup ERROR# records for orders that have successful SHOPIFY# records
 */
async function cleanupErrorRecords() {
  console.log('Starting error records cleanup...');

  // Scan for all records
  const scanResult = await docClient.send(new ScanCommand({
    TableName: TABLE_NAME,
  }));

  const items = scanResult.Items || [];

  // Group by pk (order ID)
  const orderGroups = new Map();
  items.forEach(item => {
    const pk = item.pk;
    if (!orderGroups.has(pk)) {
      orderGroups.set(pk, []);
    }
    orderGroups.get(pk).push(item);
  });

  let deletedCount = 0;
  const deletedRecords = [];

  // For each order, if it has both SHOPIFY# and ERROR# records, delete the ERROR# records
  for (const [pk, records] of orderGroups) {
    const hasShopifyRecord = records.some(r => r.sk?.startsWith('SHOPIFY#'));
    const errorRecords = records.filter(r => r.sk?.startsWith('ERROR#'));

    if (hasShopifyRecord && errorRecords.length > 0) {
      for (const errorRecord of errorRecords) {
        try {
          await docClient.send(new DeleteCommand({
            TableName: TABLE_NAME,
            Key: {
              pk: errorRecord.pk,
              sk: errorRecord.sk,
            },
          }));
          deletedCount++;
          deletedRecords.push({
            pk: errorRecord.pk,
            sk: errorRecord.sk,
            orderNumber: errorRecord.orderNumber,
          });
          console.log(`Deleted error record: ${errorRecord.pk} / ${errorRecord.sk}`);
        } catch (error) {
          console.error(`Failed to delete ${errorRecord.pk} / ${errorRecord.sk}:`, error);
        }
      }
    }
  }

  console.log(`Cleanup complete. Deleted ${deletedCount} error records.`);
  return { deletedCount, deletedRecords };
}

export const handler = async (event) => {
  console.log('Received event:', JSON.stringify(event));

  const method = event.requestContext?.http?.method || event.httpMethod;
  console.log('HTTP Method:', method);

  // Handle CORS preflight
  if (method === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    // POST - Heal orders
    if (method === 'POST') {
      console.log('Processing POST request');
      console.log('Raw body:', event.body);
      const body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
      console.log('Parsed body:', JSON.stringify(body));
      const { action, orderIds, orderId } = body || {};
      console.log('Action:', action, 'OrderIds:', orderIds, 'OrderId:', orderId);

      if (action === 'heal') {
        const idsToHeal = orderIds || (orderId ? [orderId] : []);
        if (idsToHeal.length === 0) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'No order IDs provided' }),
          };
        }

        const healResults = await healOrders(idsToHeal);
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            healed: healResults.results.length,
            failed: healResults.errors.length,
            results: healResults.results,
            errors: healResults.errors,
          }),
        };
      }

      if (action === 'cleanupErrors') {
        const cleanupResults = await cleanupErrorRecords();
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            deleted: cleanupResults.deletedCount,
            records: cleanupResults.deletedRecords,
          }),
        };
      }

      if (action === 'fixDates') {
        const fixResults = await fixOrderDates();
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            fixed: fixResults.fixedCount,
            skipped: fixResults.skippedCount,
            orders: fixResults.fixedOrders,
          }),
        };
      }

      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invalid action. Valid actions: heal, cleanupErrors, fixDates' }),
      };
    }

    // GET - List orders
    const params = event.queryStringParameters || {};
    const { date, locationId, status, limit = '50' } = params;

    let result;

    // Use Scan with filter - simple approach that works without specific GSIs
    const scanParams = {
      TableName: TABLE_NAME,
      Limit: parseInt(limit),
    };

    if (date) {
      scanParams.FilterExpression = '#d = :d';
      scanParams.ExpressionAttributeNames = { '#d': 'date' };
      scanParams.ExpressionAttributeValues = { ':d': date };
    }

    result = await docClient.send(new ScanCommand(scanParams));

    // Return all records with recordType indicator
    const orders = (result.Items || [])
      .map(item => {
        // Determine record type from sk
        let recordType = 'unknown';
        if (item.sk?.startsWith('SHOPIFY#')) recordType = 'success';
        else if (item.sk?.startsWith('ERROR#')) recordType = 'error';
        else if (item.sk?.startsWith('METADATA#')) recordType = 'metadata';

        // Extract order ID from pk (ORDER#123 -> 123)
        const orderId = item.pk?.replace('ORDER#', '') || item.shopifyOrderId;

        return {
          orderId,
          orderNumber: item.orderNumber,
          orderName: item.orderName,
          squareOrderId: item.squareOrderId,
          shipdayOrderId: item.shipdayOrderId,
          customerName: item.customerName,
          customerEmail: item.customerEmail,
          customerPhone: item.customerPhone,
          shippingAddress: item.shippingAddress,
          shippingMethod: item.shippingMethod,
          deliveryType: item.deliveryType,
          lineItems: item.lineItems,
          subtotalPrice: item.subtotalPrice,
          shippingPrice: item.shippingPrice,
          totalPrice: item.totalPrice,
          grossAmount: item.grossAmount,
          transactionFee: item.transactionFee,
          netAmount: item.netAmount,
          status: item.status,
          locationName: item.locationName,
          squareLocationId: item.squareLocationId,
          shopifyLocationId: item.shopifyLocationId,
          createdAt: item.createdAt,
          date: item.date,
          healedAt: item.healedAt,
          // Additional fields for error records
          error: item.error,
          errorStack: item.errorStack,
          // Record type for frontend filtering
          recordType,
          pk: item.pk,
          sk: item.sk,
        };
      })
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        orders,
        count: orders.length,
      }),
    };

  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message }),
    };
  }
};
