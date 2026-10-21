import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { Plugin } from 'vite';

const projectRoot = import.meta.dirname;
const legacyStyles = path.resolve(projectRoot, '..', 'tend.css');

const legacyStylesPlugin: Plugin = {
  name: 'serve-tend-reference-styles',
  configureServer(server) {
    server.middlewares.use((request, response, next) => {
      const pathname = new URL(request.url ?? '/', 'http://localhost').pathname;
      if (pathname !== '/tend.css') return next();
      response.setHeader('Content-Type', 'text/css; charset=utf-8');
      response.end(readFileSync(legacyStyles));
    });
  },
  generateBundle() {
    this.emitFile({
      type: 'asset',
      fileName: 'tend.css',
      source: readFileSync(legacyStyles)
    });
  }
};

export default defineConfig({
  plugins: [react(), legacyStylesPlugin],
  server: {
    fs: {
      allow: [path.resolve(import.meta.dirname, '..')]
    }
  },
  build: {
    rollupOptions: {
      input: {
        app: path.resolve(projectRoot, 'app-preview.html'),
        catalogue: path.resolve(projectRoot, 'preview.html'),
        comparison: path.resolve(projectRoot, 'comparison.html'),
        legacyReference: path.resolve(projectRoot, 'legacy-reference.html')
      }
    }
  },
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.component.test.tsx'],
    restoreMocks: true
  }
});
