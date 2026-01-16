/**
 * Shopify to Square/Shipday Lambda
 * Multi-location delivery dispatch with DynamoDB audit logging
 */

import { Client, Environment } from 'square';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';

// Initialize Square client
const squareClient = new Client({
  accessToken: process.env.SQUARE_ACCESS_TOKEN,
  environment: Environment.Production,
});

// Initialize DynamoDB client
const ddbClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(ddbClient);
const TABLE_NAME = 'surreal-orders';

// Default location config (fallback)
const DEFAULT_LOCATION = {
  squareLocationId: process.env.SQUARE_LOCATION_ID,
  shipdayApiKey: process.env.SHIPDAY_API_KEY,
  name: 'Default',
};

// Shopify API config
const SHOPIFY_STORE_DOMAIN = process.env.SHOPIFY_STORE_DOMAIN;
const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;

/**
 * Fetch exact transaction fees from Shopify GraphQL API
 */
async function fetchShopifyTransactionFees(orderId) {
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
 * Fetch location metafields from Shopify
 */
async function fetchLocationConfig(locationId) {
  console.log(`fetchLocationConfig called with locationId: ${locationId}`);

  if (!locationId || !SHOPIFY_STORE_DOMAIN || !SHOPIFY_ACCESS_TOKEN) {
    console.log('Missing location ID or Shopify credentials, using default location');
    return DEFAULT_LOCATION;
  }

  try {
    // Fetch location details to get the actual name
    const locationUrl = `https://${SHOPIFY_STORE_DOMAIN}/admin/api/2024-01/locations/${locationId}.json`;
    console.log(`Fetching location details from: ${locationUrl}`);

    const locationResponse = await fetch(locationUrl, {
      headers: {
        'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN,
      },
    });

    let locationName = `Location ${locationId}`;
    if (locationResponse.ok) {
      const locationData = await locationResponse.json();
      locationName = locationData.location?.name || locationName;
      console.log(`Found location name: ${locationName}`);
    }

    // Fetch metafields for Square and Shipday config
    const url = `https://${SHOPIFY_STORE_DOMAIN}/admin/api/2024-01/locations/${locationId}/metafields.json`;
    console.log(`Fetching location metafields from: ${url}`);

    const response = await fetch(url, {
      headers: {
        'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN,
      },
    });

    console.log(`Location metafields response status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Failed to fetch location metafields: ${response.status} - ${errorText}`);
      return DEFAULT_LOCATION;
    }

    const data = await response.json();
    console.log('Location metafields response:', JSON.stringify(data, null, 2));

    const metafields = data.metafields || [];

    const squareLocationId = metafields.find(m => m.key === 'square_location_id')?.value;
    const shipdayApiKey = metafields.find(m => m.key === 'shipday_api_key')?.value;

    console.log(`Found metafields - square_location_id: ${squareLocationId}, shipday_api_key: ${shipdayApiKey ? '[SET]' : '[NOT SET]'}`);

    if (!squareLocationId || !shipdayApiKey) {
      console.log(`Location ${locationId} missing metafields, using default`);
      return { ...DEFAULT_LOCATION, name: locationName };
    }

    return {
      shopifyLocationId: locationId,
      squareLocationId,
      shipdayApiKey,
      name: locationName,
    };
  } catch (error) {
    console.error('Error fetching location config:', error);
    return DEFAULT_LOCATION;
  }
}

/**
 * Determine fulfillment location from Shopify order
 * Uses fulfillment_orders API which returns assigned_location with name directly
 */
async function determineFulfillmentLocation(shopifyOrder) {
  if (SHOPIFY_STORE_DOMAIN && SHOPIFY_ACCESS_TOKEN) {
    try {
      const url = `https://${SHOPIFY_STORE_DOMAIN}/admin/api/2024-01/orders/${shopifyOrder.id}/fulfillment_orders.json`;
      console.log(`Fetching fulfillment orders from: ${url}`);

      const response = await fetch(url, {
        headers: {
          'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN,
        },
      });

      console.log(`Fulfillment orders response status: ${response.status}`);

      if (response.ok) {
        const data = await response.json();
        const fulfillmentOrders = data.fulfillment_orders || [];

        if (fulfillmentOrders.length > 0) {
          const fulfillmentOrder = fulfillmentOrders[0];
          const assignedLocation = fulfillmentOrder.assigned_location;
          const locationId = fulfillmentOrder.assigned_location_id;

          console.log(`Found fulfillment location: ${locationId} - ${assignedLocation?.name}`);

          // Get Square/Shipday config from metafields, but use the name from assigned_location
          const config = await fetchLocationConfig(locationId);

          // Override the name with the one from fulfillment_orders (more reliable)
          if (assignedLocation?.name) {
            config.name = assignedLocation.name;
          }

          return config;
        } else {
          console.log('No fulfillment orders found - check read_merchant_managed_fulfillment_orders scope');
        }
      } else {
        const errorText = await response.text();
        console.error(`Fulfillment orders API error: ${response.status} - ${errorText}`);
      }
    } catch (error) {
      console.error('Error fetching fulfillment orders:', error);
    }
  } else {
    console.log('Missing SHOPIFY_STORE_DOMAIN or SHOPIFY_ACCESS_TOKEN');
  }

  // Fallback: use default location
  console.log('Using default location as fallback');
  return DEFAULT_LOCATION;
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

  const result = await squareClient.ordersApi.createOrder(orderRequest);
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

  const updateResult = await squareClient.ordersApi.updateOrder(
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

  const paymentResult = await squareClient.paymentsApi.createPayment(paymentRequest);
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
  const now = new Date().toISOString();
  const dateStr = now.split('T')[0];

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
    createdAt: now,
    updatedAt: now,
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

    // Validate required config
    if (!locationConfig.squareLocationId) {
      throw new Error('SQUARE_LOCATION_ID environment variable is not set. Add it to your Lambda configuration.');
    }

    // Fetch exact transaction fees from Shopify
    let feeData;
    try {
      feeData = await fetchShopifyTransactionFees(shopifyOrder.id);
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
    await logOrderToDynamoDB(
      shopifyOrder,
      locationConfig,
      feeData,
      squareResult,
      shipdayResult,
      shipdayResult ? 'DISPATCHED' : 'SQUARE_ONLY'
    );

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
