'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/app/_components/ui/dialog';
import { LoginForm } from '@/app/_components/login-form';
import { SignupForm } from '@/app/_components/signup-form';
import { useRouter } from 'next/navigation';

interface AuthDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plotId: string;
}

type AuthMode = 'login' | 'signup';

export default function AuthDialog({ open, onOpenChange, plotId }: AuthDialogProps) {
  const [mode, setMode] = useState<AuthMode>('login');
  const router = useRouter();

  const handleSuccess = () => {
    // Successfully authenticated, redirect to chat with plotId
    router.push(`/chat?plotId=${plotId}`);
    onOpenChange(false);
  };

  const switchMode = (newMode: AuthMode) => {
    setMode(newMode);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogTitle className="sr-only">
          {mode === 'login' ? 'Sign in to your account' : 'Create your account'}
        </DialogTitle>
        
        {mode === 'login' ? (
          <div className="space-y-6">
            <LoginForm 
              onSuccess={handleSuccess}
              showSignupLink={false}
            />
            <div className="text-center text-sm">
              Don&apos;t have an account?{" "}
              <button
                type="button"
                onClick={() => switchMode('signup')}
                className="underline underline-offset-4 text-primary hover:text-primary/80"
              >
                Sign up
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <SignupForm 
              onSuccess={handleSuccess}
              showLoginLink={false}
            />
            <div className="text-center text-sm">
              Already have an account?{" "}
              <button
                type="button"
                onClick={() => switchMode('login')}
                className="underline underline-offset-4 text-primary hover:text-primary/80"
              >
                Sign in
              </button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
} 