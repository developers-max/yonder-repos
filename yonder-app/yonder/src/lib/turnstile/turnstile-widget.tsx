'use client';

import { Turnstile, type TurnstileInstance } from '@marsidev/react-turnstile';
import { useRef, useCallback, forwardRef, useImperativeHandle } from 'react';

export interface TurnstileWidgetProps {
  /** Callback when verification succeeds */
  onVerify: (token: string) => void;
  /** Callback when verification expires */
  onExpire?: () => void;
  /** Callback when verification fails */
  onError?: (error: string) => void;
  /** Theme for the widget */
  theme?: 'light' | 'dark' | 'auto';
  /** Size of the widget */
  size?: 'normal' | 'compact';
  /** Action name for analytics */
  action?: string;
  /** Additional CSS class */
  className?: string;
}

export interface TurnstileWidgetRef {
  /** Reset the widget to allow re-verification */
  reset: () => void;
}

/**
 * Cloudflare Turnstile widget component for bot protection.
 * Renders an invisible or visible challenge that verifies the user is human.
 * 
 * @example
 * ```tsx
 * const [token, setToken] = useState<string | null>(null);
 * const turnstileRef = useRef<TurnstileWidgetRef>(null);
 * 
 * <TurnstileWidget
 *   ref={turnstileRef}
 *   onVerify={(token) => setToken(token)}
 *   onExpire={() => setToken(null)}
 *   theme="light"
 *   size="normal"
 * />
 * ```
 */
const TurnstileWidget = forwardRef<TurnstileWidgetRef, TurnstileWidgetProps>(
  function TurnstileWidget(
    {
      onVerify,
      onExpire,
      onError,
      theme = 'auto',
      size = 'normal',
      action,
      className,
    },
    ref
  ) {
    const turnstileRef = useRef<TurnstileInstance>(null);
    const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

    const handleReset = useCallback(() => {
      turnstileRef.current?.reset();
    }, []);

    // Expose reset method to parent
    useImperativeHandle(ref, () => ({
      reset: handleReset,
    }));

    if (!siteKey) {
      // In development without keys, render nothing and auto-verify
      console.warn('Turnstile: NEXT_PUBLIC_TURNSTILE_SITE_KEY not set');
      return null;
    }

    return (
      <div className={className}>
        <Turnstile
          ref={turnstileRef}
          siteKey={siteKey}
          onSuccess={onVerify}
          onExpire={() => {
            onExpire?.();
          }}
          onError={(error) => {
            console.error('Turnstile error:', error);
            onError?.(String(error));
          }}
          options={{
            theme,
            size,
            action,
          }}
        />
      </div>
    );
  }
);

export default TurnstileWidget;
