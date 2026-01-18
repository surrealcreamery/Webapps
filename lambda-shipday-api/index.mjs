/**
 * Shipday API Lambda
 * Handles delivery estimates and dispatch via Shipday
 * Fetches API keys from DynamoDB config
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';
import { verifyAuth, unauthorizedResponse } from './auth.mjs';

const ddbClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(ddbClient);
const CONFIG_TABLE = process.env.CONFIG_TABLE || 'surreal-admin-config';

// Response headers with CORS
const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

/**
 * Get Shipday API key from DynamoDB
 * @param {string} locationSk - The location SK (e.g., "SHIPDAY#abc123")
 */
async function getShipdayApiKey(locationSk) {
  if (!locationSk) {
    throw new Error('locationSk is required to get Shipday API key');
  }

  const result = await docClient.send(new GetCommand({
    TableName: CONFIG_TABLE,
    Key: { pk: 'LOCATION', sk: locationSk },
  }));

  if (result.Item && result.Item.secrets?.apiKey) {
    return result.Item.secrets.apiKey;
  }
  throw new Error(`Shipday location not found or missing API key: ${locationSk}`);
}

/**
 * Find Shipday API key for a given location name by looking up linked locations
 */
async function getShipdayApiKeyForLocation(locationName) {
  const { ScanCommand } = await import('@aws-sdk/lib-dynamodb');

  console.log('Looking for Shipday API key for location:', locationName);

  // First, get all locations
  const result = await docClient.send(new ScanCommand({
    TableName: CONFIG_TABLE,
    FilterExpression: 'pk = :pk',
    ExpressionAttributeValues: {
      ':pk': 'LOCATION',
    },
  }));

  if (!result.Items || result.Items.length === 0) {
    throw new Error('No locations configured');
  }

  console.log('Found locations:', result.Items.length);

  // Find Square/Shopify location matching the locationName
  const matchingLocation = result.Items.find(item =>
    (item.platform === 'square' || item.platform === 'shopify') &&
    item.name && item.name.toLowerCase().includes(locationName.toLowerCase())
  );

  if (!matchingLocation) {
    throw new Error(`Location "${locationName}" not found in DynamoDB. Please configure it in Settings.`);
  }

  if (!matchingLocation.links || Object.keys(matchingLocation.links).length === 0) {
    throw new Error(`Location "${matchingLocation.name}" has no linked locations. Please link it to Shipday in Settings.`);
  }

  console.log('Found matching location:', matchingLocation.name, 'with links:', Object.keys(matchingLocation.links));

  // Find linked Shipday location
  for (const linkedSk of Object.keys(matchingLocation.links)) {
    if (linkedSk.startsWith('SHIPDAY#')) {
      const shipdayLocation = result.Items.find(item => item.sk === linkedSk);
      if (shipdayLocation) {
        const apiKey = shipdayLocation.secrets?.apiKey || linkedSk.replace('SHIPDAY#', '');
        console.log('Found linked Shipday location:', shipdayLocation.name, 'with API key');
        return apiKey;
      }
    }
  }

  throw new Error(`Location "${matchingLocation.name}" has no linked Shipday location. Please link it in Settings.`);
}

/**
 * Get delivery estimates from Shipday (DoorDash, Uber Direct, etc.)
 */
async function getDeliveryEstimates(shipdayOrderId, apiKey) {
  console.log(`Fetching delivery estimates for Shipday order: ${shipdayOrderId}`);

  const response = await fetch(`https://api.shipday.com/on-demand/estimate/${shipdayOrderId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Basic ${apiKey}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Shipday estimate error:', errorText);
    throw new Error(`Shipday estimate error: ${response.status} - ${errorText}`);
  }

  const estimates = await response.json();
  console.log('Delivery estimates:', JSON.stringify(estimates));

  return estimates;
}

/**
 * Assign a delivery provider via Shipday
 */
async function assignDeliveryProvider(shipdayOrderId, carrierId, apiKey) {
  console.log(`Assigning carrier ${carrierId} to Shipday order: ${shipdayOrderId}`);

  const response = await fetch(`https://api.shipday.com/on-demand/assign/${shipdayOrderId}`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ carrierId }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Shipday assign error:', errorText);
    throw new Error(`Shipday assign error: ${response.status} - ${errorText}`);
  }

  const result = await response.json();
  console.log('Delivery assigned:', JSON.stringify(result));

  return result;
}

/**
 * Get order details from Shipday
 */
async function getOrderDetails(shipdayOrderId, apiKey) {
  console.log(`Fetching order details for Shipday order: ${shipdayOrderId}`);

  const response = await fetch(`https://api.shipday.com/orders/${shipdayOrderId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Basic ${apiKey}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Shipday order details error:', errorText);
    throw new Error(`Shipday error: ${response.status} - ${errorText}`);
  }

  const orderDetails = await response.json();
  console.log('Order details:', JSON.stringify(orderDetails));

  return orderDetails;
}

export const handler = async (event) => {
  console.log('Received event:', JSON.stringify(event));

  const method = event.requestContext?.http?.method || event.httpMethod;
  console.log('HTTP Method:', method);

  // Handle CORS preflight
  if (method === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  // Verify Firebase authentication
  const auth = await verifyAuth(event);
  if (!auth.valid) {
    console.log('Auth failed:', auth.error);
    return unauthorizedResponse(auth.error);
  }
  console.log('Authenticated user:', auth.email);

  try {
    // POST - Actions
    if (method === 'POST') {
      const body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
      const { action, shipdayOrderId, carrierId, locationSk, locationName, apiKey: providedApiKey } = body || {};

      // Get API key - either provided directly, from locationSk, from locationName lookup, or first available
      let apiKey;
      try {
        if (providedApiKey) {
          apiKey = providedApiKey;
        } else if (locationSk) {
          apiKey = await getShipdayApiKey(locationSk);
        } else if (locationName) {
          // Look up Shipday API key based on linked locations
          apiKey = await getShipdayApiKeyForLocation(locationName);
        } else {
          throw new Error('Either locationSk, locationName, or apiKey must be provided');
        }
      } catch (keyError) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: keyError.message }),
        };
      }

      if (action === 'estimate') {
        if (!shipdayOrderId) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'shipdayOrderId is required' }),
          };
        }

        const estimates = await getDeliveryEstimates(shipdayOrderId, apiKey);
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            shipdayOrderId,
            estimates,
          }),
        };
      }

      if (action === 'dispatch') {
        if (!shipdayOrderId || !carrierId) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'shipdayOrderId and carrierId are required' }),
          };
        }

        const result = await assignDeliveryProvider(shipdayOrderId, carrierId, apiKey);
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            shipdayOrderId,
            carrierId,
            result,
          }),
        };
      }

      if (action === 'details') {
        if (!shipdayOrderId) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'shipdayOrderId is required' }),
          };
        }

        const details = await getOrderDetails(shipdayOrderId, apiKey);
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            shipdayOrderId,
            details,
          }),
        };
      }

      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invalid action. Valid actions: estimate, dispatch, details' }),
      };
    }

    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }),
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
