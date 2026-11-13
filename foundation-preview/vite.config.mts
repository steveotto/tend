import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type { Plugin } from 'vite';
import { loadEnv } from 'vite';

const projectRoot = import.meta.dirname;
const legacyStyles = path.resolve(projectRoot, '..', 'tend.css');

function legacyStylesPlugin(isPagesBuild: boolean): Plugin {
  return {
    name: 'serve-tend-reference-styles',
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        if (isPagesBuild) return html;
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
      if (isPagesBuild) {
        this.emitFile({
          type: 'asset',
          fileName: 'classic/tend.css',
          source: readFileSync(legacyStyles)
        });
      }
    }
  };
}

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

function legacyShellPlugin(): Plugin {
  return {
    name: 'package-production-and-classic-shells',
    generateBundle(_outputOptions, bundle) {
      const legacyHtml = readFileSync(path.resolve(projectRoot, '..', 'index.html'), 'utf8');
      this.emitFile({
        type: 'asset',
        fileName: 'classic/index.html',
        source: legacyHtml
      });

      for (const [, reference] of legacyHtml.matchAll(/(?:src|href)="([^"]+)"/g)) {
        const [referencePath] = reference!.split(/[?#]/, 1);
        if (!referencePath || referencePath.startsWith('/') || /^[a-z][a-z\d+.-]*:/i.test(referencePath)) continue;
        if (referencePath === 'tend.css' || referencePath === 'tend-scoring.js' || bundle[`classic/${referencePath}`]) continue;
        const sourcePath = path.resolve(projectRoot, '..', referencePath);
        if (!existsSync(sourcePath)) throw new Error(`Legacy shell asset is missing: ${referencePath}`);
        const source = readFileSync(sourcePath);
        this.emitFile({
          type: 'asset',
          fileName: referencePath,
          source
        });
        this.emitFile({
          type: 'asset',
          fileName: `classic/${referencePath}`,
          source
        });
      }
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
      legacyStylesPlugin(isPagesBuild),
      ...(isPagesBuild
        ? [cloudflarePreviewPlugin(includeSupabaseClient), legacyShellPlugin()]
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
          ? {
              index: path.resolve(projectRoot, 'index.html'),
              'app-preview': path.resolve(projectRoot, 'app-preview.html')
            }
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
