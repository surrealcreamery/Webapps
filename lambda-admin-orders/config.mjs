/**
 * Config Helper
 * Fetches configuration from DynamoDB with environment variable fallback
 * Caches config for Lambda execution lifetime
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';

const ddbClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(ddbClient);
const CONFIG_TABLE = process.env.CONFIG_TABLE || 'surreal-admin-config';

// Cache config for Lambda execution lifetime
let configCache = null;
let configCacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Get all config from DynamoDB
 * Returns object with config key-value pairs
 */
async function fetchConfigFromDynamoDB() {
  try {
    const result = await docClient.send(new ScanCommand({
      TableName: CONFIG_TABLE,
      FilterExpression: 'pk = :pk',
      ExpressionAttributeValues: { ':pk': 'CONFIG' },
    }));

    const config = {};
    (result.Items || []).forEach(item => {
      config[item.sk] = item.value;
    });

    console.log('[Config] Loaded from DynamoDB:', Object.keys(config).join(', '));
    return config;
  } catch (error) {
    console.error('[Config] Failed to load from DynamoDB:', error.message);
    return {};
  }
}

/**
 * Get config value with environment variable fallback
 * @param {string} key - Config key (e.g., 'SHOPIFY_STORE_DOMAIN')
 * @returns {Promise<string|null>} Config value or null
 */
export async function getConfigValue(key) {
  // Check cache first
  const now = Date.now();
  if (!configCache || (now - configCacheTime) > CACHE_TTL) {
    configCache = await fetchConfigFromDynamoDB();
    configCacheTime = now;
  }

  // Try DynamoDB first, then environment variable
  if (configCache[key]) {
    return configCache[key];
  }

  // Fallback to environment variable
  const envValue = process.env[key];
  if (envValue) {
    console.log(`[Config] Using env var fallback for ${key}`);
  }
  return envValue || null;
}

/**
 * Get multiple config values at once
 * @param {string[]} keys - Array of config keys
 * @returns {Promise<Object>} Object with key-value pairs
 */
export async function getConfig(keys) {
  const config = {};
  for (const key of keys) {
    config[key] = await getConfigValue(key);
  }
  return config;
}

/**
 * Clear config cache (useful for testing or forcing refresh)
 */
export function clearConfigCache() {
  configCache = null;
  configCacheTime = 0;
}
