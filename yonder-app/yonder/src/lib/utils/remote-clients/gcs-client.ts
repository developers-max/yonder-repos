/**
 * Google Cloud Storage Client
 * Provides access to PDF reports stored in GCS bucket using service account credentials
 */

import { Storage } from '@google-cloud/storage';

// GCS configuration from environment variables
const GCP_PROJECT_ID = process.env.GCP_PROJECT_ID || 'yonder-477414';
const GCS_BUCKET_NAME = process.env.GCS_BUCKET_NAME || 'yonder-reports';
const GOOGLE_BUCKET_ACCESS_ACCOUNT = process.env.GOOGLE_BUCKET_ACCESS_ACCOUNT;

let storageClient: Storage | null = null;

/**
 * Initialize and return the GCS storage client
 * Uses service account credentials from GOOGLE_BUCKET_ACCESS_ACCOUNT env var
 */
function getStorageClient(): Storage {
  if (storageClient) {
    return storageClient;
  }

  const storageOptions: ConstructorParameters<typeof Storage>[0] = {
    projectId: GCP_PROJECT_ID,
  };

  // Use service account JSON from environment variable if available
  if (GOOGLE_BUCKET_ACCESS_ACCOUNT) {
    try {
      const credentials = JSON.parse(GOOGLE_BUCKET_ACCESS_ACCOUNT);
      storageOptions.credentials = credentials;
      console.log('[gcs-client] Using service account from GOOGLE_BUCKET_ACCESS_ACCOUNT');
    } catch (error) {
      console.error('[gcs-client] Failed to parse GOOGLE_BUCKET_ACCESS_ACCOUNT:', error);
      throw new Error('Invalid GOOGLE_BUCKET_ACCESS_ACCOUNT JSON');
    }
  } else {
    console.log('[gcs-client] Using Application Default Credentials (ADC)');
  }

  storageClient = new Storage(storageOptions);
  return storageClient;
}

/**
 * Extract the GCS object path from a full GCS URL
 * Supports formats:
 * - gs://bucket-name/path/to/file.pdf
 * - https://storage.googleapis.com/bucket-name/path/to/file.pdf
 * - https://storage.cloud.google.com/bucket-name/path/to/file.pdf
 */
export function extractGcsPath(gcsUrl: string): { bucket: string; path: string } | null {
  try {
    // Trim whitespace from URL
    const trimmedUrl = gcsUrl.trim();
    
    // Handle gs:// protocol
    if (trimmedUrl.startsWith('gs://')) {
      const withoutProtocol = trimmedUrl.substring(5); // Remove 'gs://'
      const firstSlash = withoutProtocol.indexOf('/');
      if (firstSlash === -1) {
        return null;
      }
      const bucket = withoutProtocol.substring(0, firstSlash);
      const path = withoutProtocol.substring(firstSlash + 1);
      return { bucket, path };
    }

    // Handle https:// URLs
    if (trimmedUrl.startsWith('https://storage.googleapis.com/') || 
        trimmedUrl.startsWith('https://storage.cloud.google.com/')) {
      const url = new URL(trimmedUrl);
      // URL.pathname is already decoded by the URL constructor
      const pathParts = url.pathname.substring(1).split('/'); // Remove leading '/'
      if (pathParts.length < 2) {
        console.error('[gcs-client] Invalid GCS URL structure - insufficient path components:', trimmedUrl);
        return null;
      }
      const bucket = pathParts[0];
      const path = pathParts.slice(1).join('/');
      
      // Log successful parsing for debugging
      console.log('[gcs-client] Successfully parsed GCS URL:', { bucket, path });
      return { bucket, path };
    }

    console.error('[gcs-client] Unsupported GCS URL format:', trimmedUrl);
    return null;
  } catch (error) {
    console.error('[gcs-client] Failed to parse GCS URL:', gcsUrl, error);
    return null;
  }
}

/**
 * Check if a file exists in the GCS bucket
 */
export async function fileExists(gcsUrl: string): Promise<boolean> {
  console.log('[gcs-client] Checking if file exists:', gcsUrl);
  const pathInfo = extractGcsPath(gcsUrl);
  if (!pathInfo) {
    console.error('[gcs-client] Invalid GCS URL format - cannot extract path:', gcsUrl);
    return false;
  }

  console.log('[gcs-client] Extracted path info:', pathInfo);

  try {
    const storage = getStorageClient();
    const bucket = storage.bucket(pathInfo.bucket);
    const file = bucket.file(pathInfo.path);
    const [exists] = await file.exists();
    console.log('[gcs-client] File exists check result:', { exists, bucket: pathInfo.bucket, path: pathInfo.path });
    return exists;
  } catch (error) {
    console.error('[gcs-client] Error checking file existence:', error);
    return false;
  }
}

/**
 * Get a readable stream for a file from GCS
 * Returns a stream that can be piped to an HTTP response
 */
export async function getFileStream(gcsUrl: string): Promise<NodeJS.ReadableStream> {
  const pathInfo = extractGcsPath(gcsUrl);
  if (!pathInfo) {
    throw new Error(`Invalid GCS URL format: ${gcsUrl}`);
  }

  try {
    const storage = getStorageClient();
    const bucket = storage.bucket(pathInfo.bucket);
    const file = bucket.file(pathInfo.path);

    // Check if file exists before creating stream
    const [exists] = await file.exists();
    if (!exists) {
      throw new Error(`File not found in GCS: ${gcsUrl}`);
    }

    // Return a readable stream
    return file.createReadStream();
  } catch (error) {
    console.error('[gcs-client] Error creating file stream:', error);
    throw error;
  }
}

/**
 * Get file metadata from GCS
 */
export async function getFileMetadata(gcsUrl: string): Promise<{
  size: number;
  contentType: string;
  updated: Date;
} | null> {
  const pathInfo = extractGcsPath(gcsUrl);
  if (!pathInfo) {
    console.error('[gcs-client] Invalid GCS URL format:', gcsUrl);
    return null;
  }

  try {
    const storage = getStorageClient();
    const bucket = storage.bucket(pathInfo.bucket);
    const file = bucket.file(pathInfo.path);
    
    const [metadata] = await file.getMetadata();
    
    return {
      size: typeof metadata.size === 'number' ? metadata.size : parseInt(metadata.size || '0', 10),
      contentType: metadata.contentType || 'application/octet-stream',
      updated: new Date(metadata.updated || Date.now()),
    };
  } catch (error) {
    console.error('[gcs-client] Error getting file metadata:', error);
    return null;
  }
}

/**
 * Get the configured bucket name
 */
export function getBucketName(): string {
  return GCS_BUCKET_NAME;
}

/**
 * Generate a signed URL for temporary access to a GCS file
 * @param gcsUrl - Full GCS URL (gs://bucket/path or https://storage.googleapis.com/bucket/path)
 * @param expiresInMinutes - How long the URL should be valid (default: 15 minutes)
 * @returns Signed URL string that allows temporary access without authentication
 */
export async function getSignedUrl(
  gcsUrl: string,
  expiresInMinutes: number = 15
): Promise<string | null> {
  console.log('[gcs-client] Generating signed URL for:', gcsUrl);
  
  const pathInfo = extractGcsPath(gcsUrl);
  if (!pathInfo) {
    console.error('[gcs-client] Invalid GCS URL format:', gcsUrl);
    return null;
  }

  console.log('[gcs-client] Extracted path info:', pathInfo);

  try {
    const storage = getStorageClient();
    const bucket = storage.bucket(pathInfo.bucket);
    const file = bucket.file(pathInfo.path);

    console.log('[gcs-client] Requesting signed URL with', expiresInMinutes, 'minutes expiry');

    // Generate a v4 signed URL for downloading
    const [signedUrl] = await file.getSignedUrl({
      version: 'v4',
      action: 'read',
      expires: Date.now() + expiresInMinutes * 60 * 1000, // Convert minutes to milliseconds
    });

    console.log('[gcs-client] Successfully generated signed URL (length:', signedUrl.length, ')');
    return signedUrl;
  } catch (error) {
    console.error('[gcs-client] Error generating signed URL:', error);
    return null;
  }
}
