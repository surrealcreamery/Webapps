/**
 * Firebase Auth verification for Lambda
 * Verifies Firebase ID tokens from the Authorization header
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

// Initialize Firebase Admin (lazy initialization)
let firebaseApp = null;

function getFirebaseApp() {
  if (firebaseApp || getApps().length > 0) {
    return firebaseApp || getApps()[0];
  }

  // Initialize with project ID only - this works for token verification
  // The service account credentials are optional for just verifying tokens
  const projectId = process.env.FIREBASE_PROJECT_ID || 'dollar-boba-club-subscriptions';

  firebaseApp = initializeApp({
    projectId,
  });

  return firebaseApp;
}

/**
 * Verify Firebase ID token from request
 * @param {Object} event - Lambda event object
 * @returns {Object} { valid: boolean, uid?: string, email?: string, error?: string }
 */
export async function verifyAuth(event) {
  try {
    console.log('[Auth] Received headers:', JSON.stringify(Object.keys(event.headers || {})));

    // Get Authorization header
    const authHeader = event.headers?.authorization || event.headers?.Authorization;
    console.log('[Auth] Authorization header present:', !!authHeader);

    if (!authHeader) {
      console.log('[Auth] No authorization header found');
      return { valid: false, error: 'No authorization header' };
    }

    // Extract token from "Bearer <token>"
    const token = authHeader.startsWith('Bearer ')
      ? authHeader.slice(7)
      : authHeader;

    console.log('[Auth] Token length:', token?.length, 'Token prefix:', token?.substring(0, 30) + '...');

    if (!token) {
      return { valid: false, error: 'No token provided' };
    }

    // Verify the token
    const projectId = process.env.FIREBASE_PROJECT_ID || 'dollar-boba-club-subscriptions';
    console.log('[Auth] Using project ID:', projectId);

    const app = getFirebaseApp();
    const auth = getAuth(app);

    console.log('[Auth] Verifying token...');
    const decodedToken = await auth.verifyIdToken(token);
    console.log('[Auth] Token verified successfully for:', decodedToken.email);

    return {
      valid: true,
      uid: decodedToken.uid,
      email: decodedToken.email,
      name: decodedToken.name,
    };
  } catch (error) {
    console.error('[Auth] Verification failed:', error.message);
    console.error('[Auth] Full error:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
    return { valid: false, error: error.message };
  }
}

/**
 * Create unauthorized response
 */
export function unauthorizedResponse(message = 'Unauthorized') {
  return {
    statusCode: 401,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
    body: JSON.stringify({ error: message }),
  };
}
