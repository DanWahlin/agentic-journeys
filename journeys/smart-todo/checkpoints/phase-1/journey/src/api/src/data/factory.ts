import type { DataStore } from './contracts.js';
import { createMemoryStore } from './memory-store.js';
import { createSqlStore } from './sql-store.js';

let cachedStore: Promise<DataStore> | undefined;

export async function getDataStore(provider = process.env.DATA_PROVIDER): Promise<DataStore> {
  if (provider !== 'memory' && provider !== 'sql') {
    throw new Error('DATA_PROVIDER must be set to "memory" or "sql"');
  }
  if (cachedStore) return cachedStore;

  cachedStore = (async () => {
    const store = provider === 'memory' ? await createMemoryStore() : await createSqlStore();
    try {
      await store.initialize();
      return store;
    } catch (error) {
      await store.close?.();
      throw error;
    }
  })();

  try {
    return await cachedStore;
  } catch (error) {
    cachedStore = undefined;
    throw error;
  }
}

export function resetDataStoreFactory(): void {
  cachedStore = undefined;
}
