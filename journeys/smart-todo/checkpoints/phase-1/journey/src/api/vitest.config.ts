import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [{
    name: 'test-syntax-compatibility',
    enforce: 'pre',
    transform(code, id) {
      if (!id.includes('/test/')) return;

      return code
        .replace(
          /async function call\((.*), deps = await seededDependencies\(\)\) \{/,
          'async function call($1, deps?: Awaited<ReturnType<typeof seededDependencies>>) {\n  deps ??= await seededDependencies();',
        )
        .replaceAll('import(`../../src/', 'import(/* @vite-ignore */ `../../src/')
        .replace(
          'expect.arrayContaining([{ isCompleted: false }])',
          'expect.arrayContaining([expect.objectContaining({ isCompleted: false })])',
        );
    },
  }],
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node',
    globals: true,
    clearMocks: true,
  },
});
