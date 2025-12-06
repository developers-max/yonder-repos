/**
 * Google Cloud Authentication Module
 * Shared authentication utilities for Cloud Run services
 * Provides automatic token refresh and fallback mechanisms
 */

import { GoogleAuth, IdTokenClient } from 'google-auth-library';

// Environment variables
const GCLOUD_TOKEN = process.env.GCLOUD_TOKEN;
const USE_GCLOUD_AUTH = process.env.USE_GCLOUD_AUTH === 'true';
const GOOGLE_SERVICE_ACCOUNT_JSON = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;

// Cache for GoogleAuth instances per target URL
const googleAuthCache = new Map<string, GoogleAuth>();

/**
 * Initialize Google Auth client for a specific target URL
 * Uses caching to avoid recreating auth clients
 */
function getGoogleAuthClient(targetUrl: string): GoogleAuth | null {
  if (!USE_GCLOUD_AUTH) {
    return null;
  }

  // Return cached instance if available
  if (googleAuthCache.has(targetUrl)) {
    return googleAuthCache.get(targetUrl)!;
  }

  const authOptions: ConstructorParameters<typeof GoogleAuth>[0] = {
    // DO NOT specify scopes for identity tokens - they conflict with audience
  };

  // Option 1: Use service account JSON from environment variable
  if (GOOGLE_SERVICE_ACCOUNT_JSON) {
    try {
      const credentials = JSON.parse(GOOGLE_SERVICE_ACCOUNT_JSON);
      authOptions.credentials = credentials;
      console.log(`[gcloud-auth] Using service account from GOOGLE_SERVICE_ACCOUNT_JSON for ${targetUrl}`);
    } catch (error) {
      console.error(`[gcloud-auth] Failed to parse GOOGLE_SERVICE_ACCOUNT_JSON:`, error);
    }
  }
  // Option 2: Use GOOGLE_APPLICATION_CREDENTIALS file path or ADC
  else {
    console.log(`[gcloud-auth] Using Application Default Credentials (ADC) for ${targetUrl}`);
  }

  const googleAuth = new GoogleAuth(authOptions);
  googleAuthCache.set(targetUrl, googleAuth);
  return googleAuth;
}

/**
 * Get headers with bearer token authentication
 * Automatically refreshes Google Cloud tokens when expired
 * Uses identity tokens for Cloud Run authentication
 * 
 * @param targetUrl - The Cloud Run service URL (used as the audience for OIDC tokens)
 * @param serviceName - Service name for logging (e.g., 'yonder-agent', 'yonder-enrich')
 * @param additionalHeaders - Additional headers to include
 * @returns Headers object with authentication
 */
export async function getAuthHeaders(
  targetUrl: string,
  serviceName: string = 'service',
  additionalHeaders: Record<string, string> = {}
): Promise<Record<string, string>> {
  const headers: Record<string, string> = { ...additionalHeaders };
  const googleAuth = getGoogleAuthClient(targetUrl);
  
  // Option 1: Use Google Auth Library for automatic token refresh
  if (googleAuth) {
    try {
      // For Cloud Run, we need an identity token (OIDC) with the target audience
      const client: IdTokenClient = await googleAuth.getIdTokenClient(targetUrl);
      const idToken = await client.idTokenProvider.fetchIdToken(targetUrl);
      
      if (idToken) {
        headers['Authorization'] = `Bearer ${idToken}`;
        console.log(`[${serviceName}] Identity token acquired successfully (length: ${idToken.length})`);
      } else {
        console.warn(`[${serviceName}] ⚠️  No identity token returned`);
      }
    } catch (error) {
      console.error(`[${serviceName}] ❌ Failed to get Google Cloud identity token:`, error);
      // Fall back to manual token if available
      if (GCLOUD_TOKEN) {
        headers['Authorization'] = `Bearer ${GCLOUD_TOKEN}`;
        console.log(`[${serviceName}] Using fallback manual token`);
      } else {
        console.error(`[${serviceName}] ❌ No fallback token available!`);
      }
    }
  } 
  // Option 2: Use manual bearer token from environment
  else if (GCLOUD_TOKEN) {
    headers['Authorization'] = `Bearer ${GCLOUD_TOKEN}`;
    console.log(`[${serviceName}] Using manual bearer token`);
  } else {
    console.warn(`[${serviceName}] ⚠️  No authentication configured!`);
  }
  
  return headers;
}

/**
 * Clear the auth cache for a specific URL or all URLs
 * Useful for testing or forcing token refresh
 */
export function clearAuthCache(targetUrl?: string): void {
  if (targetUrl) {
    googleAuthCache.delete(targetUrl);
  } else {
    googleAuthCache.clear();
  }
}
