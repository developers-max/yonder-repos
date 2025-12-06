/**
 * Data Access Layer (DAL)
 * 
 * Centralized authentication and authorization logic.
 * Recommended by Next.js 16 to replace middleware/proxy.
 * 
 * @see https://nextjs.org/docs/app/guides/authentication
 */

import { auth } from '@/lib/auth/auth';
import { cache } from 'react';
import 'server-only';

/**
 * Get the current authenticated session
 * Uses React's cache to dedupe requests within a single render
 */
export const getSession = cache(async () => {
  const session = await auth.api.getSession({
    headers: await import('next/headers').then(m => m.headers()),
  });
  
  return session;
});

/**
 * Verify user is authenticated, throw if not
 * Use this in Server Components, Server Actions, and Route Handlers
 */
export async function verifySession() {
  const session = await getSession();
  
  if (!session?.user) {
    throw new Error('Unauthorized - Authentication required');
  }
  
  return {
    session,
    userId: session.user.id,
    user: session.user,
  };
}

/**
 * Get the current user or return null if not authenticated
 * Use this when auth is optional
 */
export async function getCurrentUser() {
  const session = await getSession();
  return session?.user ?? null;
}

/**
 * Verify user has specific permissions
 * Extend this based on your authorization needs
 */
export async function verifyPermission(permission: string) {
  const { user } = await verifySession();
  
  // Add your permission checking logic here
  // Example: check user role, organization membership, etc.
  
  return { user };
}
