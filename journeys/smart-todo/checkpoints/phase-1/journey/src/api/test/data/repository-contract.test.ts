import { afterAll } from 'vitest';
import { createMemoryStore } from '../../src/data/memory-store.js';
import { createSqlStore } from '../../src/data/sql-store.js';
import type { DataStore } from '../../src/data/contracts.js';
import { repositoryContractSuite } from './repository-contract.js';

repositoryContractSuite('memory', createMemoryStore);

if (process.env.AZURE_SQL_SERVER) {
  const stores: DataStore[] = [];
  repositoryContractSuite('sql', async () => {
    const store = await createSqlStore();
    stores.push(store);
    return store;
  });
  afterAll(async () => {
    await Promise.all(stores.map((store) => store.close?.()));
  });
}
