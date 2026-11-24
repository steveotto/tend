import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  PreviewIdentityHost,
  type PreviewAuthClient,
  type PreviewSession,
  type PreviewSupabaseClientFactory
} from '../src/auth/PreviewIdentityHost.tsx';
import { localDateString } from '../src/domain/money-goals.ts';
import { localDateTimeInZone } from '../src/domain/rhythm-completion.ts';
import { addCalendarDays } from '../src/domain/rhythm-scoring.ts';
import { createRhythmSeason } from '../src/domain/rhythm-seasons.ts';
import type { SavedRhythm } from '../src/domain/rhythm-editor.ts';
import { defaultCategoryPreferences } from '../src/domain/category-availability.ts';
import {
  createEmptyPreviewData,
  createPreviewEnvelope,
  createSamplePreviewData,
  parsePreviewBackup,
  PREVIEW_SCHEMA_VERSION
} from '../src/domain/preview-state.ts';
import { migratePreviewToProposedV4 } from '../src/domain/preview-v4-migration.ts';
import {
  PREVIEW_ACCOUNT_STORAGE_PREFIX,
  PREVIEW_STORAGE_KEY
} from '../src/storage/preview-storage.ts';
import { installMemoryStorage } from './memory-storage.ts';

const accountId = 'a0000000-0000-4000-8000-000000000001';
const session: PreviewSession = { user: { id: accountId, email: 'synthetic@example.test' } };
const accountStorageKey = `${PREVIEW_ACCOUNT_STORAGE_PREFIX}:${accountId}`;

function expandAllTodayGroups() {
  for (const button of document.querySelectorAll<HTMLButtonElement>('.today-timeframe-header__disclosure')) {
    if (button.getAttribute('aria-expanded') === 'false') fireEvent.click(button);
  }
}

function scoredFaithFixture() {
  const today = localDateString(new Date());
  const trackingStartDate = addCalendarDays(today, -29);
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const rhythmId = 'user-rhythm-84000000-0000-4000-8000-000000000022';
  const data = createSamplePreviewData();
  data.todayView = 'all-today';
  const rhythm: SavedRhythm = {
    id: rhythmId,
    title: 'Synthetic daily prayer',
    cadence: 'Daily',
    timeLabel: 'Anytime',
    timeOfDay: 'anytime',
    personIds: [],
    categoryIds: ['faith'],
    schedule: { frequency: 'daily' },
    primaryFoundationId: 'faith-prayer',
    secondaryFoundationIds: [],
    scoring: {
      trackingStartDate,
      timeZone,
      scheduleHistory: [
        createRhythmSeason(rhythmId, trackingStartDate, { frequency: 'daily' })
      ]
    },
    createdLocalDate: trackingStartDate,
    createdTimeZone: timeZone
  };
  data.savedRhythms.push(rhythm);
  data.rhythmHistoryIds.push(rhythmId);
  for (let day = 0; day < 23; day += 1) {
    const effectiveDate = addCalendarDays(trackingStartDate, day);
    const completedAt = localDateTimeInZone(effectiveDate, '12:00', timeZone).toISOString();
    data.datedRhythmCompletions.push({
      id: `synthetic-faith-completion-${day}`,
      rhythmId,
      effectiveDate,
      localTime: '12:00',
      timeZone,
      completedAt,
      recordedAt: completedAt
    });
  }
  return data;
}

function fakeAuth(
  initialSession: PreviewSession | null = null,
  updateError: { message: string } | null = null,
  resetError: { message: string } | null = null,
  withBackupApi = false
) {
  let callback: ((event: string, value: PreviewSession | null) => void) | null = null;
  const resetPasswordForEmail = vi.fn(async () => ({ error: resetError }));
  const updateUser = vi.fn(async () => ({ error: updateError }));
  const signUp = vi.fn(async () => ({ data: { session: null }, error: null }));
  const signInWithPassword = vi.fn(async () => {
    callback?.('SIGNED_IN', session);
    return { data: { session }, error: null };
  });
  const signOut = vi.fn(async () => {
    callback?.('SIGNED_OUT', null);
    return { error: null };
  });
  const from = vi.fn(() => ({
    select: vi.fn(() => ({
      maybeSingle: vi.fn(async () => ({ data: null, error: null }))
    }))
  }));
  const rpc = vi.fn(async () => ({
    data: [{ revision: 1, updated_at: '2026-11-24T12:00:00Z' }],
    error: null
  }));
  const client: PreviewAuthClient = {
    auth: {
      onAuthStateChange(nextCallback) {
        callback = nextCallback;
        queueMicrotask(() => callback?.('INITIAL_SESSION', initialSession));
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      },
      signUp,
      signInWithPassword,
      resetPasswordForEmail,
      updateUser,
      signOut
    },
    ...(withBackupApi ? { from, rpc } : {})
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
    signUp,
    signInWithPassword,
    signOut,
    from,
    rpc,
    emitSession: (value: PreviewSession | null) => callback?.('INITIAL_SESSION', value),
    emitEvent: (event: string, value: PreviewSession | null) => callback?.(event, value)
  };
}

afterEach(() => {
  cleanup();
  window.history.replaceState(null, '', '/');
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('PreviewIdentityHost', () => {
  it('uses production wording on the Pages sign-in screen', async () => {
    vi.stubEnv('MODE', 'pages');
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

    await screen.findByRole('heading', { name: 'Sign in with Tend' });
    expect(screen.getByText('Tend', { selector: '.preview-login__eyebrow' })).toBeTruthy();
    expect(screen.getByText('Sign in with your Tend email and password to continue.')).toBeTruthy();
    expect(screen.getByText(/^Build /)).toBeTruthy();
    expect(screen.queryByText(/Preview|separate local copy/i)).toBeNull();
  });

  it('retains Preview wording on the local Preview sign-in screen', async () => {
    vi.stubEnv('MODE', 'development');
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

    await screen.findByRole('heading', { name: 'Sign in with Tend' });
    expect(screen.getByText('Tend Preview', { selector: '.preview-login__eyebrow' })).toBeTruthy();
    expect(screen.getByText(
      'Use your existing Tend email and password. Preview keeps a separate local copy on this device.'
    )).toBeTruthy();
  });

  it('offers Sign up with password validation, show controls, and a confirmation success state', async () => {
    window.history.replaceState(null, '', '/app-preview.html?source=signup#temporary-state');
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
    await user.click(screen.getByRole('button', { name: 'Sign up' }));
    await screen.findByRole('heading', { name: 'Create your Tend account' });

    await user.type(screen.getByRole('textbox', { name: 'Email address' }), 'new-user@example.test');
    const password = screen.getByLabelText('Password');
    await user.type(password, 'short');
    await user.type(screen.getByLabelText('Confirm password'), 'short');
    await user.click(screen.getByRole('button', { name: 'Create account' }));
    expect((await screen.findByRole('alert')).textContent).toContain('at least 8 characters');
    expect(auth.signUp).not.toHaveBeenCalled();

    await user.clear(password);
    await user.clear(screen.getByLabelText('Confirm password'));
    await user.type(password, 'long-enough-password');
    await user.type(screen.getByLabelText('Confirm password'), 'different-password');
    await user.click(screen.getByRole('button', { name: 'Create account' }));
    expect((await screen.findByRole('alert')).textContent).toContain('passwords do not match');
    expect(auth.signUp).not.toHaveBeenCalled();

    await user.clear(screen.getByLabelText('Confirm password'));
    await user.type(screen.getByLabelText('Confirm password'), 'long-enough-password');
    await user.click(screen.getByRole('button', { name: 'Show password' }));
    expect(password.getAttribute('type')).toBe('text');
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    await screen.findByRole('heading', { name: 'Check your email' });
    expect(auth.signUp).toHaveBeenCalledWith({
      email: 'new-user@example.test',
      password: 'long-enough-password',
      options: { emailRedirectTo: `${window.location.origin}/app-preview.html` }
    });
  });

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

    await screen.findByRole('button', { name: 'More, settings' });
    expect(auth.factoryOptions[0]).toMatchObject({
      auth: {
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: 'pkce',
        persistSession: true,
        storageKey: 'tend2:preview:auth-session',
        storage
      }
    });

    await user.click(screen.getByRole('button', { name: 'More, settings' }));
    await user.click(await screen.findByRole('button', { name: 'Settings' }));
    await user.click(await screen.findByRole('button', { name: 'Sign out' }));
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

    await screen.findByRole('button', { name: 'More, settings' });
    expect(screen.queryByRole('heading', { name: 'Sign in with Tend' })).toBeNull();
  });

  it('notifies account sync when the auth client refreshes a session token', async () => {
    installMemoryStorage();
    vi.stubEnv('VITE_TEND_PREVIEW_AUTO_SYNC_ENABLED', 'true');
    const auth = fakeAuth(session, null, null, true);
    render(
      <PreviewIdentityHost
        accessReady
        supabaseUrl="https://project.supabase.co"
        supabasePublishableKey="synthetic-public-key"
        clientFactory={auth.clientFactory}
      />
    );

    await screen.findByRole('button', { name: 'More, settings' });
    await waitFor(() => expect(auth.from).toHaveBeenCalled());
    const readsBeforeRefresh = auth.from.mock.calls.length;

    act(() => auth.emitEvent('TOKEN_REFRESHED', session));

    await waitFor(() => expect(auth.from.mock.calls.length).toBeGreaterThan(readsBeforeRefresh));
  });

  it('renders the authenticated Today workspace when the account has no saved data', async () => {
    const storage = installMemoryStorage();
    storage.setItem('tend:supabase-auth', 'classic-session-sentinel');
    const auth = fakeAuth(session);
    render(
      <PreviewIdentityHost
        accessReady
        supabaseUrl="https://project.supabase.co"
        supabasePublishableKey="synthetic-public-key"
        clientFactory={auth.clientFactory}
      />
    );

    await screen.findByRole('button', { name: 'More, settings' });
    expect(screen.getByRole('region', { name: "Today's plan" })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Preview could not open' })).toBeNull();
    expect(storage.getItem('tend:supabase-auth')).toBe('classic-session-sentinel');
  });

  it('keeps new-account data empty and isolated through first save, sign-out, sign-in, and reload', async () => {
    const storage = installMemoryStorage();
    vi.stubEnv('VITE_TEND_PREVIEW_AUTO_SYNC_ENABLED', 'true');
    storage.setItem('tend:supabase-auth', 'classic-session-sentinel');
    const anonymousData = createEmptyPreviewData();
    anonymousData.people = [{ id: 'sample-person-avery', displayName: 'Anonymous only' }];
    const otherAccountData = createEmptyPreviewData();
    otherAccountData.people = [{ id: 'sample-person-morgan', displayName: 'Other account only' }];
    const anonymousRaw = JSON.stringify(createPreviewEnvelope(anonymousData));
    const otherAccountKey = `${PREVIEW_ACCOUNT_STORAGE_PREFIX}:b0000000-0000-4000-8000-000000000002`;
    const otherAccountRaw = JSON.stringify(createPreviewEnvelope(otherAccountData));
    storage.setItem(PREVIEW_STORAGE_KEY, anonymousRaw);
    storage.setItem(otherAccountKey, otherAccountRaw);

    const user = userEvent.setup();
    const auth = fakeAuth(null, null, null, true);
    render(
      <PreviewIdentityHost
        accessReady
        supabaseUrl="https://project.supabase.co"
        supabasePublishableKey="synthetic-public-key"
        clientFactory={auth.clientFactory}
      />
    );
    await screen.findByRole('heading', { name: 'Sign in with Tend' });
    await user.click(screen.getByRole('button', { name: 'Sign up' }));
    await user.type(screen.getByRole('textbox', { name: 'Email address' }), 'new-user@example.test');
    await user.type(screen.getByLabelText('Password'), 'long-enough-password');
    await user.type(screen.getByLabelText('Confirm password'), 'long-enough-password');
    await user.click(screen.getByRole('button', { name: 'Create account' }));
    await screen.findByRole('heading', { name: 'Check your email' });
    expect(auth.signUp).toHaveBeenCalledOnce();
    expect(storage.getItem(accountStorageKey)).toBeNull();

    act(() => auth.emitEvent('SIGNED_IN', session));
    await screen.findByRole('region', { name: "Today's plan" });
    const initializedAccountRaw = storage.getItem(accountStorageKey);
    expect(initializedAccountRaw).not.toBeNull();
    const initializedAccount = JSON.parse(initializedAccountRaw!);
    expect(initializedAccount.schemaVersion).toBe(PREVIEW_SCHEMA_VERSION);
    expect(initializedAccount.data).toMatchObject({
      goals: [],
      savedRhythms: [],
      people: [],
      categoryPreferences: defaultCategoryPreferences,
      friendships: { cadenceSettings: [], connections: [] }
    });
    await waitFor(() => expect(auth.rpc).toHaveBeenCalledWith(
      'tend_save_user_state',
      expect.objectContaining({
        p_expected_revision: 0,
        p_schema_version: 1
      })
    ));
    expect(storage.getItem(PREVIEW_STORAGE_KEY)).toBe(anonymousRaw);
    expect(storage.getItem(otherAccountKey)).toBe(otherAccountRaw);

    await user.click(screen.getByRole('button', { name: 'People' }));
    expect(screen.queryByRole('button', { name: 'Open profile for Anonymous only' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Open profile for Other account only' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Add person' }));
    const personDialog = screen.getByRole('dialog');
    await user.type(within(personDialog).getByLabelText('Name'), 'New account person');
    await user.click(within(personDialog).getByRole('button', { name: 'Add person' }));
    await screen.findByRole('button', { name: 'Open profile for New account person' });

    const savedAccountRaw = storage.getItem(accountStorageKey);
    expect(savedAccountRaw).not.toBeNull();
    const savedAccount = JSON.parse(savedAccountRaw!);
    expect(savedAccount.data.people.map((person: { displayName: string }) => person.displayName))
      .toEqual(['New account person']);
    expect(savedAccount.data.savedRhythms).toEqual([]);
    expect(storage.getItem(PREVIEW_STORAGE_KEY)).toBe(anonymousRaw);
    expect(storage.getItem(otherAccountKey)).toBe(otherAccountRaw);

    await user.click(screen.getByRole('button', { name: 'More, settings' }));
    await user.click(screen.getByRole('button', { name: 'Settings' }));
    await user.click(screen.getByRole('button', { name: 'Sign out' }));
    await screen.findByRole('heading', { name: 'Sign in with Tend' });
    await user.type(screen.getByRole('textbox', { name: 'Email address' }), 'new-user@example.test');
    await user.type(screen.getByLabelText('Password'), 'long-enough-password');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    await screen.findByRole('button', { name: 'More, settings' });
    await user.click(screen.getByRole('button', { name: 'People' }));
    expect(await screen.findByRole('button', { name: 'Open profile for New account person' })).toBeTruthy();

    cleanup();
    const restoredAuth = fakeAuth(session);
    render(
      <PreviewIdentityHost
        accessReady
        supabaseUrl="https://project.supabase.co"
        supabasePublishableKey="synthetic-public-key"
        clientFactory={restoredAuth.clientFactory}
      />
    );
    await screen.findByRole('button', { name: 'More, settings' });
    await user.click(screen.getByRole('button', { name: 'People' }));
    expect(await screen.findByRole('button', { name: 'Open profile for New account person' })).toBeTruthy();
    expect(storage.getItem(PREVIEW_STORAGE_KEY)).toBe(anonymousRaw);
    expect(storage.getItem(otherAccountKey)).toBe(otherAccountRaw);
  });

  it('keeps account backup available in Pages mode while hiding synthetic import controls', async () => {
    vi.stubEnv('MODE', 'pages');
    installMemoryStorage();
    const user = userEvent.setup();
    const auth = fakeAuth(session, null, null, true);
    render(
      <PreviewIdentityHost
        accessReady
        supabaseUrl="https://project.supabase.co"
        supabasePublishableKey="synthetic-public-key"
        clientFactory={auth.clientFactory}
      />
    );

    await screen.findByRole('region', { name: "Today's plan" });
    await user.click(screen.getByRole('button', { name: 'More, settings' }));
    expect(await screen.findByRole('heading', { name: 'Save & sync' })).toBeTruthy();
    expect(await screen.findByText('synthetic@example.test')).toBeTruthy();
    expect(screen.queryByLabelText('Import preview backup')).toBeNull();
    expect(screen.queryByLabelText('Dry-run Classic Tend import')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Reset sample data' })).toBeNull();
    expect(screen.queryByText(/does not sync across devices/)).toBeNull();
    expect(screen.queryByRole('link', { name: 'Component catalogue' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Settings' }));
    await screen.findByRole('heading', { name: 'Settings' });
    expect(screen.queryByRole('link', { name: 'Component catalogue' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Backup & recovery' }));
    expect(screen.getByLabelText('Import backup')).toBeTruthy();
    await user.click(screen.getByText('Advanced recovery'));
    await user.click(screen.getByRole('button', { name: /Account recovery/ }));
    await user.click(screen.getByRole('button', { name: /Save this device’s copy to account/ }));
    await screen.findByText('This device’s data was saved to your account.');
    expect(auth.from).toHaveBeenCalledWith('tend_user_state');
    expect(auth.rpc).toHaveBeenCalledWith(
      'tend_save_user_state',
      expect.objectContaining({ p_expected_revision: 0, p_schema_version: 1 })
    );
    expect(JSON.stringify(auth.rpc.mock.calls)).not.toContain(accountId);
  });

  it('renders scored synthetic category data and preserves it when the session is restored again', async () => {
    const storage = installMemoryStorage();
    const data = scoredFaithFixture();
    const originalRaw = JSON.stringify(createPreviewEnvelope(data));
    storage.setItem(accountStorageKey, originalRaw);
    const user = userEvent.setup();

    const renderRestoredSession = () => {
      const auth = fakeAuth(session);
      render(
        <PreviewIdentityHost
          accessReady
          supabaseUrl="https://project.supabase.co"
          supabasePublishableKey="synthetic-public-key"
          clientFactory={auth.clientFactory}
        />
      );
    };

    renderRestoredSession();
    await screen.findByRole('button', { name: 'More, settings' });
    await user.click(screen.getByRole('tab', { name: 'All today' }));
    expandAllTodayGroups();
    await screen.findByText('Synthetic daily prayer');
    const faithRow = screen.getAllByRole('button', { name: 'Faith' })
      .find(button => button.classList.contains('menu-area'));
    expect(faithRow?.querySelector('.ma-score')?.textContent).not.toBe('—');
    expect(storage.getItem(accountStorageKey)).toBe(originalRaw);

    cleanup();
    renderRestoredSession();
    await screen.findByRole('button', { name: 'More, settings' });
    await user.click(screen.getByRole('tab', { name: 'All today' }));
    expandAllTodayGroups();
    await screen.findByText('Synthetic daily prayer');
    expect(screen.getByRole('region', { name: "Today's plan" })).toBeTruthy();
    expect(storage.getItem(accountStorageKey)).toBe(originalRaw);
  });

  it('loads supported preceding-schema account data without losing its Rhythm history', async () => {
    const storage = installMemoryStorage();
    const data = scoredFaithFixture();
    const currentEnvelope = createPreviewEnvelope(data);
    const rhythmId = data.savedRhythms[0]!.id;
    const originalRaw = JSON.stringify({
      ...currentEnvelope,
      schemaVersion: PREVIEW_SCHEMA_VERSION - 1
    });
    const parsedOriginal = parsePreviewBackup(originalRaw, localDateString(new Date()));
    expect(parsedOriginal.valid).toBe(true);
    if (parsedOriginal.valid) {
      expect(parsedOriginal.envelope.data.datedRhythmCompletions).toHaveLength(23);
      expect(parsedOriginal.envelope.data.rhythmHistoryIds).toContain(rhythmId);
    }
    const migratedOriginal = migratePreviewToProposedV4(originalRaw, localDateString(new Date()));
    expect(migratedOriginal.valid).toBe(true);
    if (migratedOriginal.valid) {
      expect(migratedOriginal.sourceSchemaVersion).toBe(PREVIEW_SCHEMA_VERSION - 1);
      expect(migratedOriginal.envelope.data.datedRhythmCompletions).toHaveLength(23);
      expect(migratedOriginal.envelope.data.rhythmHistoryIds).toContain(rhythmId);
    }
    storage.setItem(accountStorageKey, originalRaw);
    const user = userEvent.setup();
    const auth = fakeAuth(session);
    render(
      <PreviewIdentityHost
        accessReady
        supabaseUrl="https://project.supabase.co"
        supabasePublishableKey="synthetic-public-key"
        clientFactory={auth.clientFactory}
      />
    );

    await screen.findByRole('button', { name: 'More, settings' });
    expect(storage.getItem(accountStorageKey)).toBe(originalRaw);
    await user.click(screen.getByRole('tab', { name: 'All today' }));
    expandAllTodayGroups();
    await screen.findByText('Synthetic daily prayer');
    expect(storage.getItem(accountStorageKey)).toBe(originalRaw);
    const faithRow = screen.getAllByRole('button', { name: 'Faith' })
      .find(button => button.classList.contains('menu-area'));
    expect(faithRow?.querySelector('.ma-score')?.textContent).not.toBe('—');
    const stored = parsePreviewBackup(storage.getItem(accountStorageKey)!, localDateString(new Date()));
    expect(stored.valid).toBe(true);
    if (stored.valid) {
      expect(stored.envelope.data.datedRhythmCompletions).toHaveLength(23);
      expect(stored.envelope.data.rhythmHistoryIds).toContain(rhythmId);
    }
    expect(screen.queryByRole('heading', { name: 'Preview could not open' })).toBeNull();
  });

  it('sends password-reset requests back to the current Preview app without revealing account existence', async () => {
    window.history.replaceState(null, '', '/app-preview.html?source=recovery#temporary-state');
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
      { redirectTo: `${window.location.origin}/app-preview.html` }
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
