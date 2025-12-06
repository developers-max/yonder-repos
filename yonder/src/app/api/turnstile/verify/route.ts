import { NextRequest, NextResponse } from 'next/server';
import { verifyTurnstileToken } from '@/lib/turnstile';

/**
 * API endpoint to verify Turnstile tokens server-side.
 * Call this before proceeding with sensitive operations like login/signup.
 * 
 * POST /api/turnstile/verify
 * Body: { token: string }
 * 
 * Returns: { success: boolean, error?: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token } = body as { token?: string };

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Missing turnstile token' },
        { status: 400 }
      );
    }

    // Get client IP for additional validation
    const remoteIp = request.headers.get('x-forwarded-for')?.split(',')[0] || 
                     request.headers.get('x-real-ip') ||
                     undefined;

    const result = await verifyTurnstileToken({
      token,
      remoteIp,
    });

    if (!result.success) {
      const errorMessage = result['error-codes']?.join(', ') || 'Verification failed';
      return NextResponse.json(
        { success: false, error: errorMessage },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Turnstile verify error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
