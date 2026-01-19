/**
 * Admin API Lambda
 * Handles configuration management and multi-platform location linking
 *
 * Location Structure:
 * pk: "LOCATION", sk: "{PLATFORM}#{ID}"
 * Each location stores reciprocal links to other platforms
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, PutCommand, DeleteCommand, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { verifyAuth, unauthorizedResponse } from './auth.mjs';

const ddbClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(ddbClient);
const CONFIG_TABLE = process.env.CONFIG_TABLE || 'surreal-admin-config';

// CORS headers
const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// =====================
// CONFIG FUNCTIONS
// =====================

async function getConfig() {
  const result = await docClient.send(new ScanCommand({
    TableName: CONFIG_TABLE,
    FilterExpression: 'pk = :pk',
    ExpressionAttributeValues: { ':pk': 'CONFIG' },
  }));

  const config = {};
  (result.Items || []).forEach(item => {
    config[item.sk] = item.value;
  });
  return config;
}

async function updateConfig(configUpdates, updatedBy) {
  const results = [];
  const errors = [];

  for (const [key, value] of Object.entries(configUpdates)) {
    if (value === '' || value === null || value === undefined) {
      try {
        await docClient.send(new DeleteCommand({
          TableName: CONFIG_TABLE,
          Key: { pk: 'CONFIG', sk: key },
        }));
        results.push({ key, action: 'deleted' });
      } catch (error) {
        errors.push({ key, error: error.message });
      }
      continue;
    }

    try {
      await docClient.send(new PutCommand({
        TableName: CONFIG_TABLE,
        Item: {
          pk: 'CONFIG',
          sk: key,
          value: value,
          updatedAt: new Date().toISOString(),
          updatedBy: updatedBy || 'unknown',
        },
      }));
      results.push({ key, action: 'updated' });
    } catch (error) {
      errors.push({ key, error: error.message });
    }
  }

  return { results, errors };
}

// =====================
// LOCATION FUNCTIONS
// =====================

/**
 * Get all locations from DynamoDB
 */
async function getAllLocations() {
  const result = await docClient.send(new ScanCommand({
    TableName: CONFIG_TABLE,
    FilterExpression: 'pk = :pk',
    ExpressionAttributeValues: { ':pk': 'LOCATION' },
  }));

  return result.Items || [];
}

/**
 * Get locations by platform
 */
async function getLocationsByPlatform(platform) {
  const allLocations = await getAllLocations();
  return allLocations.filter(loc => loc.platform === platform);
}

/**
 * Get a single location by sk
 */
async function getLocation(sk) {
  const result = await docClient.send(new GetCommand({
    TableName: CONFIG_TABLE,
    Key: { pk: 'LOCATION', sk },
  }));
  return result.Item || null;
}

/**
 * Save/update a location
 */
async function saveLocation(locationData) {
  await docClient.send(new PutCommand({
    TableName: CONFIG_TABLE,
    Item: {
      pk: 'LOCATION',
      ...locationData,
      updatedAt: new Date().toISOString(),
    },
  }));
  return { success: true, sk: locationData.sk };
}

/**
 * Delete a location
 */
async function deleteLocation(sk) {
  // First, get the location to find its links
  const location = await getLocation(sk);
  if (location && location.links) {
    // Remove this location from all linked locations
    for (const linkedSk of Object.keys(location.links)) {
      await removeLink(linkedSk, sk);
    }
  }

  await docClient.send(new DeleteCommand({
    TableName: CONFIG_TABLE,
    Key: { pk: 'LOCATION', sk },
  }));
  return { success: true, sk };
}

/**
 * Sync Square locations from API to DynamoDB
 */
async function syncSquareLocations(config) {
  const squareAccessToken = config.SQUARE_ACCESS_TOKEN;
  if (!squareAccessToken) {
    throw new Error('Square Access Token not configured');
  }

  const response = await fetch('https://connect.squareup.com/v2/locations', {
    headers: {
      'Authorization': `Bearer ${squareAccessToken}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to fetch Square locations: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const squareLocations = data.locations || [];

  // Get existing Square locations from DynamoDB
  const existingLocations = await getLocationsByPlatform('square');
  const existingById = {};
  existingLocations.forEach(loc => {
    existingById[loc.sk] = loc;
  });

  const saved = [];
  for (const sq of squareLocations) {
    const sk = `SQUARE#${sq.id}`;
    const existing = existingById[sk];

    // Preserve existing secrets, but set accessToken from config if not already set
    const secrets = existing?.secrets || {};
    if (!secrets.accessToken) {
      secrets.accessToken = squareAccessToken;
    }

    await saveLocation({
      sk,
      platform: 'square',
      platformId: sq.id,
      name: sq.name,
      // Preserve existing links
      links: existing?.links || {},
      secrets,
      platformData: {
        address: sq.address?.address_line_1 || '',
        city: sq.address?.locality || '',
        state: sq.address?.administrative_district_level_1 || '',
        zip: sq.address?.postal_code || '',
        country: sq.address?.country || '',
        phone: sq.phone_number || '',
        status: sq.status,
        type: sq.type,
        businessName: sq.business_name,
      },
    });
    saved.push(sk);
  }

  return { saved, count: saved.length };
}

/**
 * Sync Shopify locations from API to DynamoDB
 */
async function syncShopifyLocations(config) {
  const storeDomain = config.SHOPIFY_STORE_DOMAIN;
  const accessToken = config.SHOPIFY_ACCESS_TOKEN;

  if (!storeDomain || !accessToken) {
    throw new Error('Shopify credentials not configured');
  }

  const response = await fetch(`https://${storeDomain}/admin/api/2024-01/locations.json`, {
    headers: { 'X-Shopify-Access-Token': accessToken },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch Shopify locations: ${response.status}`);
  }

  const data = await response.json();
  const shopifyLocations = data.locations || [];

  // Get existing Shopify locations from DynamoDB
  const existingLocations = await getLocationsByPlatform('shopify');
  const existingById = {};
  existingLocations.forEach(loc => {
    existingById[loc.sk] = loc;
  });

  const saved = [];
  for (const shop of shopifyLocations) {
    const sk = `SHOPIFY#${shop.id}`;
    const existing = existingById[sk];

    // Preserve existing secrets, but set from config if not already set
    const secrets = existing?.secrets || {};
    if (!secrets.accessToken) {
      secrets.accessToken = accessToken;
    }
    if (!secrets.storeDomain) {
      secrets.storeDomain = storeDomain;
    }

    await saveLocation({
      sk,
      platform: 'shopify',
      platformId: String(shop.id),
      name: shop.name,
      // Preserve existing links
      links: existing?.links || {},
      secrets,
      platformData: {
        address: shop.address1 || '',
        city: shop.city || '',
        state: shop.province || '',
        zip: shop.zip || '',
        country: shop.country_code || '',
        phone: shop.phone || '',
        active: shop.active,
      },
    });
    saved.push(sk);
  }

  return { saved, count: saved.length };
}

/**
 * Add a Shipday location manually
 */
async function addShipdayLocation(name, apiKey, updatedBy) {
  if (!name || !apiKey) {
    throw new Error('Name and API Key are required');
  }

  const sk = `SHIPDAY#${apiKey}`;

  // Check if already exists
  const existing = await getLocation(sk);

  await saveLocation({
    sk,
    platform: 'shipday',
    platformId: apiKey,
    name,
    links: existing?.links || {},
    secrets: { apiKey },
    platformData: existing?.platformData || {},
    createdBy: updatedBy,
  });

  return { success: true, sk };
}

/**
 * Update a Shipday location
 */
async function updateShipdayLocation(sk, updates, updatedBy) {
  const existing = await getLocation(sk);
  if (!existing || existing.platform !== 'shipday') {
    throw new Error('Shipday location not found');
  }

  await saveLocation({
    ...existing,
    name: updates.name || existing.name,
    updatedBy,
  });

  return { success: true, sk };
}

/**
 * Update a Shipday location's API key
 * Since API key is the ID, this requires creating a new record and updating all links
 */
async function updateShipdayApiKey(oldSk, newApiKey, updatedBy) {
  const existing = await getLocation(oldSk);
  if (!existing || existing.platform !== 'shipday') {
    throw new Error('Shipday location not found');
  }

  const newSk = `SHIPDAY#${newApiKey}`;

  // If API key hasn't changed, nothing to do
  if (oldSk === newSk) {
    return { success: true, oldSk, newSk, message: 'No change' };
  }

  // Check if new API key already exists
  const existingNew = await getLocation(newSk);
  if (existingNew) {
    throw new Error('A Shipday location with this API key already exists');
  }

  // Create new location with same name and links
  await saveLocation({
    sk: newSk,
    platform: 'shipday',
    platformId: newApiKey,
    name: existing.name,
    links: existing.links || {},
    secrets: { apiKey: newApiKey },
    platformData: existing.platformData || {},
    createdBy: existing.createdBy,
    updatedBy,
  });

  // Update all linked locations to point to the new sk
  if (existing.links) {
    for (const linkedSk of Object.keys(existing.links)) {
      const linkedLoc = await getLocation(linkedSk);
      if (linkedLoc && linkedLoc.links) {
        // Remove old reference, add new reference
        const newLinks = { ...linkedLoc.links };
        delete newLinks[oldSk];
        newLinks[newSk] = true;

        await docClient.send(new UpdateCommand({
          TableName: CONFIG_TABLE,
          Key: { pk: 'LOCATION', sk: linkedSk },
          UpdateExpression: 'SET links = :links, updatedAt = :updatedAt',
          ExpressionAttributeValues: {
            ':links': newLinks,
            ':updatedAt': new Date().toISOString(),
          },
        }));
      }
    }
  }

  // Delete old location
  await docClient.send(new DeleteCommand({
    TableName: CONFIG_TABLE,
    Key: { pk: 'LOCATION', sk: oldSk },
  }));

  return { success: true, oldSk, newSk };
}

// =====================
// DEVICE FUNCTIONS
// =====================

const CONNECTIONS_TABLE = process.env.CONNECTIONS_TABLE || 'surreal-websocket-connections';

/**
 * Generate a random 6-digit registration code
 */
function generateRegistrationCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Generate a unique device ID
 */
function generateDeviceId() {
  return `DEV#${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 8)}`;
}

/**
 * Get all devices from DynamoDB
 */
async function getAllDevices() {
  const result = await docClient.send(new ScanCommand({
    TableName: CONFIG_TABLE,
    FilterExpression: 'pk = :pk',
    ExpressionAttributeValues: { ':pk': 'DEVICE' },
  }));
  return result.Items || [];
}

/**
 * Get a single device by sk
 */
async function getDevice(sk) {
  const result = await docClient.send(new GetCommand({
    TableName: CONFIG_TABLE,
    Key: { pk: 'DEVICE', sk },
  }));
  return result.Item || null;
}

/**
 * Get device by registration code
 */
async function getDeviceByCode(code) {
  const devices = await getAllDevices();
  // Registration codes are permanent - no expiration check
  return devices.find(d => d.platformData?.registrationCode === code) || null;
}

/**
 * Get device by client UUID
 */
async function getDeviceByClientUUID(clientUUID) {
  const devices = await getAllDevices();
  return devices.find(d => d.platformData?.clientUUID === clientUUID) || null;
}

/**
 * Create a new device
 */
async function createDevice(name, createdBy) {
  const sk = generateDeviceId();
  const registrationCode = generateRegistrationCode();

  const device = {
    pk: 'DEVICE',
    sk,
    name,
    status: 'pending', // pending until registered
    platformData: {
      registrationCode, // Permanent code - can be reused to re-link device
      clientUUID: null,
      deviceType: null,
      userAgent: null,
      lastSeenAt: null,
    },
    createdAt: new Date().toISOString(),
    createdBy,
    updatedAt: new Date().toISOString(),
  };

  await docClient.send(new PutCommand({
    TableName: CONFIG_TABLE,
    Item: device,
  }));

  return device;
}

/**
 * Update a device
 */
async function updateDevice(sk, updates, updatedBy) {
  const existing = await getDevice(sk);
  if (!existing) {
    throw new Error('Device not found');
  }

  const updated = {
    ...existing,
    name: updates.name ?? existing.name,
    status: updates.status ?? existing.status,
    platformData: {
      ...existing.platformData,
      ...(updates.platformData || {}),
    },
    updatedAt: new Date().toISOString(),
    updatedBy,
  };

  await docClient.send(new PutCommand({
    TableName: CONFIG_TABLE,
    Item: updated,
  }));

  return updated;
}

/**
 * Generate a new registration code for an existing device
 */
async function regenerateRegistrationCode(sk, updatedBy) {
  const existing = await getDevice(sk);
  if (!existing) {
    throw new Error('Device not found');
  }

  const registrationCode = generateRegistrationCode();

  const updated = {
    ...existing,
    status: 'pending',
    platformData: {
      ...existing.platformData,
      registrationCode, // Permanent code - no expiration
      clientUUID: null, // Clear old client UUID so new tablet can link
    },
    updatedAt: new Date().toISOString(),
    updatedBy,
  };

  await docClient.send(new PutCommand({
    TableName: CONFIG_TABLE,
    Item: updated,
  }));

  return { sk, registrationCode };
}

/**
 * Register a device (tablet claims it with code)
 * Called by tablet, not admin
 */
async function registerDevice(code, clientUUID, userAgent) {
  const device = await getDeviceByCode(code);
  if (!device) {
    throw new Error('Invalid or expired registration code');
  }

  // Check if clientUUID is already used by another device
  const existingDevice = await getDeviceByClientUUID(clientUUID);
  if (existingDevice && existingDevice.sk !== device.sk) {
    throw new Error('This device is already registered to another record');
  }

  const updated = {
    ...device,
    status: 'active',
    platformData: {
      ...device.platformData,
      // Keep registrationCode - it can be reused to re-link if tablet is reset
      clientUUID,
      userAgent,
      registeredAt: new Date().toISOString(),
      lastSeenAt: new Date().toISOString(),
    },
    updatedAt: new Date().toISOString(),
  };

  await docClient.send(new PutCommand({
    TableName: CONFIG_TABLE,
    Item: updated,
  }));

  return { deviceId: device.sk, name: device.name };
}

/**
 * Delete a device
 */
async function deleteDevice(sk) {
  await docClient.send(new DeleteCommand({
    TableName: CONFIG_TABLE,
    Key: { pk: 'DEVICE', sk },
  }));
  return { success: true, sk };
}

/**
 * Get all active WebSocket connections with device info
 */
async function getActiveConnections() {
  // Get all connections
  const connectionsResult = await docClient.send(new ScanCommand({
    TableName: CONNECTIONS_TABLE,
  }));
  const connections = connectionsResult.Items || [];

  // Get all devices for lookup
  const devices = await getAllDevices();
  const deviceMapById = {};
  const deviceMapByClientUUID = {};
  devices.forEach(d => {
    deviceMapById[d.sk] = d;
    if (d.platformData?.clientUUID) {
      deviceMapByClientUUID[d.platformData.clientUUID] = d;
    }
  });

  // Enrich connections with device info
  return connections.map(conn => {
    // Try to find device by deviceId first, then by clientUUID
    let device = conn.deviceId ? deviceMapById[conn.deviceId] : null;
    if (!device && conn.clientUUID) {
      device = deviceMapByClientUUID[conn.clientUUID];
    }

    return {
      connectionId: conn.connectionId,
      clientUUID: conn.clientUUID || null,
      userAgent: conn.userAgent || null,
      deviceId: device?.sk || conn.deviceId || null,
      deviceName: device?.name || null,
      deviceStatus: device?.status || 'unregistered',
      registrationCode: device?.platformData?.registrationCode || null,
      connectedAt: conn.connectedAt,
      lastPing: conn.lastPing,
    };
  });
}

/**
 * Create a device directly from a connection (by clientUUID or connectionId)
 * This immediately registers the device without needing a code
 */
async function createDeviceFromConnection(name, clientUUID, userAgent, connectionId, createdBy) {
  // If no clientUUID provided, generate one
  let finalClientUUID = clientUUID;
  if (!finalClientUUID) {
    finalClientUUID = `generated-${crypto.randomUUID()}`;

    // If we have a connectionId, update the connection with this new clientUUID
    if (connectionId) {
      try {
        await docClient.send(new UpdateCommand({
          TableName: CONNECTIONS_TABLE,
          Key: { connectionId },
          UpdateExpression: 'SET clientUUID = :clientUUID',
          ExpressionAttributeValues: {
            ':clientUUID': finalClientUUID,
          },
        }));
      } catch (err) {
        console.log('Could not update connection with clientUUID:', err.message);
      }
    }
  }

  // Check if a device already exists for this clientUUID
  const existingDevice = await getDeviceByClientUUID(finalClientUUID);
  if (existingDevice) {
    throw new Error('A device with this clientUUID already exists');
  }

  const sk = generateDeviceId();
  const registrationCode = generateRegistrationCode(); // Generate code for future re-linking

  const device = {
    pk: 'DEVICE',
    sk,
    name,
    status: 'active', // Immediately active since we're linking to a live connection
    platformData: {
      registrationCode, // Permanent code - can be used to re-link if tablet is reset
      clientUUID: finalClientUUID,
      userAgent,
      registeredAt: new Date().toISOString(),
      lastSeenAt: new Date().toISOString(),
    },
    createdAt: new Date().toISOString(),
    createdBy,
    updatedAt: new Date().toISOString(),
  };

  await docClient.send(new PutCommand({
    TableName: CONFIG_TABLE,
    Item: device,
  }));

  return device;
}

/**
 * Send a command to devices via WebSocket
 * Requires WebSocket endpoint to be configured
 */
async function sendDeviceCommand(command, deviceIds = null) {
  const { ApiGatewayManagementApiClient, PostToConnectionCommand } = await import('@aws-sdk/client-apigatewaymanagementapi');

  // Get WebSocket endpoint from config
  const config = await getConfig();
  const wsEndpoint = config.WEBSOCKET_ENDPOINT;

  if (!wsEndpoint) {
    throw new Error('WEBSOCKET_ENDPOINT not configured');
  }

  const apiClient = new ApiGatewayManagementApiClient({ endpoint: wsEndpoint });

  // Get connections
  const connectionsResult = await docClient.send(new ScanCommand({
    TableName: CONNECTIONS_TABLE,
  }));
  const connections = connectionsResult.Items || [];

  // Filter by deviceIds or connectionIds if specified
  let targetConnections = connections;
  if (deviceIds && deviceIds.length > 0) {
    // deviceIds can be actual deviceIds, connectionIds, or clientUUIDs
    targetConnections = connections.filter(c =>
      deviceIds.includes(c.deviceId) ||
      deviceIds.includes(c.connectionId) ||
      deviceIds.includes(c.clientUUID)
    );
  }

  const message = JSON.stringify({
    type: 'command',
    command,
    timestamp: Date.now(),
  });

  const results = { sent: 0, failed: 0, stale: 0 };

  for (const conn of targetConnections) {
    try {
      await apiClient.send(new PostToConnectionCommand({
        ConnectionId: conn.connectionId,
        Data: message,
      }));
      results.sent++;
    } catch (error) {
      if (error.statusCode === 410 || error.name === 'GoneException') {
        // Stale connection, remove it
        await docClient.send(new DeleteCommand({
          TableName: CONNECTIONS_TABLE,
          Key: { connectionId: conn.connectionId },
        }));
        results.stale++;
      } else {
        console.error('Failed to send to', conn.connectionId, error.message);
        results.failed++;
      }
    }
  }

  return results;
}

// =====================
// LINKING FUNCTIONS
// =====================

/**
 * Add a link from one location to another (one direction)
 */
async function addLink(fromSk, toSk) {
  const location = await getLocation(fromSk);
  if (!location) {
    throw new Error(`Location ${fromSk} not found`);
  }

  const links = location.links || {};
  links[toSk] = true;

  await docClient.send(new UpdateCommand({
    TableName: CONFIG_TABLE,
    Key: { pk: 'LOCATION', sk: fromSk },
    UpdateExpression: 'SET links = :links, updatedAt = :updatedAt',
    ExpressionAttributeValues: {
      ':links': links,
      ':updatedAt': new Date().toISOString(),
    },
  }));
}

/**
 * Remove a link from one location to another (one direction)
 */
async function removeLink(fromSk, toSk) {
  const location = await getLocation(fromSk);
  if (!location || !location.links) return;

  const links = { ...location.links };
  delete links[toSk];

  await docClient.send(new UpdateCommand({
    TableName: CONFIG_TABLE,
    Key: { pk: 'LOCATION', sk: fromSk },
    UpdateExpression: 'SET links = :links, updatedAt = :updatedAt',
    ExpressionAttributeValues: {
      ':links': links,
      ':updatedAt': new Date().toISOString(),
    },
  }));
}

/**
 * Link two locations together (reciprocal)
 */
async function linkLocations(sk1, sk2) {
  if (sk1 === sk2) {
    throw new Error('Cannot link a location to itself');
  }

  // Verify both locations exist
  const loc1 = await getLocation(sk1);
  const loc2 = await getLocation(sk2);

  if (!loc1) throw new Error(`Location ${sk1} not found`);
  if (!loc2) throw new Error(`Location ${sk2} not found`);

  // Add reciprocal links
  await addLink(sk1, sk2);
  await addLink(sk2, sk1);

  return { success: true, linked: [sk1, sk2] };
}

/**
 * Unlink two locations (reciprocal)
 */
async function unlinkLocations(sk1, sk2) {
  console.log('Unlinking:', { sk1, sk2 });

  await removeLink(sk1, sk2);
  await removeLink(sk2, sk1);
  return { success: true, unlinked: [sk1, sk2] };
}

/**
 * Get linked location groups
 * Returns clusters of connected locations
 */
async function getLinkedGroups() {
  const allLocations = await getAllLocations();

  // Build a map for quick lookup
  const locationMap = {};
  allLocations.forEach(loc => {
    locationMap[loc.sk] = loc;
  });

  // Find connected components using Union-Find approach
  const visited = new Set();
  const groups = [];

  function findConnected(sk, group) {
    if (visited.has(sk)) return;
    visited.add(sk);

    const location = locationMap[sk];
    if (!location) return;

    group.push(location);

    // Visit all linked locations
    if (location.links) {
      for (const linkedSk of Object.keys(location.links)) {
        findConnected(linkedSk, group);
      }
    }
  }

  // Find all groups
  for (const loc of allLocations) {
    if (!visited.has(loc.sk) && loc.links && Object.keys(loc.links).length > 0) {
      const group = [];
      findConnected(loc.sk, group);
      if (group.length > 1) {
        groups.push(group);
      }
    }
  }

  return groups;
}

/**
 * Get location config by any ID (for orders lookup)
 * Accepts: platformId, sk, or just the ID portion
 */
async function getLocationConfig(locationId) {
  // Try direct lookup first (if it's already a full sk)
  let location = await getLocation(locationId);

  // If not found, try with platform prefixes
  if (!location) {
    for (const prefix of ['SQUARE#', 'SHOPIFY#', 'SHIPDAY#']) {
      location = await getLocation(`${prefix}${locationId}`);
      if (location) break;
    }
  }

  if (!location) return null;

  // Get linked locations for cross-reference
  const linkedLocations = {};
  if (location.links) {
    for (const linkedSk of Object.keys(location.links)) {
      const linked = await getLocation(linkedSk);
      if (linked) {
        linkedLocations[linked.platform] = {
          sk: linked.sk,
          platformId: linked.platformId,
          name: linked.name,
          apiKey: linked.secrets?.apiKey, // for Shipday
        };
      }
    }
  }

  return {
    ...location,
    linkedLocations,
  };
}

// =====================
// HANDLER
// =====================

export const handler = async (event) => {
  console.log('Received event:', JSON.stringify(event));

  const method = event.requestContext?.http?.method || event.httpMethod;

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
    if (method === 'POST') {
      const body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
      const { action } = body || {};

      // ===== CONFIG ACTIONS =====
      if (action === 'getConfig') {
        const config = await getConfig();
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ success: true, config }),
        };
      }

      if (action === 'updateConfig') {
        const { config: configUpdates, updatedBy } = body;
        if (!configUpdates) {
          return { statusCode: 400, headers, body: JSON.stringify({ error: 'config object is required' }) };
        }
        const result = await updateConfig(configUpdates, updatedBy);
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ success: true, ...result }),
        };
      }

      // ===== LOCATION ACTIONS =====
      if (action === 'getLocations') {
        const { platform } = body;
        const locations = platform
          ? await getLocationsByPlatform(platform)
          : await getAllLocations();

        // Group by platform for convenience
        const byPlatform = { square: [], shopify: [], shipday: [] };
        locations.forEach(loc => {
          if (byPlatform[loc.platform]) {
            byPlatform[loc.platform].push(loc);
          }
        });

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ success: true, locations, byPlatform }),
        };
      }

      if (action === 'syncLocations') {
        const config = await getConfig();
        const results = { square: null, shopify: null };

        try {
          results.square = await syncSquareLocations(config);
        } catch (e) {
          results.square = { error: e.message };
        }

        try {
          results.shopify = await syncShopifyLocations(config);
        } catch (e) {
          results.shopify = { error: e.message };
        }

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ success: true, synced: results }),
        };
      }

      if (action === 'addShipdayLocation') {
        const { name, apiKey, updatedBy } = body;
        if (!name || !apiKey) {
          return { statusCode: 400, headers, body: JSON.stringify({ error: 'name and apiKey are required' }) };
        }
        const result = await addShipdayLocation(name, apiKey, updatedBy);
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ success: true, ...result }),
        };
      }

      if (action === 'updateShipdayLocation') {
        const { sk, updates, updatedBy } = body;
        if (!sk || !updates) {
          return { statusCode: 400, headers, body: JSON.stringify({ error: 'sk and updates are required' }) };
        }
        const result = await updateShipdayLocation(sk, updates, updatedBy);
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ success: true, ...result }),
        };
      }

      if (action === 'updateShipdayApiKey') {
        const { sk, newApiKey, updatedBy } = body;
        if (!sk || !newApiKey) {
          return { statusCode: 400, headers, body: JSON.stringify({ error: 'sk and newApiKey are required' }) };
        }
        const result = await updateShipdayApiKey(sk, newApiKey, updatedBy);
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ success: true, ...result }),
        };
      }

      if (action === 'updateLocationSecrets') {
        const { sk, secrets, updatedBy } = body;
        if (!sk || !secrets) {
          return { statusCode: 400, headers, body: JSON.stringify({ error: 'sk and secrets are required' }) };
        }

        // Get existing location
        const existing = await getLocation(sk);
        if (!existing) {
          return { statusCode: 404, headers, body: JSON.stringify({ error: 'Location not found' }) };
        }

        // Merge new secrets with existing
        const mergedSecrets = { ...existing.secrets, ...secrets };

        // Save updated location
        await saveLocation({
          ...existing,
          secrets: mergedSecrets,
          updatedBy,
          updatedAt: new Date().toISOString(),
        });

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ success: true, sk, message: 'Secrets updated' }),
        };
      }

      if (action === 'deleteLocation') {
        const { sk } = body;
        if (!sk) {
          return { statusCode: 400, headers, body: JSON.stringify({ error: 'sk is required' }) };
        }
        const result = await deleteLocation(sk);
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ success: true, ...result }),
        };
      }

      if (action === 'getLocationConfig') {
        const { locationId } = body;
        if (!locationId) {
          return { statusCode: 400, headers, body: JSON.stringify({ error: 'locationId is required' }) };
        }
        const config = await getLocationConfig(locationId);
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ success: true, config }),
        };
      }

      // ===== LINKING ACTIONS =====
      if (action === 'linkLocations') {
        const { sk1, sk2 } = body;
        if (!sk1 || !sk2) {
          return { statusCode: 400, headers, body: JSON.stringify({ error: 'sk1 and sk2 are required' }) };
        }
        const result = await linkLocations(sk1, sk2);
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ success: true, ...result }),
        };
      }

      if (action === 'unlinkLocations') {
        const { sk1, sk2 } = body;
        if (!sk1 || !sk2) {
          return { statusCode: 400, headers, body: JSON.stringify({ error: 'sk1 and sk2 are required' }) };
        }
        const result = await unlinkLocations(sk1, sk2);
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ success: true, ...result }),
        };
      }

      if (action === 'getLinkedGroups') {
        const groups = await getLinkedGroups();
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ success: true, groups }),
        };
      }

      // Migrate locations to new structure with secrets and platformData
      if (action === 'migrateLocationStructure') {
        const locations = await getAllLocations();
        let migratedCount = 0;
        const coreFields = ['pk', 'sk', 'platform', 'platformId', 'name', 'links', 'secrets', 'platformData', 'updatedAt', 'createdAt', 'createdBy', 'updatedBy'];

        for (const location of locations) {
          const newLocation = {
            pk: location.pk,
            sk: location.sk,
            platform: location.platform,
            platformId: location.platformId,
            name: location.name,
            links: location.links || {},
            secrets: location.secrets || {},
            platformData: location.platformData || {},
            updatedAt: new Date().toISOString(),
          };

          // Move apiKey to secrets (for Shipday)
          if (location.apiKey && !newLocation.secrets.apiKey) {
            newLocation.secrets.apiKey = location.apiKey;
          }

          // Move all other fields to platformData
          for (const [key, value] of Object.entries(location)) {
            if (!coreFields.includes(key) && key !== 'apiKey') {
              newLocation.platformData[key] = value;
            }
          }

          // Preserve createdAt/createdBy if they exist
          if (location.createdAt) newLocation.createdAt = location.createdAt;
          if (location.createdBy) newLocation.createdBy = location.createdBy;

          await docClient.send(new PutCommand({
            TableName: CONFIG_TABLE,
            Item: newLocation,
          }));
          migratedCount++;
        }

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ success: true, migratedCount }),
        };
      }

      // ===== DEVICE ACTIONS =====
      if (action === 'getDevices') {
        const devices = await getAllDevices();
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ success: true, devices }),
        };
      }

      if (action === 'getDevice') {
        const { sk } = body;
        if (!sk) {
          return { statusCode: 400, headers, body: JSON.stringify({ error: 'sk is required' }) };
        }
        const device = await getDevice(sk);
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ success: true, device }),
        };
      }

      if (action === 'createDevice') {
        const { name } = body;
        if (!name) {
          return { statusCode: 400, headers, body: JSON.stringify({ error: 'name is required' }) };
        }
        const device = await createDevice(name, auth.email);
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ success: true, device }),
        };
      }

      if (action === 'createDeviceFromConnection') {
        const { name, clientUUID, userAgent, connectionId } = body;
        if (!name) {
          return { statusCode: 400, headers, body: JSON.stringify({ error: 'name is required' }) };
        }
        const device = await createDeviceFromConnection(name, clientUUID, userAgent, connectionId, auth.email);
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ success: true, device }),
        };
      }

      if (action === 'updateDevice') {
        const { sk, updates } = body;
        if (!sk) {
          return { statusCode: 400, headers, body: JSON.stringify({ error: 'sk is required' }) };
        }
        const device = await updateDevice(sk, updates || {}, auth.email);
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ success: true, device }),
        };
      }

      if (action === 'deleteDevice') {
        const { sk } = body;
        if (!sk) {
          return { statusCode: 400, headers, body: JSON.stringify({ error: 'sk is required' }) };
        }
        const result = await deleteDevice(sk);
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ success: true, ...result }),
        };
      }

      if (action === 'regenerateRegistrationCode') {
        const { sk } = body;
        if (!sk) {
          return { statusCode: 400, headers, body: JSON.stringify({ error: 'sk is required' }) };
        }
        const result = await regenerateRegistrationCode(sk, auth.email);
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ success: true, ...result }),
        };
      }

      if (action === 'registerDevice') {
        const { code, clientUUID, userAgent } = body;
        if (!code || !clientUUID) {
          return { statusCode: 400, headers, body: JSON.stringify({ error: 'code and clientUUID are required' }) };
        }
        const result = await registerDevice(code, clientUUID, userAgent);
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ success: true, ...result }),
        };
      }

      if (action === 'getActiveConnections') {
        const connections = await getActiveConnections();
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ success: true, connections }),
        };
      }

      if (action === 'sendDeviceCommand') {
        const { command, deviceIds } = body;
        if (!command) {
          return { statusCode: 400, headers, body: JSON.stringify({ error: 'command is required' }) };
        }
        const result = await sendDeviceCommand(command, deviceIds);
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ success: true, ...result }),
        };
      }

      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: 'Invalid action',
          validActions: [
            'getConfig', 'updateConfig',
            'getLocations', 'syncLocations', 'addShipdayLocation', 'updateShipdayLocation', 'updateShipdayApiKey', 'deleteLocation', 'getLocationConfig',
            'linkLocations', 'unlinkLocations', 'getLinkedGroups', 'migrateLocationStructure',
            'getDevices', 'createDevice', 'updateDevice', 'deleteDevice', 'regenerateRegistrationCode', 'registerDevice',
            'getActiveConnections', 'sendDeviceCommand'
          ],
        }),
      };
    }

    // GET - Return config
    const config = await getConfig();
    return { statusCode: 200, headers, body: JSON.stringify({ success: true, config }) };

  } catch (error) {
    console.error('Error:', error);
    return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
  }
};
