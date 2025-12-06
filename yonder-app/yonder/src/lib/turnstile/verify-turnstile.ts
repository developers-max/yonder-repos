/**
 * Server-side Turnstile token verification
 * 
 * This utility validates Turnstile tokens against Cloudflare's siteverify API.
 * Use this on the server side to ensure the client-side verification is genuine.
 */

const TURNSTILE_VERIFY_ENDPOINT = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

export interface TurnstileVerifyResponse {
  /** Whether the verification was successful */
  success: boolean;
  /** ISO timestamp of the challenge */
  challenge_ts?: string;
  /** Hostname of the site where the challenge was solved */
  hostname?: string;
  /** Error codes if verification failed */
  'error-codes'?: string[];
  /** Action that was specified in the widget */
  action?: string;
  /** Custom data that was passed to the widget */
  cdata?: string;
}

export interface TurnstileVerifyOptions {
  /** The token received from the client */
  token: string;
  /** Optional: The user's IP address for additional validation */
  remoteIp?: string;
  /** Optional: Idempotency key to prevent token reuse */
  idempotencyKey?: string;
}

/**
 * Verifies a Turnstile token server-side.
 * 
 * @param options - Verification options including the token
 * @returns The verification response from Cloudflare
 * @throws Error if TURNSTILE_SECRET_KEY is not configured
 * 
 * @example
 * ```ts
 * const result = await verifyTurnstileToken({ token: clientToken });
 * if (!result.success) {
 *   throw new Error('Bot verification failed');
 * }
 * ```
 */
export async function verifyTurnstileToken(
  options: TurnstileVerifyOptions
): Promise<TurnstileVerifyResponse> {
  const secretKey = process.env.TURNSTILE_SECRET_KEY;
  
  if (!secretKey) {
    // In development without keys, skip verification
    if (process.env.NODE_ENV === 'development') {
      console.warn('Turnstile: TURNSTILE_SECRET_KEY not set, skipping verification in development');
      return { success: true };
    }
    throw new Error('TURNSTILE_SECRET_KEY environment variable is not set');
  }

  const { token, remoteIp, idempotencyKey } = options;

  if (!token) {
    return {
      success: false,
      'error-codes': ['missing-input-response'],
    };
  }

  // Build form data for the request
  const formData = new URLSearchParams();
  formData.append('secret', secretKey);
  formData.append('response', token);
  
  if (remoteIp) {
    formData.append('remoteip', remoteIp);
  }
  
  if (idempotencyKey) {
    formData.append('idempotency_key', idempotencyKey);
  }

  try {
    const response = await fetch(TURNSTILE_VERIFY_ENDPOINT, {
      method: 'POST',
      body: formData.toString(),
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    // Cloudflare always returns JSON, even on 4xx errors
    const data = await response.json() as TurnstileVerifyResponse;
    
    if (!response.ok) {
      console.error('Turnstile verification request failed:', response.status, data);
    }
    
    if (!data.success) {
      console.warn('Turnstile verification failed:', data['error-codes'], data);
    }

    return data;
  } catch (error) {
    console.error('Turnstile verification error:', error);
    return {
      success: false,
      'error-codes': ['internal-error'],
    };
  }
}

/**
 * Helper to check if Turnstile is configured (has secret key).
 * Useful for conditional verification in development.
 */
export function isTurnstileConfigured(): boolean {
  return !!process.env.TURNSTILE_SECRET_KEY;
}
