/**
 * Broadcast helper for sending real-time updates via WebSocket
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { ApiGatewayManagementApiClient, PostToConnectionCommand } from '@aws-sdk/client-apigatewaymanagementapi';

const ddbClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(ddbClient);
const CONNECTIONS_TABLE = process.env.CONNECTIONS_TABLE || 'surreal-websocket-connections';
const WEBSOCKET_ENDPOINT = process.env.WEBSOCKET_ENDPOINT; // e.g., 'https://abc123.execute-api.us-east-1.amazonaws.com/production'

/**
 * Broadcast a new order to all connected WebSocket clients
 */
export async function broadcastNewOrder(orderData) {
  if (!WEBSOCKET_ENDPOINT) {
    console.log('WEBSOCKET_ENDPOINT not configured, skipping broadcast');
    return;
  }

  try {
    const apiClient = new ApiGatewayManagementApiClient({
      endpoint: WEBSOCKET_ENDPOINT
    });

    // Get all connections
    const result = await docClient.send(new ScanCommand({
      TableName: CONNECTIONS_TABLE,
    }));

    const connections = result.Items || [];
    console.log(`Broadcasting new order to ${connections.length} connections`);

    const message = JSON.stringify({
      type: 'new_order',
      order: {
        orderId: orderData.shopifyOrderId,
        orderNumber: orderData.orderNumber,
        customerName: orderData.customerName,
        totalPrice: orderData.totalPrice,
        locationName: orderData.locationName,
        status: orderData.status,
        createdAt: orderData.createdAt,
        deliveryType: orderData.deliveryType,
        shippingMethod: orderData.shippingMethod,
      },
      timestamp: Date.now(),
    });

    // Send to all connections in parallel
    const sendPromises = connections.map(async ({ connectionId }) => {
      try {
        await apiClient.send(new PostToConnectionCommand({
          ConnectionId: connectionId,
          Data: message,
        }));
        console.log('Sent to', connectionId);
      } catch (error) {
        if (error.statusCode === 410 || error.name === 'GoneException') {
          // Connection is stale, remove it
          console.log('Removing stale connection:', connectionId);
          await docClient.send(new DeleteCommand({
            TableName: CONNECTIONS_TABLE,
            Key: { connectionId },
          }));
        } else {
          console.error('Failed to send to', connectionId, error.message);
        }
      }
    });

    await Promise.all(sendPromises);
    console.log('Broadcast complete');
  } catch (error) {
    console.error('Broadcast error:', error);
    // Don't throw - we don't want broadcast failures to break order processing
  }
}
