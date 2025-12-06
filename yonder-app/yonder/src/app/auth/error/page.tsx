'use client';

import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/app/_components/ui/button';
import { Suspense } from 'react';

const errorMessages: Record<string, string> = {
  unable_to_create_user: 'We couldn\'t create your account. Please try again or contact support.',
  invalid_credentials: 'Invalid email or password. Please check your credentials.',
  email_not_verified: 'Please verify your email address before signing in.',
  account_not_found: 'No account found with this email address.',
  oauth_error: 'There was an issue connecting with your social account.',
  session_expired: 'Your session has expired. Please sign in again.',
  default: 'Something went wrong. Please try again.',
};

function ErrorContent() {
  const searchParams = useSearchParams();
  const errorCode = searchParams.get('error') || 'default';
  const errorMessage = errorMessages[errorCode] || errorMessages.default;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center">
        <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-red-100 flex items-center justify-center">
          <AlertTriangle className="w-8 h-8 text-red-600" />
        </div>
        
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Authentication Error
        </h1>
        
        <p className="text-gray-600 mb-6">
          {errorMessage}
        </p>

        <div className="space-y-3">
          <Button asChild className="w-full">
            <Link href="/login">
              Try Again
            </Link>
          </Button>
          
          <Button asChild variant="outline" className="w-full">
            <Link href="/">
              Go to Homepage
            </Link>
          </Button>
        </div>

        {errorCode !== 'default' && (
          <p className="mt-6 text-xs text-gray-400">
            Error code: {errorCode}
          </p>
        )}
      </div>
    </div>
  );
}

export default function AuthErrorPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-pulse">Loading...</div>
      </div>
    }>
      <ErrorContent />
    </Suspense>
  );
}
