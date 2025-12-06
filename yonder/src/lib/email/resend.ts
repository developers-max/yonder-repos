import { Resend } from 'resend';

// Initialize Resend client
const resendApiKey = process.env.RESEND_API_KEY;

if (!resendApiKey) {
  console.warn('[Resend] RESEND_API_KEY not configured');
}

export const resend = resendApiKey ? new Resend(resendApiKey) : null;

/**
 * Check if Resend is configured
 */
export function isResendConfigured(): boolean {
  return !!resend;
}

/**
 * Send an email using Resend
 */
export async function sendEmail({
  to,
  subject,
  html,
  text,
  from = 'Yonder <no-reply@liveyonder.co>',
}: {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  from?: string;
}) {
  if (!resend) {
    console.warn('[Resend] Cannot send email - RESEND_API_KEY not configured');
    return { success: false, error: 'Resend not configured' };
  }

  try {
    const { data, error } = await resend.emails.send({
      from,
      to: Array.isArray(to) ? to : [to],
      subject,
      html: html || '',
    });

    if (error) {
      console.error('[Resend] Error sending email:', error);
      return { success: false, error: error.message };
    }

    console.log(`[Resend] Email sent successfully to ${to}, id: ${data?.id}`);
    return { success: true, id: data?.id };
  } catch (err) {
    console.error('[Resend] Exception sending email:', err);
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

/**
 * Email templates
 */
export const emailTemplates = {
  verification: (url: string) => ({
    subject: 'Verify your Yonder account',
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
        <div style="text-align: center; margin-bottom: 32px;">
          <h1 style="color: #111827; font-size: 24px; margin: 0;">Welcome to Yonder!</h1>
        </div>
        <p style="color: #374151; font-size: 16px; line-height: 24px; margin-bottom: 24px;">
          Please verify your email address to complete your registration and start using Yonder.
        </p>
        <div style="text-align: center; margin: 32px 0;">
          <a href="${url}" style="background-color: #4F46E5; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 500; display: inline-block;">
            Verify Email Address
          </a>
        </div>
        <p style="color: #6B7280; font-size: 14px; line-height: 22px;">
          Or copy and paste this link into your browser:<br/>
          <a href="${url}" style="color: #4F46E5; word-break: break-all;">${url}</a>
        </p>
        <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 32px 0;" />
        <p style="color: #9CA3AF; font-size: 12px; line-height: 18px; text-align: center;">
          If you didn't create an account with Yonder, you can safely ignore this email.
        </p>
      </div>
    `,
  }),
  
  passwordReset: (url: string) => ({
    subject: 'Reset your Yonder password',
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
        <div style="text-align: center; margin-bottom: 32px;">
          <h1 style="color: #111827; font-size: 24px; margin: 0;">Reset Your Password</h1>
        </div>
        <p style="color: #374151; font-size: 16px; line-height: 24px; margin-bottom: 24px;">
          We received a request to reset your password. Click the button below to choose a new password.
        </p>
        <div style="text-align: center; margin: 32px 0;">
          <a href="${url}" style="background-color: #4F46E5; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 500; display: inline-block;">
            Reset Password
          </a>
        </div>
        <p style="color: #6B7280; font-size: 14px; line-height: 22px;">
          Or copy and paste this link into your browser:<br/>
          <a href="${url}" style="color: #4F46E5; word-break: break-all;">${url}</a>
        </p>
        <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 32px 0;" />
        <p style="color: #9CA3AF; font-size: 12px; line-height: 18px; text-align: center;">
          If you didn't request a password reset, you can safely ignore this email.
        </p>
      </div>
    `,
  }),
};
