import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { App } from '../App.tsx';
import { createAuthenticatedPreviewIdentity } from '../domain/preview-identity.ts';
import type { PreviewIdentityState } from '../domain/preview-identity.ts';

const classicUrl = 'https://steveotto.github.io/tend/';
const authStorageKey = 'tend2:preview:auth-session';

export type PreviewSession = { user: { id: string } };
type AuthResult = { error: { message: string } | null };
export type PreviewAuthClient = {
  auth: {
    onAuthStateChange(
      callback: (event: string, session: PreviewSession | null) => void
    ): { data: { subscription: { unsubscribe: () => void } } };
    signInWithPassword(credentials: { email: string; password: string }): Promise<AuthResult & {
      data?: { session: PreviewSession | null };
    }>;
    resetPasswordForEmail(email: string, options: { redirectTo: string }): Promise<AuthResult>;
    updateUser(attributes: { password: string }): Promise<AuthResult>;
    signOut(options: { scope: 'local' }): Promise<AuthResult>;
  };
};

export type PreviewSupabaseClientFactory = (
  url: string,
  publishableKey: string,
  options: {
    auth: {
      autoRefreshToken: true;
      detectSessionInUrl: true;
      flowType: 'pkce';
      persistSession: true;
      storage: Storage;
      storageKey: typeof authStorageKey;
    };
  }
) => PreviewAuthClient;

declare global {
  interface Window {
    supabase?: { createClient: PreviewSupabaseClientFactory };
  }
}

type PreviewIdentityHostProps = {
  accessReady?: boolean;
  supabaseUrl?: string;
  supabasePublishableKey?: string;
  clientFactory?: PreviewSupabaseClientFactory;
};

export function PreviewIdentityHost({
  accessReady = import.meta.env.VITE_PREVIEW_ACCESS_READY === 'true',
  supabaseUrl = import.meta.env.VITE_TEND_SUPABASE_URL ?? '',
  supabasePublishableKey = import.meta.env.VITE_TEND_SUPABASE_PUBLISHABLE_KEY ?? '',
  clientFactory
}: PreviewIdentityHostProps = {}) {
  const [identity, setIdentity] = useState<PreviewIdentityState>({ kind: 'pending' });
  const [client, setClient] = useState<PreviewAuthClient | null>(null);
  const [authMessage, setAuthMessage] = useState('');
  const [authScreen, setAuthScreen] = useState<PreviewAuthScreen>('sign-in');
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isRequestingReset, setIsRequestingReset] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const activeUserId = useRef<string | null>(null);
  const recoveryUserId = useRef<string | null>(null);
  const sessionGeneration = useRef(0);
  const suppressSessionCallbacks = useRef(false);

  const authUrl = validatedSupabaseUrl(supabaseUrl);
  const hasPublicConfig = authUrl !== null && supabasePublishableKey.trim().length > 0;

  useEffect(() => {
    if (!accessReady || !hasPublicConfig || !authUrl) return;
    const factory = clientFactory ?? window.supabase?.createClient;
    if (!factory) {
      setIdentity({
        kind: 'error',
        message: 'The Tend sign-in service could not be loaded. Try again later.'
      });
      return;
    }

    let active = true;
    if (hasRecoveryLinkError(window.location)) {
      setAuthScreen('recovery-error');
      clearRecoveryFragment();
    }

    let authClient: PreviewAuthClient;
    try {
      authClient = factory(authUrl, supabasePublishableKey.trim(), {
        auth: {
          autoRefreshToken: true,
          detectSessionInUrl: true,
          flowType: 'pkce',
          persistSession: true,
          storage: window.localStorage,
          storageKey: authStorageKey
        }
      });
      setClient(authClient);
      const { data: { subscription } } = authClient.auth.onAuthStateChange((event, session) => {
        if (!active) return;
        if (session && suppressSessionCallbacks.current) return;
        const userId = session?.user?.id ?? null;
        if (userId !== activeUserId.current) {
          sessionGeneration.current += 1;
          activeUserId.current = userId;
          recoveryUserId.current = null;
        }
        if (event === 'PASSWORD_RECOVERY' && session) {
          recoveryUserId.current = userId;
          setIdentity({ kind: 'pending' });
          setAuthMessage('');
          setAuthScreen('recovery');
          clearRecoveryFragment();
          return;
        }
        if (!session) {
          recoveryUserId.current = null;
          setIdentity({ kind: 'signed-out' });
          return;
        }
        setIdentity(createAuthenticatedPreviewIdentity(userId ?? '', sessionGeneration.current));
      });
      return () => {
        active = false;
        subscription.unsubscribe();
      };
    } catch {
      setIdentity({
        kind: 'error',
        message: 'Tend sign-in could not be initialized. Check the public Preview configuration.'
      });
    }
  }, [accessReady, authUrl, clientFactory, hasPublicConfig, supabasePublishableKey]);

  async function signIn(email: string, password: string) {
    if (!client || isSigningOut) return;
    suppressSessionCallbacks.current = true;
    setIsSigningIn(true);
    setAuthMessage('');
    try {
      const result = await client.auth.signInWithPassword({ email, password });
      if (result.error) {
        suppressSessionCallbacks.current = false;
        setAuthMessage('Sign-in was not successful. Check the email and password, then try again.');
      } else if (result.data?.session) {
        suppressSessionCallbacks.current = false;
        const userId = result.data.session.user.id;
        if (userId !== activeUserId.current) {
          sessionGeneration.current += 1;
          activeUserId.current = userId;
        }
        setIdentity(createAuthenticatedPreviewIdentity(userId, sessionGeneration.current));
      } else {
        suppressSessionCallbacks.current = false;
      }
    } catch {
      suppressSessionCallbacks.current = false;
      setAuthMessage('Tend sign-in could not be reached. Check your connection and try again.');
    } finally {
      setIsSigningIn(false);
    }
  }

  async function requestPasswordReset(email: string) {
    if (!client || isSigningIn || isSigningOut) return;
    setIsRequestingReset(true);
    setAuthMessage('');
    try {
      const result = await client.auth.resetPasswordForEmail(email, {
        redirectTo: new URL('/', window.location.origin).toString()
      });
      if (result.error) {
        setAuthMessage('We could not send a reset email right now. Try again shortly.');
        return;
      }
      setAuthMessage('If that email belongs to a Tend account, a password-reset link has been sent.');
    } catch {
      setAuthMessage('We could not send a reset email right now. Check your connection and try again.');
    } finally {
      setIsRequestingReset(false);
    }
  }

  async function updatePassword(password: string, confirmation: string) {
    if (!client || isSavingPassword || isSigningOut) return;
    if (password.length < 8) {
      setAuthMessage('Use a password with at least 8 characters.');
      return;
    }
    if (password !== confirmation) {
      setAuthMessage('The passwords do not match. Check both fields and try again.');
      return;
    }
    if (!activeUserId.current || recoveryUserId.current !== activeUserId.current) {
      setAuthMessage('This reset link is no longer active. Request a new password-reset link.');
      setAuthScreen('recovery-error');
      return;
    }

    setIsSavingPassword(true);
    setAuthMessage('');
    try {
      const result = await client.auth.updateUser({ password });
      if (result.error) {
        setAuthMessage('We could not update your password. The reset link may have expired; request a new one and try again.');
        return;
      }
      recoveryUserId.current = null;
      setIdentity(createAuthenticatedPreviewIdentity(activeUserId.current, sessionGeneration.current));
      setAuthScreen('password-updated');
    } catch {
      setAuthMessage('We could not update your password. Check your connection and try again.');
    } finally {
      setIsSavingPassword(false);
    }
  }

  async function signOut() {
    const currentClient = client;
    suppressSessionCallbacks.current = true;
    sessionGeneration.current += 1;
    activeUserId.current = null;
    recoveryUserId.current = null;
    setIdentity({ kind: 'signed-out' });
    setAuthMessage('');
    if (!currentClient) return;
    setIsSigningOut(true);
    try {
      const result = await currentClient.auth.signOut({ scope: 'local' });
      if (result.error) {
        setIdentity({
          kind: 'error',
          message: 'The local Tend session could not be ended. Reload this page before continuing.'
        });
      }
    } catch {
      setIdentity({
        kind: 'error',
        message: 'The local Tend session could not be ended. Reload this page before continuing.'
      });
    } finally {
      setIsSigningOut(false);
    }
  }

  if (!accessReady) {
    return (
      <PreviewAccessNotice
        title="Preview setup is incomplete"
        message="Preview sign-in is disabled until the owner-only access policy is configured."
      />
    );
  }
  if (!authUrl || !supabasePublishableKey.trim()) {
    return (
      <PreviewAccessNotice
        title="Preview sign-in is not configured"
        message="The required public Tend authentication settings are missing or invalid."
      />
    );
  }
  if (authScreen === 'recovery') {
    return (
      <PreviewAuthLayout
        title="Choose a new password"
        description="Create a new password for your Tend account."
      >
        <form
          className="preview-login__form"
          onSubmit={event => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            void updatePassword(
              String(form.get('password') ?? ''),
              String(form.get('confirmPassword') ?? '')
            );
          }}
        >
          <label>
            New password
            <input name="password" type="password" autoComplete="new-password" minLength={8} required />
          </label>
          <label>
            Confirm password
            <input name="confirmPassword" type="password" autoComplete="new-password" minLength={8} required />
          </label>
          <button type="submit" disabled={!client || isSavingPassword || isSigningOut}>
            {isSavingPassword ? 'Saving password…' : 'Save new password'}
          </button>
        </form>
        {authMessage && <p className="preview-login__error" role="alert">{authMessage}</p>}
      </PreviewAuthLayout>
    );
  }
  if (authScreen === 'recovery-error') {
    return (
      <PreviewAuthLayout
        title="This reset link can’t be used"
        description="It may have expired or already been used. Return to sign in and request a new password-reset link."
      >
        <button className="preview-login__text-button" type="button" onClick={() => {
          setAuthMessage('');
          setAuthScreen('sign-in');
        }}>
          Back to sign in
        </button>
      </PreviewAuthLayout>
    );
  }
  if (authScreen === 'password-updated') {
    return (
      <PreviewAuthLayout
        title="Your password is updated"
        description="Your new password is ready. Continue to your separate Preview workspace."
      >
        <button className="preview-login__primary-action" type="button" onClick={() => setAuthScreen('sign-in')}>
          Continue to Preview
        </button>
      </PreviewAuthLayout>
    );
  }
  if (identity.kind === 'pending') {
    return <PreviewAccessNotice title="Checking Tend sign-in" message="No Preview account data has been opened." />;
  }
  if (identity.kind === 'authenticated') {
    return <App identity={identity} onSignOut={signOut} />;
  }
  if (identity.kind === 'error') {
    return <PreviewAccessNotice title="Preview sign-in is unavailable" message={identity.message} />;
  }

  if (authScreen === 'request-reset') {
    return (
      <PreviewAuthLayout
        title="Reset your password"
        description="We’ll email a secure reset link if there is an account for that address."
      >
        <form
          className="preview-login__form"
          onSubmit={event => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            void requestPasswordReset(String(form.get('email') ?? '').trim());
          }}
        >
          <label>
            Email address
            <input name="email" type="email" autoComplete="email" required />
          </label>
          <button type="submit" disabled={!client || isRequestingReset || isSigningOut}>
            {isRequestingReset ? 'Sending link…' : 'Send reset link'}
          </button>
        </form>
        {authMessage && <p className="preview-login__status" role="status">{authMessage}</p>}
        <button className="preview-login__text-button" type="button" onClick={() => {
          setAuthMessage('');
          setAuthScreen('sign-in');
        }}>
          Back to sign in
        </button>
      </PreviewAuthLayout>
    );
  }

  return (
    <PreviewAuthLayout
      title="Sign in with Tend"
      description="Use your existing Tend email and password. Preview keeps a separate local copy on this device."
    >
        <form
          className="preview-login__form"
          onSubmit={event => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            void signIn(String(form.get('email') ?? '').trim(), String(form.get('password') ?? ''));
          }}
        >
          <label>
            Email address
            <input name="email" type="email" autoComplete="email" required />
          </label>
          <label>
            Password
            <input name="password" type="password" autoComplete="current-password" required />
          </label>
          <button type="submit" disabled={!client || isSigningIn || isSigningOut}>
            {isSigningIn ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        {authMessage && <p className="preview-login__error" role="alert">{authMessage}</p>}
        <button className="preview-login__text-button" type="button" onClick={() => {
          setAuthMessage('');
          setAuthScreen('request-reset');
        }}>
          Forgot password?
        </button>
    </PreviewAuthLayout>
  );
}

type PreviewAuthScreen = 'sign-in' | 'request-reset' | 'recovery' | 'recovery-error' | 'password-updated';

function PreviewAuthLayout({
  title,
  description,
  children
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <main className="preview-login" aria-labelledby="preview-login-title">
      <section className="preview-login__card">
        <p className="preview-login__eyebrow">Tend Preview</p>
        <h1 id="preview-login-title">{title}</h1>
        <p>{description}</p>
        {children}
        <p className="preview-login__classic">
          Need account help? <a href={classicUrl}>Open Tend Classic</a>
        </p>
      </section>
    </main>
  );
}

function PreviewAccessNotice({ title, message }: { title: string; message: string }) {
  return (
    <main className="preview-access-state" aria-labelledby="preview-access-title">
      <h1 id="preview-access-title">{title}</h1>
      <p>{message}</p>
      <p><a href={classicUrl}>Open Tend Classic</a></p>
    </main>
  );
}

function hasRecoveryLinkError(location: Location): boolean {
  const search = new URLSearchParams(location.search);
  const hash = new URLSearchParams(location.hash.replace(/^#/, ''));
  const error = search.get('error') ?? hash.get('error');
  const errorCode = search.get('error_code') ?? hash.get('error_code');
  const type = search.get('type') ?? hash.get('type');
  return Boolean(error || errorCode) && (type === 'recovery' || errorCode === 'otp_expired' || errorCode === 'access_denied');
}

function clearRecoveryFragment() {
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  if (hash.has('type') || hash.has('error') || hash.has('error_code')) {
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
  }
}

function validatedSupabaseUrl(value: string): string | null {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname.endsWith('.supabase.co')
      ? url.toString().replace(/\/$/, '')
      : null;
  } catch {
    return null;
  }
}
