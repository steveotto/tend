import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';
import { existsSync, readFileSync, renameSync } from 'node:fs';
import path from 'node:path';
import type { Plugin } from 'vite';
import { loadEnv } from 'vite';

const projectRoot = import.meta.dirname;
const legacyStyles = path.resolve(projectRoot, '..', 'tend.css');

const legacyStylesPlugin: Plugin = {
  name: 'serve-tend-reference-styles',
  transformIndexHtml: {
    order: 'post',
    handler(html) {
      if (html.includes('href="/tend.css"')) return html;
      return html.replace(
        '</head>',
        '    <link rel="stylesheet" href="/tend.css" />\n  </head>'
      );
    }
  },
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

function cloudflarePreviewPlugin(includeSupabaseClient: boolean): Plugin {
  return {
    name: 'cloudflare-preview-document',
    transformIndexHtml(html) {
      if (!includeSupabaseClient) return html;
      return html.replace(
        '</head>',
        '    <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.119.0"></script>\n  </head>'
      );
    }
  };
}

function pagesRootEntryPlugin(): Plugin {
  return {
    name: 'cloudflare-preview-root-entry',
    writeBundle(outputOptions) {
      const outputDirectory = path.resolve(outputOptions.dir ?? path.resolve(projectRoot, 'dist'));
      const appEntry = path.join(outputDirectory, 'app-preview.html');
      const rootEntry = path.join(outputDirectory, 'index.html');
      if (!existsSync(appEntry)) {
        throw new Error('Pages build did not emit the Preview HTML entry.');
      }
      if (existsSync(rootEntry)) {
        throw new Error('Pages build unexpectedly emitted a root index.html entry.');
      }
      renameSync(appEntry, rootEntry);
    }
  };
}

export default defineConfig(({ mode }) => {
  const isPagesBuild = mode === 'pages';
  const env = loadEnv(mode, projectRoot, 'VITE_');
  const hasPublicAuthConfig = Boolean(
    env.VITE_TEND_SUPABASE_URL?.trim()
    && env.VITE_TEND_SUPABASE_PUBLISHABLE_KEY?.trim()
  );
  const includeSupabaseClient = isPagesBuild
    && env.VITE_PREVIEW_ACCESS_READY === 'true'
    && hasPublicAuthConfig;

  return {
    base: '/',
    plugins: [
      react(),
      legacyStylesPlugin,
      ...(isPagesBuild
        ? [cloudflarePreviewPlugin(includeSupabaseClient), pagesRootEntryPlugin()]
        : [])
    ],
    server: {
      fs: {
        allow: [path.resolve(projectRoot, '..')]
      }
    },
    build: {
      outDir: path.resolve(projectRoot, 'dist'),
      rollupOptions: {
        input: isPagesBuild
          ? { index: path.resolve(projectRoot, 'app-preview.html') }
          : {
              app: path.resolve(projectRoot, 'app-preview.html'),
              catalogue: path.resolve(projectRoot, 'preview.html'),
              comparison: path.resolve(projectRoot, 'comparison.html'),
              legacyReference: path.resolve(projectRoot, 'legacy-reference.html')
            }
      }
    },
    test: {
      environment: 'jsdom',
      include: ['tests/**/*.component.test.tsx', 'tests/**/*.domain.test.ts'],
      restoreMocks: true
    }
  };
});
