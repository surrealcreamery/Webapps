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
    // Get Authorization header
    const authHeader = event.headers?.authorization || event.headers?.Authorization;

    if (!authHeader) {
      return { valid: false, error: 'No authorization header' };
    }

    // Extract token from "Bearer <token>"
    const token = authHeader.startsWith('Bearer ')
      ? authHeader.slice(7)
      : authHeader;

    if (!token) {
      return { valid: false, error: 'No token provided' };
    }

    // Verify the token
    const app = getFirebaseApp();
    const auth = getAuth(app);
    const decodedToken = await auth.verifyIdToken(token);

    return {
      valid: true,
      uid: decodedToken.uid,
      email: decodedToken.email,
      name: decodedToken.name,
    };
  } catch (error) {
    console.error('Auth verification failed:', error.message);
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
