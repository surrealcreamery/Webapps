/**
 * Shipday API Lambda
 * Handles delivery estimates and dispatch via Shipday
 */

const SHIPDAY_API_KEY = process.env.SHIPDAY_API_KEY;

// CORS headers
const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

/**
 * Get delivery estimates from Shipday (DoorDash, Uber Direct, etc.)
 */
async function getDeliveryEstimates(shipdayOrderId) {
  if (!SHIPDAY_API_KEY) {
    throw new Error('SHIPDAY_API_KEY environment variable is not set');
  }

  console.log(`Fetching delivery estimates for Shipday order: ${shipdayOrderId}`);

  const response = await fetch(`https://api.shipday.com/on-demand/estimate/${shipdayOrderId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Basic ${SHIPDAY_API_KEY}`,
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
async function assignDeliveryProvider(shipdayOrderId, carrierId) {
  if (!SHIPDAY_API_KEY) {
    throw new Error('SHIPDAY_API_KEY environment variable is not set');
  }

  console.log(`Assigning carrier ${carrierId} to Shipday order: ${shipdayOrderId}`);

  const response = await fetch(`https://api.shipday.com/on-demand/assign/${shipdayOrderId}`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${SHIPDAY_API_KEY}`,
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
async function getOrderDetails(shipdayOrderId) {
  if (!SHIPDAY_API_KEY) {
    throw new Error('SHIPDAY_API_KEY environment variable is not set');
  }

  console.log(`Fetching order details for Shipday order: ${shipdayOrderId}`);

  const response = await fetch(`https://api.shipday.com/orders/${shipdayOrderId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Basic ${SHIPDAY_API_KEY}`,
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

  try {
    // POST - Actions
    if (method === 'POST') {
      const body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
      const { action, shipdayOrderId, carrierId } = body || {};

      if (action === 'estimate') {
        if (!shipdayOrderId) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'shipdayOrderId is required' }),
          };
        }

        const estimates = await getDeliveryEstimates(shipdayOrderId);
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

        const result = await assignDeliveryProvider(shipdayOrderId, carrierId);
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

        const details = await getOrderDetails(shipdayOrderId);
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
