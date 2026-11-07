export type AccountId = string & { readonly __accountId: unique symbol };

export type PreviewIdentityState =
  | { kind: 'pending' }
  | { kind: 'signed-out' }
  | { kind: 'error'; message: string }
  | { kind: 'development'; sessionGeneration: number }
  | { kind: 'authenticated'; accountId: AccountId; sessionGeneration: number };

export const DEVELOPMENT_PREVIEW_IDENTITY: PreviewIdentityState = Object.freeze({
  kind: 'development',
  sessionGeneration: 0
});

export const PREVIEW_AUTH_PENDING: PreviewIdentityState = Object.freeze({ kind: 'pending' });

const accountIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function createAuthenticatedPreviewIdentity(
  accountId: string,
  sessionGeneration: number
): PreviewIdentityState {
  if (!accountIdPattern.test(accountId) || !Number.isSafeInteger(sessionGeneration) || sessionGeneration < 0) {
    return {
      kind: 'error',
      message: 'Preview access requires a valid stable account identity and session generation.'
    };
  }
  return {
    kind: 'authenticated',
    accountId: accountId.toLowerCase() as AccountId,
    sessionGeneration
  };
}

export function validatePreviewIdentity(value: unknown): PreviewIdentityState {
  if (!isRecord(value) || typeof value.kind !== 'string') {
    return { kind: 'error', message: 'Preview identity is unavailable.' };
  }
  if (value.kind === 'pending') return PREVIEW_AUTH_PENDING;
  if (value.kind === 'signed-out') return { kind: 'signed-out' };
  if (value.kind === 'error') {
    return {
      kind: 'error',
      message: typeof value.message === 'string' && value.message.trim()
        ? value.message
        : 'Preview access could not be verified.'
    };
  }
  if (value.kind === 'development') {
    return Number.isSafeInteger(value.sessionGeneration) && Number(value.sessionGeneration) >= 0
      ? { kind: 'development', sessionGeneration: Number(value.sessionGeneration) }
      : { kind: 'error', message: 'The synthetic Preview session is invalid.' };
  }
  if (value.kind === 'authenticated'
    && typeof value.accountId === 'string'
    && Number.isSafeInteger(value.sessionGeneration)) {
    return createAuthenticatedPreviewIdentity(value.accountId, Number(value.sessionGeneration));
  }
  return { kind: 'error', message: 'Preview identity is invalid.' };
}

export function previewIdentityKey(identity: PreviewIdentityState): string {
  if (identity.kind === 'authenticated') {
    return `account:${identity.accountId}:${identity.sessionGeneration}`;
  }
  if (identity.kind === 'development') return `development:${identity.sessionGeneration}`;
  return identity.kind;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
