import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { MIGRATIONS } from '../../src/data/migrations.js';

describe('SQL migrations', () => {
  it('guards every migration with the object-specific existence check', async () => {
    expect(MIGRATIONS.length).toBeGreaterThan(0);
    for (const statement of MIGRATIONS) {
      if (statement.includes('CREATE TABLE')) expect(statement).toMatch(/IF\s+OBJECT_ID/i);
      if (statement.includes('ADD ')) expect(statement).toMatch(/IF\s+COL_LENGTH/i);
      if (statement.includes('CREATE INDEX')) {
        expect(statement).toMatch(/IF\s+NOT\s+EXISTS[\s\S]+sys\.indexes[\s\S]+object_id\s*=\s*OBJECT_ID/i);
      }
    }
  });

  it('requests sp_getapplock before running migrations', async () => {
    const source = await readFile(new URL('../../src/data/sql-store.ts', import.meta.url), 'utf8');
    expect(source).toMatch(/sp_getapplock/);
    expect(source.indexOf('sp_getapplock')).toBeLessThan(source.indexOf('MIGRATIONS'));
  });
});
