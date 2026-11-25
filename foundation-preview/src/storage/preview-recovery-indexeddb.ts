export interface PreviewImmutableRecoveryArchive {
  get(key: string): Promise<string | null>;
  addIfAbsent(key: string, raw: string): Promise<'added' | 'exists'>;
  getAll(prefix: string): Promise<readonly { key: string; raw: string }[]>;
}

const databaseName = 'tend2-preview-immutable-recovery';
const databaseVersion = 1;
const objectStoreName = 'copies';

function safeError(error: DOMException | null): DOMException {
  const allowedNames = new Set([
    'QuotaExceededError',
    'SecurityError',
    'InvalidStateError',
    'UnknownError'
  ]);
  const name = error && allowedNames.has(error.name) ? error.name : 'UnknownError';
  return new DOMException('Immutable recovery archive operation failed.', name);
}

export class IndexedDbPreviewImmutableRecoveryArchive implements PreviewImmutableRecoveryArchive {
  private databasePromise: Promise<IDBDatabase> | null = null;
  private readonly factory: IDBFactory | undefined;

  constructor(factory: IDBFactory | undefined = globalThis.indexedDB) {
    this.factory = factory;
  }

  async get(key: string): Promise<string | null> {
    const database = await this.database();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(objectStoreName, 'readonly');
      const request = transaction.objectStore(objectStoreName).get(key);
      let raw: string | null = null;
      request.onsuccess = () => {
        const record: unknown = request.result;
        if (record === undefined) return;
        if (typeof record !== 'object' || record === null
          || !('key' in record) || record.key !== key
          || !('raw' in record) || typeof record.raw !== 'string') {
          transaction.abort();
          return;
        }
        raw = record.raw;
      };
      transaction.oncomplete = () => resolve(raw);
      transaction.onabort = () => reject(safeError(transaction.error));
      transaction.onerror = () => reject(safeError(transaction.error));
    });
  }

  async addIfAbsent(key: string, raw: string): Promise<'added' | 'exists'> {
    const database = await this.database();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(objectStoreName, 'readwrite');
      const request = transaction.objectStore(objectStoreName).add({ key, raw });
      let result: 'added' | 'exists' = 'added';
      request.onerror = event => {
        if (request.error?.name !== 'ConstraintError') return;
        event.preventDefault();
        event.stopPropagation();
        result = 'exists';
      };
      transaction.oncomplete = () => resolve(result);
      transaction.onabort = () => reject(safeError(transaction.error));
      transaction.onerror = () => reject(safeError(transaction.error));
    });
  }

  async getAll(prefix: string): Promise<readonly { key: string; raw: string }[]> {
    const database = await this.database();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(objectStoreName, 'readonly');
      const request = transaction.objectStore(objectStoreName).getAll(
        IDBKeyRange.bound(prefix, `${prefix}\uffff`)
      );
      let entries: { key: string; raw: string }[] = [];
      request.onsuccess = () => {
        const records: unknown = request.result;
        if (!Array.isArray(records)) {
          transaction.abort();
          return;
        }
        for (const record of records) {
          if (typeof record !== 'object' || record === null
            || !('key' in record) || typeof record.key !== 'string'
            || !('raw' in record) || typeof record.raw !== 'string') {
            transaction.abort();
            return;
          }
          if (record.key.startsWith(prefix)) entries.push({ key: record.key, raw: record.raw });
        }
      };
      transaction.oncomplete = () => resolve(entries);
      transaction.onabort = () => reject(safeError(transaction.error));
      transaction.onerror = () => reject(safeError(transaction.error));
    });
  }

  private database(): Promise<IDBDatabase> {
    if (!this.factory) {
      return Promise.reject(new DOMException('IndexedDB is unavailable.', 'InvalidStateError'));
    }
    if (!this.databasePromise) {
      this.databasePromise = new Promise<IDBDatabase>((resolve, reject) => {
        const request = this.factory!.open(databaseName, databaseVersion);
        request.onupgradeneeded = () => {
          const database = request.result;
          if (!database.objectStoreNames.contains(objectStoreName)) {
            database.createObjectStore(objectStoreName, { keyPath: 'key' });
          }
        };
        request.onsuccess = () => {
          const database = request.result;
          database.onversionchange = () => {
            database.close();
            this.databasePromise = null;
          };
          resolve(database);
        };
        request.onerror = () => reject(safeError(request.error));
        request.onblocked = () => reject(new DOMException(
          'Immutable recovery archive is unavailable.',
          'InvalidStateError'
        ));
      }).catch(error => {
        this.databasePromise = null;
        throw error;
      });
    }
    return this.databasePromise!;
  }
}
