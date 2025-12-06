/**
 * Email module using Resend
 * 
 * Setup:
 * 1. Set RESEND_API_KEY in your environment variables
 * 2. Configure your sending domain in Resend dashboard
 * 
 * Usage:
 * ```typescript
 * import { sendEmail, emailTemplates } from '@/lib/email';
 * 
 * // Send a custom email
 * await sendEmail({
 *   to: 'user@example.com',
 *   subject: 'Hello',
 *   html: '<p>Hello World</p>',
 * });
 * 
 * // Send verification email
 * const template = emailTemplates.verification('https://example.com/verify?token=abc');
 * await sendEmail({
 *   to: 'user@example.com',
 *   ...template,
 * });
 * ```
 */

export { resend, sendEmail, emailTemplates, isResendConfigured } from './resend';
