import { beforeEach, describe, expect, it, vi } from 'vitest';

const initialize = vi.fn();
const close = vi.fn();
const store = {
  initialize,
  close,
  todos: {},
  actionSteps: {},
};

vi.mock('../../src/data/memory-store.js', () => ({
  createMemoryStore: vi.fn(async () => store),
}));
vi.mock('../../src/data/sql-store.js', () => ({
  createSqlStore: vi.fn(async () => store),
}));

describe('data-store factory', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { resetDataStoreFactory } = await import('../../src/data/factory.js');
    resetDataStoreFactory();
  });

  it('caches a successful store initialization but not a failed one', async () => {
    const { getDataStore } = await import('../../src/data/factory.js');
    initialize.mockRejectedValueOnce(new Error('first initialization failed')).mockResolvedValue(undefined);
    await expect(getDataStore('memory')).rejects.toThrow('first initialization failed');
    const firstSuccess = await getDataStore('memory');
    const cached = await getDataStore('memory');
    expect(firstSuccess).toBe(cached);
    expect(initialize).toHaveBeenCalledTimes(2);
  });

  it.each([undefined, '', 'unknown'])('fails startup for missing or unknown DATA_PROVIDER value %s', async (provider) => {
    const { getDataStore } = await import('../../src/data/factory.js');
    await expect(getDataStore(provider)).rejects.toThrow(/DATA_PROVIDER/);
  });

  it('closes the SQL pool when initialization fails', async () => {
    const { getDataStore } = await import('../../src/data/factory.js');
    initialize.mockRejectedValueOnce(new Error('migration failure'));
    await expect(getDataStore('sql')).rejects.toThrow('migration failure');
    expect(close).toHaveBeenCalledOnce();
  });
});
