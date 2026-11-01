import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  PreviewIdentityHost,
  type PreviewAuthClient,
  type PreviewSession,
  type PreviewSupabaseClientFactory
} from '../src/auth/PreviewIdentityHost.tsx';
import { installMemoryStorage } from './memory-storage.ts';

const accountId = 'a0000000-0000-4000-8000-000000000001';
const session: PreviewSession = { user: { id: accountId } };

function fakeAuth(
  initialSession: PreviewSession | null = null,
  updateError: { message: string } | null = null,
  resetError: { message: string } | null = null
) {
  let callback: ((event: string, value: PreviewSession | null) => void) | null = null;
  const resetPasswordForEmail = vi.fn(async () => ({ error: resetError }));
  const updateUser = vi.fn(async () => ({ error: updateError }));
  const signInWithPassword = vi.fn(async () => {
    callback?.('SIGNED_IN', session);
    return { data: { session }, error: null };
  });
  const signOut = vi.fn(async () => {
    callback?.('SIGNED_OUT', null);
    return { error: null };
  });
  const client: PreviewAuthClient = {
    auth: {
      onAuthStateChange(nextCallback) {
        callback = nextCallback;
        queueMicrotask(() => callback?.('INITIAL_SESSION', initialSession));
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      },
      signInWithPassword,
      resetPasswordForEmail,
      updateUser,
      signOut
    }
  };
  const factoryOptions: Array<Parameters<PreviewSupabaseClientFactory>[2]> = [];
  const clientFactory: PreviewSupabaseClientFactory = vi.fn((_url, _key, options) => {
    factoryOptions.push(options);
    return client;
  });
  return {
    clientFactory,
    factoryOptions,
    resetPasswordForEmail,
    updateUser,
    signInWithPassword,
    signOut,
    emitSession: (value: PreviewSession | null) => callback?.('INITIAL_SESSION', value),
    emitEvent: (event: string, value: PreviewSession | null) => callback?.(event, value)
  };
}

afterEach(() => {
  cleanup();
  window.history.replaceState(null, '', '/');
  vi.restoreAllMocks();
});

describe('PreviewIdentityHost', () => {
  it('does not initialize authentication or account data before access is enabled', () => {
    installMemoryStorage();
    const auth = fakeAuth();
    render(
      <PreviewIdentityHost
        accessReady={false}
        supabaseUrl="https://project.supabase.co"
        supabasePublishableKey="synthetic-public-key"
        clientFactory={auth.clientFactory}
      />
    );

    expect(screen.getByRole('heading', { name: 'Preview setup is incomplete' })).toBeTruthy();
    expect(auth.clientFactory).not.toHaveBeenCalled();
    expect(window.localStorage.length).toBe(0);
  });

  it('fails closed when the public authentication configuration is invalid', () => {
    installMemoryStorage();
    const auth = fakeAuth();
    render(
      <PreviewIdentityHost
        accessReady
        supabaseUrl="javascript:alert(1)"
        supabasePublishableKey="synthetic-public-key"
        clientFactory={auth.clientFactory}
      />
    );

    expect(screen.getByRole('heading', { name: 'Preview sign-in is not configured' })).toBeTruthy();
    expect(auth.clientFactory).not.toHaveBeenCalled();
    expect(window.localStorage.length).toBe(0);
  });

  it('uses a Preview-only session key and returns to signed-out on logout', async () => {
    const storage = installMemoryStorage();
    storage.setItem('tend:supabase-auth', 'classic-session-sentinel');
    const priorAccountData = `tend2:preview:account:${accountId}:recovery`;
    storage.setItem(priorAccountData, 'synthetic-recovery-copy');
    const auth = fakeAuth();
    const user = userEvent.setup();
    render(
      <PreviewIdentityHost
        accessReady
        supabaseUrl="https://project.supabase.co"
        supabasePublishableKey="synthetic-public-key"
        clientFactory={auth.clientFactory}
      />
    );

    const email = await screen.findByRole('textbox', { name: 'Email address' });
    await user.type(email, 'synthetic@example.test');
    await user.type(screen.getByLabelText('Password'), 'not-a-real-password');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    await screen.findByRole('button', { name: 'Sign out' });
    expect(auth.factoryOptions[0]).toMatchObject({
      auth: {
        autoRefreshToken: true,
        detectSessionInUrl: true,
        persistSession: true,
        storageKey: 'tend2:preview:auth-session',
        storage
      }
    });

    await user.click(screen.getByRole('button', { name: 'Sign out' }));
    await screen.findByRole('heading', { name: 'Sign in with Tend' });
    expect(auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
    expect(storage.getItem(priorAccountData)).toBe('synthetic-recovery-copy');
    expect(storage.getItem('tend:supabase-auth')).toBe('classic-session-sentinel');

    act(() => auth.emitSession(session));
    expect(screen.getByRole('heading', { name: 'Sign in with Tend' })).toBeTruthy();
  });

  it('restores a valid existing session without showing the sign-in form', async () => {
    installMemoryStorage();
    const auth = fakeAuth(session);
    render(
      <PreviewIdentityHost
        accessReady
        supabaseUrl="https://project.supabase.co"
        supabasePublishableKey="synthetic-public-key"
        clientFactory={auth.clientFactory}
      />
    );

    await screen.findByRole('button', { name: 'Sign out' });
    expect(screen.queryByRole('heading', { name: 'Sign in with Tend' })).toBeNull();
  });

  it('sends password-reset requests back to the Preview root without revealing account existence', async () => {
    installMemoryStorage();
    const auth = fakeAuth();
    const user = userEvent.setup();
    render(
      <PreviewIdentityHost
        accessReady
        supabaseUrl="https://project.supabase.co"
        supabasePublishableKey="synthetic-public-key"
        clientFactory={auth.clientFactory}
      />
    );

    await user.click(await screen.findByRole('button', { name: 'Forgot password?' }));
    await user.type(screen.getByRole('textbox', { name: 'Email address' }), 'synthetic@example.test');
    await user.click(screen.getByRole('button', { name: 'Send reset link' }));

    expect((await screen.findByRole('status')).textContent).toContain(
      'If that email belongs to a Tend account, a password-reset link has been sent.'
    );
    expect(auth.resetPasswordForEmail).toHaveBeenCalledWith(
      'synthetic@example.test',
      { redirectTo: `${window.location.origin}/` }
    );
  });

  it('routes a recovery session to confirmed new-password fields and updates without the old password', async () => {
    window.history.replaceState(null, '', '/#access_token=synthetic-token&type=recovery&token_type=bearer');
    installMemoryStorage();
    const auth = fakeAuth();
    const user = userEvent.setup();
    render(
      <PreviewIdentityHost
        accessReady
        supabaseUrl="https://project.supabase.co"
        supabasePublishableKey="synthetic-public-key"
        clientFactory={auth.clientFactory}
      />
    );
    await screen.findByRole('heading', { name: 'Sign in with Tend' });

    act(() => auth.emitEvent('PASSWORD_RECOVERY', session));
    expect(await screen.findByRole('heading', { name: 'Choose a new password' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Sign out' })).toBeNull();
    expect(window.location.hash).toBe('');
    act(() => auth.emitEvent('TOKEN_REFRESHED', session));
    expect(screen.getByRole('heading', { name: 'Choose a new password' })).toBeTruthy();

    await user.type(screen.getByLabelText('New password'), 'synthetic-new-password');
    await user.type(screen.getByLabelText('Confirm password'), 'different-password');
    await user.click(screen.getByRole('button', { name: 'Save new password' }));
    expect((await screen.findByRole('alert')).textContent).toContain('The passwords do not match.');
    expect(auth.updateUser).not.toHaveBeenCalled();

    await user.clear(screen.getByLabelText('Confirm password'));
    await user.type(screen.getByLabelText('Confirm password'), 'synthetic-new-password');
    await user.click(screen.getByRole('button', { name: 'Save new password' }));
    expect(await screen.findByRole('heading', { name: 'Your password is updated' })).toBeTruthy();
    expect(auth.updateUser).toHaveBeenCalledWith({ password: 'synthetic-new-password' });
    expect(screen.queryByRole('button', { name: 'Sign out' })).toBeNull();
  });

  it('retains the recovery form and gives a safe message when Supabase rejects the password update', async () => {
    installMemoryStorage();
    const auth = fakeAuth(null, { message: 'synthetic failure' });
    const user = userEvent.setup();
    render(
      <PreviewIdentityHost
        accessReady
        supabaseUrl="https://project.supabase.co"
        supabasePublishableKey="synthetic-public-key"
        clientFactory={auth.clientFactory}
      />
    );
    await screen.findByRole('heading', { name: 'Sign in with Tend' });
    act(() => auth.emitEvent('PASSWORD_RECOVERY', session));

    await user.type(screen.getByLabelText('New password'), 'synthetic-new-password');
    await user.type(screen.getByLabelText('Confirm password'), 'synthetic-new-password');
    await user.click(screen.getByRole('button', { name: 'Save new password' }));

    expect((await screen.findByRole('alert')).textContent).toContain(
      'We could not update your password. The reset link may have expired; request a new one and try again.'
    );
    expect(screen.getByRole('heading', { name: 'Choose a new password' })).toBeTruthy();
    expect(auth.updateUser).toHaveBeenCalledWith({ password: 'synthetic-new-password' });
  });

  it('shows an invalid-link recovery state for expired Supabase callbacks without logging in', async () => {
    window.history.replaceState(null, '', '/#error=access_denied&error_code=otp_expired&type=recovery');
    installMemoryStorage();
    const auth = fakeAuth();
    render(
      <PreviewIdentityHost
        accessReady
        supabaseUrl="https://project.supabase.co"
        supabasePublishableKey="synthetic-public-key"
        clientFactory={auth.clientFactory}
      />
    );

    expect(await screen.findByRole('heading', { name: 'This reset link can’t be used' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Sign out' })).toBeNull();
    expect(window.location.hash).toBe('');
    expect(auth.clientFactory).toHaveBeenCalled();
  });
});
