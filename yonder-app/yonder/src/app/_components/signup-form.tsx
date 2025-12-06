"use client";

import { cn } from "@/lib/utils/utils";
import { Button } from "@/app/_components/ui/button";
import { Input } from "@/app/_components/ui/input";
import { Label } from "@/app/_components/ui/label";
import Link from "next/link";
import { useState, useRef } from "react";
import { signUp, authClient } from "@/lib/auth/auth-client";
import { useRouter } from "next/navigation";
import { AlertCircle, Mail } from "lucide-react";
import { TurnstileWidget, type TurnstileWidgetRef } from "@/lib/turnstile";

interface SignupFormProps extends React.ComponentProps<"form"> {
  onSuccess?: () => void;
  showLoginLink?: boolean;
}

export function SignupForm({
  className,
  onSuccess,
  showLoginLink = true,
  ...props
}: SignupFormProps) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [showVerificationMessage, setShowVerificationMessage] = useState(false);
  const turnstileRef = useRef<TurnstileWidgetRef>(null);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      // Verify Turnstile token server-side (if configured)
      if (turnstileToken) {
        const verifyResponse = await fetch('/api/turnstile/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: turnstileToken }),
        });
        
        const verifyResult = await verifyResponse.json();
        if (!verifyResult.success) {
          setError("Security verification failed. Please try again.");
          turnstileRef.current?.reset();
          setTurnstileToken(null);
          setIsLoading(false);
          return;
        }
      }

      const result = await signUp.email({
        email,
        password,
        name: `${firstName} ${lastName}`,
        first_name: firstName,
        last_name: lastName,
      } as Parameters<typeof signUp.email>[0] & { first_name: string; last_name: string });

      if (result.error) {
        setError(result.error.message || "Signup failed");
        // Reset turnstile for retry
        turnstileRef.current?.reset();
        setTurnstileToken(null);
      } else {
        // Show verification message instead of redirecting
        setShowVerificationMessage(true);
        if (onSuccess) {
          onSuccess();
        }
      }
    } catch (err) {
      setError("An unexpected error occurred: " + err);
      turnstileRef.current?.reset();
      setTurnstileToken(null);
    } finally {
      setIsLoading(false);
    }
  };

  // Show verification message after successful signup
  if (showVerificationMessage) {
    return (
      <div className={cn("flex flex-col gap-6 text-center", className)}>
        <div className="flex justify-center">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
            <Mail className="w-8 h-8 text-green-600" />
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold">Check your email</h1>
          <p className="text-muted-foreground text-sm">
            We&apos;ve sent a verification link to <strong>{email}</strong>.
            Please check your inbox and click the link to verify your account.
          </p>
        </div>
        <p className="text-xs text-muted-foreground">
          Didn&apos;t receive the email? Check your spam folder or{" "}
          <button
            type="button"
            onClick={() => setShowVerificationMessage(false)}
            className="underline underline-offset-4 hover:text-primary"
          >
            try again
          </button>
        </p>
        <div className="text-center text-sm">
          <Link href="/login" className="underline underline-offset-4">
            Back to login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form
      className={cn("flex flex-col gap-6", className)}
      onSubmit={handleSubmit}
      {...props}
    >
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold">Create your account</h1>
        <p className="text-muted-foreground text-sm text-balance">
          Enter your details below to sign up.
        </p>
      </div>
      <div className="grid gap-6">
        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-3">
            <Label htmlFor="first_name">First Name</Label>
            <Input
              id="first_name"
              type="text"
              placeholder="John"
              required
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              disabled={isLoading}
              autoComplete="given-name"
              autoCapitalize="words"
            />
          </div>
          <div className="grid gap-3">
            <Label htmlFor="last_name">Last Name</Label>
            <Input
              id="last_name"
              type="text"
              placeholder="Doe"
              required
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              disabled={isLoading}
              autoComplete="family-name"
              autoCapitalize="words"
            />
          </div>
        </div>
        <div className="grid gap-3">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="m@example.com"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={isLoading}
            autoComplete="email"
            autoCapitalize="none"
            autoCorrect="off"
            inputMode="email"
          />
        </div>
        <div className="grid gap-3">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={isLoading}
            minLength={6}
            autoComplete="new-password"
          />
        </div>
        {error && (
          <div className="text-red-500 text-sm px-3 py-2 rounded-md bg-red-50 flex items-center gap-1.5">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        )}
        {/* Cloudflare Turnstile widget */}
        <div className="flex justify-center">
          <TurnstileWidget
            ref={turnstileRef}
            onVerify={(token) => setTurnstileToken(token)}
            onExpire={() => setTurnstileToken(null)}
            onError={() => setTurnstileToken(null)}
            theme="light"
            size="normal"
            action="signup"
          />
        </div>
        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? "Creating account..." : "Sign Up"}
        </Button>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">Or continue with</span>
          </div>
        </div>

        <Button
          type="button"
          variant="outline"
          className="w-full"
          disabled={isLoading}
          onClick={() => {
            authClient.signIn.social({
              provider: 'google',
              callbackURL: '/chat',
            });
          }}
        >
          <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#34A853"
            />
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              fill="#EA4335"
            />
          </svg>
          Continue with Google
        </Button>

        {showLoginLink && (
          <div className="text-center text-sm">
            Already have an account?{" "}
            <Link href="/login" className="underline underline-offset-4">
              Sign in
            </Link>
          </div>
        )}
      </div>
    </form>
  );
}
