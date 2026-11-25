import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const previewDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const viteCli = path.resolve(previewDirectory, 'node_modules/vite/bin/vite.js');

async function availablePort(): Promise<number> {
  const server = net.createServer();
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Could not allocate a browser-test port.');
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  return address.port;
}

async function waitForPreview(url: string, server: ReturnType<typeof spawn>): Promise<void> {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (server.exitCode !== null) throw new Error(`Vite exited early with code ${server.exitCode}.`);
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      await delay(250);
    }
  }
  throw new Error(`Vite did not become available at ${url}.`);
}

async function main(): Promise<void> {
  const port = await availablePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  let server: ReturnType<typeof spawn> | undefined;
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
  try {
    server = spawn(process.execPath, [
      viteCli,
      '--host',
      '127.0.0.1',
      '--port',
      String(port),
      '--strictPort'
    ], { cwd: previewDirectory, stdio: 'inherit' });
    await waitForPreview(`${baseUrl}/app-preview.html`, server);
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto(`${baseUrl}/app-preview.html`);

    const result = await page.evaluate(async () => {
      const storageModule = await import(new URL('/src/storage/preview-storage.ts', location.origin).href);
      const identityModule = await import(new URL('/src/domain/preview-identity.ts', location.origin).href);
      const stateModule = await import(new URL('/src/domain/preview-state.ts', location.origin).href);
      const { PREVIEW_ACCOUNT_STORAGE_PREFIX, PREVIEW_STORAGE_KEY, PREVIEW_V44_RECOVERY_KEY,
        createPreviewBrowserStorage } = storageModule;
      const { createAuthenticatedPreviewIdentity } = identityModule;
      const { PREVIEW_BACKUP_FORMAT } = stateModule;
      const primaryAccountId = 'c0000000-0000-4000-8000-000000000146';
      const otherAccountId = 'c0000000-0000-4000-8000-000000000147';
      const primaryRoot = `${PREVIEW_ACCOUNT_STORAGE_PREFIX}:${primaryAccountId}`;
      const recoveryKey = `${primaryRoot}${PREVIEW_V44_RECOVERY_KEY.slice(PREVIEW_STORAGE_KEY.length)}`;
      const originalRaw = JSON.stringify({
        format: PREVIEW_BACKUP_FORMAT,
        schemaVersion: 44,
        marker: 'exact synthetic bytes'
      });
      const records = new Map<string, string>([[primaryRoot, originalRaw]]);
      const mapKey = (key: string) => key === PREVIEW_STORAGE_KEY
        ? primaryRoot
        : key.startsWith(`${PREVIEW_STORAGE_KEY}:`)
          ? `${primaryRoot}${key.slice(PREVIEW_STORAGE_KEY.length)}`
          : key;
      const localStorage = {
        getItem: (key: string) => records.get(mapKey(key)) ?? null,
        setItem: (key: string, value: string) => {
          const scopedKey = mapKey(key);
          if (scopedKey === recoveryKey) throw new DOMException('Synthetic quota failure', 'QuotaExceededError');
          records.set(scopedKey, value);
        },
        removeItem: (key: string) => records.delete(mapKey(key))
      };
      const primaryIdentity = createAuthenticatedPreviewIdentity(primaryAccountId, 1);
      const primaryStorage = createPreviewBrowserStorage(localStorage, primaryIdentity);
      if (!primaryStorage.prepareImmutableRecoveryCopy) throw new Error('Recovery preparation is unavailable.');
      const prepared = await primaryStorage.prepareImmutableRecoveryCopy(originalRaw);
      const activeRawUnchanged = records.get(primaryRoot) === originalRaw;

      const reloadedStorage = createPreviewBrowserStorage(localStorage, primaryIdentity);
      await reloadedStorage.loadImmutableRecoveryCopies?.();
      const recoveredAfterReload = reloadedStorage.getItem(PREVIEW_V44_RECOVERY_KEY);
      const otherStorage = createPreviewBrowserStorage(
        localStorage,
        createAuthenticatedPreviewIdentity(otherAccountId, 1)
      );
      await otherStorage.loadImmutableRecoveryCopies?.();
      const otherAccountCopy = otherStorage.getItem(PREVIEW_V44_RECOVERY_KEY);

      const changedRaw = JSON.stringify({
        format: PREVIEW_BACKUP_FORMAT,
        schemaVersion: 44,
        marker: 'conflicting synthetic bytes'
      });
      records.set(primaryRoot, changedRaw);
      const conflict = await reloadedStorage.prepareImmutableRecoveryCopy?.(changedRaw);

      return {
        prepared: prepared.kind,
        activeRawUnchanged,
        localRecoveryAbsent: records.get(recoveryKey) === undefined,
        recoveredExactAfterReload: recoveredAfterReload === originalRaw,
        otherAccountCopy,
        conflict: conflict?.kind,
        activeRawChangedByConflict: records.get(primaryRoot) === changedRaw,
        archivedBytesChangedByConflict: reloadedStorage.getItem(PREVIEW_V44_RECOVERY_KEY) !== originalRaw
      };
    });

    assert.deepEqual(result, {
      prepared: 'prepared',
      activeRawUnchanged: true,
      localRecoveryAbsent: true,
      recoveredExactAfterReload: true,
      otherAccountCopy: null,
      conflict: 'conflict',
      activeRawChangedByConflict: true,
      archivedBytesChangedByConflict: false
    });
    console.log('IndexedDB recovery browser contract passed: exact-byte archive, account isolation, and conflict protection.');
  } finally {
    await browser?.close();
    if (server?.pid && server.exitCode === null && server.signalCode === null) {
      server.kill('SIGTERM');
      await new Promise<void>(resolve => server?.once('exit', () => resolve()));
    }
  }
}

void main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
