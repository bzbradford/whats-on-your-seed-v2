import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import tailwindcss from '@tailwindcss/vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Two build targets from one codebase:
//   default     -> dist/ for GitHub Pages; the catalog is fetched from data/ at runtime
//   standalone  -> dist-standalone/index.html, one offline file with the catalog inlined
export default defineConfig(({ mode }) => {
  const standalone = mode === 'standalone';
  return {
    plugins: [tailwindcss(), svelte(), ...(standalone ? [viteSingleFile()] : [])],
    base: './',
    resolve: {
      alias: { $data: fileURLToPath(new URL('./public/data', import.meta.url)) },
    },
    // The standalone file embeds the catalog, so don't also copy public/ beside it.
    publicDir: standalone ? false : 'public',
    build: {
      outDir: standalone ? 'dist-standalone' : 'dist',
      // The catalog is a multi-MB string in the standalone bundle; that's expected.
      chunkSizeWarningLimit: standalone ? 8000 : 500,
    },
    test: {
      include: ['tests/unit/**/*.test.ts'],
    },
  };
});
