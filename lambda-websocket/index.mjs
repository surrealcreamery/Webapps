/**
 * WebSocket API Lambda
 * Handles connections and broadcasts for real-time order updates
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, DeleteCommand, ScanCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { ApiGatewayManagementApiClient, PostToConnectionCommand } from '@aws-sdk/client-apigatewaymanagementapi';

const ddbClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(ddbClient);
const CONNECTIONS_TABLE = process.env.CONNECTIONS_TABLE || 'surreal-websocket-connections';

/**
 * Broadcast connection changes only to clients subscribed to 'connections' topic
 */
async function broadcastConnectionsUpdated(endpoint, excludeConnectionId = null) {
  const apiClient = new ApiGatewayManagementApiClient({ endpoint });

  // Get only connections subscribed to 'connections' topic
  const result = await docClient.send(new ScanCommand({
    TableName: CONNECTIONS_TABLE,
    FilterExpression: 'contains(subscriptions, :topic)',
    ExpressionAttributeValues: {
      ':topic': 'connections',
    },
  }));

  const connections = result.Items || [];
  if (connections.length === 0) {
    console.log('No clients subscribed to connections updates');
    return;
  }

  console.log(`Broadcasting connections_updated to ${connections.length} subscribed clients`);
  const message = JSON.stringify({ type: 'connections_updated', timestamp: Date.now() });

  // Send only to subscribed connections
  const sendPromises = connections
    .filter(({ connectionId }) => connectionId !== excludeConnectionId)
    .map(async ({ connectionId }) => {
      try {
        await apiClient.send(new PostToConnectionCommand({
          ConnectionId: connectionId,
          Data: message,
        }));
      } catch (error) {
        if (error.statusCode === 410) {
          // Connection is stale, remove it
          console.log('Removing stale connection:', connectionId);
          await docClient.send(new DeleteCommand({
            TableName: CONNECTIONS_TABLE,
            Key: { connectionId },
          }));
        }
      }
    });

  await Promise.all(sendPromises);
}

/**
 * Handle new WebSocket connection
 */
async function handleConnect(connectionId, endpoint) {
  console.log('New connection:', connectionId);

  await docClient.send(new PutCommand({
    TableName: CONNECTIONS_TABLE,
    Item: {
      connectionId,
      clientUUID: null, // Will be set when client identifies
      deviceId: null, // Will be set when device registers
      userAgent: null,
      connectedAt: new Date().toISOString(),
      lastPing: new Date().toISOString(),
    },
  }));

  // Notify other clients about the new connection
  await broadcastConnectionsUpdated(endpoint, connectionId);

  return { statusCode: 200, body: 'Connected' };
}

/**
 * Handle WebSocket disconnection
 */
async function handleDisconnect(connectionId, endpoint) {
  console.log('Disconnection:', connectionId);

  await docClient.send(new DeleteCommand({
    TableName: CONNECTIONS_TABLE,
    Key: { connectionId },
  }));

  // Notify other clients about the disconnection
  await broadcastConnectionsUpdated(endpoint);

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
  const apiClient = new ApiGatewayManagementApiClient({ endpoint });

  // Handle client identification (sends clientUUID, userAgent, and Firebase user info)
  if (message.action === 'identify') {
    const { clientUUID, userAgent, deviceId, userEmail, userName } = message;
    console.log('Client identify:', connectionId, '->', clientUUID, deviceId, userEmail);

    // Clean up stale connections with the same clientUUID
    if (clientUUID) {
      try {
        const existingConnections = await docClient.send(new ScanCommand({
          TableName: CONNECTIONS_TABLE,
          FilterExpression: 'clientUUID = :clientUUID AND connectionId <> :currentId',
          ExpressionAttributeValues: {
            ':clientUUID': clientUUID,
            ':currentId': connectionId,
          },
        }));

        // Delete old connections for this clientUUID
        for (const oldConn of (existingConnections.Items || [])) {
          console.log('Removing stale connection for clientUUID:', oldConn.connectionId);
          await docClient.send(new DeleteCommand({
            TableName: CONNECTIONS_TABLE,
            Key: { connectionId: oldConn.connectionId },
          }));
        }
      } catch (err) {
        console.log('Error cleaning up old connections:', err.message);
      }
    }

    // Update connection with client info (including Firebase user if logged in)
    await docClient.send(new UpdateCommand({
      TableName: CONNECTIONS_TABLE,
      Key: { connectionId },
      UpdateExpression: 'SET clientUUID = :clientUUID, userAgent = :userAgent, deviceId = :deviceId, userEmail = :userEmail, userName = :userName, lastPing = :lastPing',
      ExpressionAttributeValues: {
        ':clientUUID': clientUUID || null,
        ':userAgent': userAgent || null,
        ':deviceId': deviceId || null,
        ':userEmail': userEmail || null,
        ':userName': userName || null,
        ':lastPing': new Date().toISOString(),
      },
    }));

    // Send confirmation back to client
    await apiClient.send(new PostToConnectionCommand({
      ConnectionId: connectionId,
      Data: JSON.stringify({ type: 'identified', clientUUID, deviceId, timestamp: Date.now() }),
    }));

    // Notify all clients about the updated connection info
    await broadcastConnectionsUpdated(endpoint);

    return { statusCode: 200, body: 'Identified' };
  }

  // Handle device registration (legacy - now use identify)
  if (message.action === 'register') {
    const { deviceId } = message;
    console.log('Device registration:', connectionId, '->', deviceId);

    if (deviceId) {
      // Update connection with deviceId
      await docClient.send(new UpdateCommand({
        TableName: CONNECTIONS_TABLE,
        Key: { connectionId },
        UpdateExpression: 'SET deviceId = :deviceId, lastPing = :lastPing',
        ExpressionAttributeValues: {
          ':deviceId': deviceId,
          ':lastPing': new Date().toISOString(),
        },
      }));

      // Send confirmation back to client
      await apiClient.send(new PostToConnectionCommand({
        ConnectionId: connectionId,
        Data: JSON.stringify({ type: 'registered', deviceId, timestamp: Date.now() }),
      }));
    }
    return { statusCode: 200, body: 'Registered' };
  }

  // Handle subscribe (client wants to receive updates for a topic)
  if (message.action === 'subscribe') {
    const { topic } = message;
    console.log('Subscribe:', connectionId, '->', topic);

    if (topic) {
      await docClient.send(new UpdateCommand({
        TableName: CONNECTIONS_TABLE,
        Key: { connectionId },
        UpdateExpression: 'ADD subscriptions :topic',
        ExpressionAttributeValues: {
          ':topic': new Set([topic]),
        },
      }));

      await apiClient.send(new PostToConnectionCommand({
        ConnectionId: connectionId,
        Data: JSON.stringify({ type: 'subscribed', topic, timestamp: Date.now() }),
      }));
    }
    return { statusCode: 200, body: 'Subscribed' };
  }

  // Handle unsubscribe (client no longer wants updates for a topic)
  if (message.action === 'unsubscribe') {
    const { topic } = message;
    console.log('Unsubscribe:', connectionId, '->', topic);

    if (topic) {
      await docClient.send(new UpdateCommand({
        TableName: CONNECTIONS_TABLE,
        Key: { connectionId },
        UpdateExpression: 'DELETE subscriptions :topic',
        ExpressionAttributeValues: {
          ':topic': new Set([topic]),
        },
      }));

      await apiClient.send(new PostToConnectionCommand({
        ConnectionId: connectionId,
        Data: JSON.stringify({ type: 'unsubscribed', topic, timestamp: Date.now() }),
      }));
    }
    return { statusCode: 200, body: 'Unsubscribed' };
  }

  // Handle ping (keep-alive)
  if (message.action === 'ping') {
    // Update lastPing timestamp
    await docClient.send(new UpdateCommand({
      TableName: CONNECTIONS_TABLE,
      Key: { connectionId },
      UpdateExpression: 'SET lastPing = :lastPing',
      ExpressionAttributeValues: {
        ':lastPing': new Date().toISOString(),
      },
    }));

    await apiClient.send(new PostToConnectionCommand({
      ConnectionId: connectionId,
      Data: JSON.stringify({ type: 'pong', timestamp: Date.now() }),
    }));
    return { statusCode: 200, body: 'Pong' };
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
        return await handleConnect(connectionId, endpoint);

      case '$disconnect':
        return await handleDisconnect(connectionId, endpoint);

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
