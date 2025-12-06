/**
 * Cloudflare Turnstile integration module
 * 
 * This module provides both client-side widget and server-side verification
 * for Cloudflare Turnstile bot protection.
 * 
 * ## Environment Variables Required
 * 
 * - `NEXT_PUBLIC_TURNSTILE_SITE_KEY` - Public site key (client-side)
 * - `TURNSTILE_SECRET_KEY` - Secret key (server-side only)
 * 
 * ## Usage
 * 
 * ### Client-side (React component)
 * ```tsx
 * import { TurnstileWidget, type TurnstileWidgetRef } from '@/lib/turnstile';
 * 
 * const [token, setToken] = useState<string | null>(null);
 * const turnstileRef = useRef<TurnstileWidgetRef>(null);
 * 
 * <TurnstileWidget
 *   ref={turnstileRef}
 *   onVerify={setToken}
 *   onExpire={() => setToken(null)}
 * />
 * 
 * // On form submit, include token in request
 * // After submit, reset: turnstileRef.current?.reset();
 * ```
 * 
 * ### Server-side verification
 * ```ts
 * import { verifyTurnstileToken } from '@/lib/turnstile';
 * 
 * const result = await verifyTurnstileToken({ token });
 * if (!result.success) {
 *   throw new Error('Bot verification failed');
 * }
 * ```
 */

// Client-side exports
export { default as TurnstileWidget } from './turnstile-widget';
export type { TurnstileWidgetProps, TurnstileWidgetRef } from './turnstile-widget';

// Server-side exports
export { verifyTurnstileToken, isTurnstileConfigured } from './verify-turnstile';
export type { TurnstileVerifyResponse, TurnstileVerifyOptions } from './verify-turnstile';
