/**
 * WebSocket API Lambda
 * Handles connections and broadcasts for real-time order updates
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, DeleteCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { ApiGatewayManagementApiClient, PostToConnectionCommand } from '@aws-sdk/client-apigatewaymanagementapi';

const ddbClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(ddbClient);
const CONNECTIONS_TABLE = process.env.CONNECTIONS_TABLE || 'surreal-websocket-connections';

/**
 * Handle new WebSocket connection
 */
async function handleConnect(connectionId) {
  console.log('New connection:', connectionId);

  await docClient.send(new PutCommand({
    TableName: CONNECTIONS_TABLE,
    Item: {
      connectionId,
      connectedAt: new Date().toISOString(),
    },
  }));

  return { statusCode: 200, body: 'Connected' };
}

/**
 * Handle WebSocket disconnection
 */
async function handleDisconnect(connectionId) {
  console.log('Disconnection:', connectionId);

  await docClient.send(new DeleteCommand({
    TableName: CONNECTIONS_TABLE,
    Key: { connectionId },
  }));

  return { statusCode: 200, body: 'Disconnected' };
}

/**
 * Broadcast message to all connected clients
 */
async function broadcast(endpoint, message) {
  const apiClient = new ApiGatewayManagementApiClient({ endpoint });

  // Get all connections
  const result = await docClient.send(new ScanCommand({
    TableName: CONNECTIONS_TABLE,
  }));

  const connections = result.Items || [];
  console.log(`Broadcasting to ${connections.length} connections`);

  const messageData = JSON.stringify(message);

  // Send to all connections
  const sendPromises = connections.map(async ({ connectionId }) => {
    try {
      await apiClient.send(new PostToConnectionCommand({
        ConnectionId: connectionId,
        Data: messageData,
      }));
    } catch (error) {
      if (error.statusCode === 410) {
        // Connection is stale, remove it
        console.log('Removing stale connection:', connectionId);
        await docClient.send(new DeleteCommand({
          TableName: CONNECTIONS_TABLE,
          Key: { connectionId },
        }));
      } else {
        console.error('Failed to send to', connectionId, error);
      }
    }
  });

  await Promise.all(sendPromises);
  return { statusCode: 200, body: 'Broadcast complete' };
}

/**
 * Handle incoming messages from clients
 */
async function handleMessage(connectionId, body, endpoint) {
  console.log('Message from', connectionId, ':', body);

  const message = JSON.parse(body || '{}');

  // Handle different message types
  if (message.action === 'ping') {
    const apiClient = new ApiGatewayManagementApiClient({ endpoint });
    await apiClient.send(new PostToConnectionCommand({
      ConnectionId: connectionId,
      Data: JSON.stringify({ type: 'pong', timestamp: Date.now() }),
    }));
  }

  return { statusCode: 200, body: 'Message received' };
}

export const handler = async (event) => {
  console.log('WebSocket event:', JSON.stringify(event));

  const { requestContext } = event;
  const connectionId = requestContext.connectionId;
  const routeKey = requestContext.routeKey;

  // Build the endpoint URL for sending messages back
  const domain = requestContext.domainName;
  const stage = requestContext.stage;
  const endpoint = `https://${domain}/${stage}`;

  try {
    switch (routeKey) {
      case '$connect':
        return await handleConnect(connectionId);

      case '$disconnect':
        return await handleDisconnect(connectionId);

      case '$default':
        return await handleMessage(connectionId, event.body, endpoint);

      case 'broadcast':
        // This route is called by other Lambdas to broadcast
        const message = JSON.parse(event.body || '{}');
        return await broadcast(endpoint, message);

      default:
        return { statusCode: 400, body: 'Unknown route' };
    }
  } catch (error) {
    console.error('Error:', error);
    return { statusCode: 500, body: error.message };
  }
};

/**
 * Export broadcast function for use by other Lambdas
 * Call this with the WebSocket API endpoint and message
 */
export async function broadcastOrder(endpoint, orderData) {
  return await broadcast(endpoint, {
    type: 'new_order',
    order: orderData,
    timestamp: Date.now(),
  });
}
