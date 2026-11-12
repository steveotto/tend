import { defineConfig } from 'vite';
import path from 'node:path';

const projectRoot = import.meta.dirname;

export default defineConfig({
  build: {
    outDir: path.resolve(projectRoot, 'dist'),
    emptyOutDir: false,
    lib: {
      entry: path.resolve(projectRoot, '../src/scoring/browser.ts'),
      name: 'TendScoring',
      formats: ['iife'],
      fileName: () => 'tend-scoring.js'
    }
  }
});
