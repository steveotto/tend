import { useEffect, useRef, useState } from 'react';
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
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const activeUserId = useRef<string | null>(null);
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
    let authClient: PreviewAuthClient;
    try {
      authClient = factory(authUrl, supabasePublishableKey.trim(), {
        auth: {
          autoRefreshToken: true,
          detectSessionInUrl: true,
          persistSession: true,
          storage: window.localStorage,
          storageKey: authStorageKey
        }
      });
      setClient(authClient);
      const { data: { subscription } } = authClient.auth.onAuthStateChange((_event, session) => {
        if (!active) return;
        if (session && suppressSessionCallbacks.current) return;
        const userId = session?.user?.id ?? null;
        if (userId !== activeUserId.current) {
          sessionGeneration.current += 1;
          activeUserId.current = userId;
        }
        if (!session) {
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

  async function signOut() {
    const currentClient = client;
    suppressSessionCallbacks.current = true;
    sessionGeneration.current += 1;
    activeUserId.current = null;
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
  if (identity.kind === 'pending') {
    return <PreviewAccessNotice title="Checking Tend sign-in" message="No Preview account data has been opened." />;
  }
  if (identity.kind === 'authenticated') {
    return <App identity={identity} onSignOut={signOut} />;
  }
  if (identity.kind === 'error') {
    return <PreviewAccessNotice title="Preview sign-in is unavailable" message={identity.message} />;
  }

  return (
    <main className="preview-login" aria-labelledby="preview-login-title">
      <section className="preview-login__card">
        <p className="preview-login__eyebrow">Tend Preview</p>
        <h1 id="preview-login-title">Sign in with Tend</h1>
        <p>Use your existing Tend email and password. Preview keeps a separate local copy on this device.</p>
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
