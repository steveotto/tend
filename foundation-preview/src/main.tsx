import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.tsx';
import { CatalogApp } from './CatalogApp.tsx';
import { PreviewIdentityHost } from './auth/PreviewIdentityHost.tsx';
import {
  DEVELOPMENT_PREVIEW_IDENTITY,
  PREVIEW_AUTH_PENDING,
  createAuthenticatedPreviewIdentity
} from './domain/preview-identity.ts';
import type { PreviewIdentityState } from './domain/preview-identity.ts';
import './styles.css';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Missing app root element.');
}

const isPagesBuild = import.meta.env.MODE === 'pages';
const isCatalog = !isPagesBuild && window.location.pathname.endsWith('/preview.html');

const syntheticAccountIds = {
  a: 'a0000000-0000-4000-8000-000000000001',
  b: 'b0000000-0000-4000-8000-000000000002'
} as const;

function DevelopmentPreviewHost() {
  const [identity, setIdentity] = useState<PreviewIdentityState>(DEVELOPMENT_PREVIEW_IDENTITY);
  const [generation, setGeneration] = useState(0);

  useEffect(() => {
    function handleIdentityTestEvent(event: Event) {
      const state = (event as CustomEvent<string>).detail;
      const nextGeneration = generation + 1;
      setGeneration(nextGeneration);
      if (state === 'account-a' || state === 'account-b') {
        const accountId = syntheticAccountIds[state === 'account-a' ? 'a' : 'b'];
        setIdentity(createAuthenticatedPreviewIdentity(accountId, nextGeneration));
      } else if (state === 'signed-out' || state === 'pending') {
        setIdentity({ kind: state });
      } else if (state === 'error') {
        setIdentity({ kind: 'error', message: 'Synthetic authentication error.' });
      } else {
        setIdentity(DEVELOPMENT_PREVIEW_IDENTITY);
      }
    }
    window.addEventListener('tend-preview-test-identity', handleIdentityTestEvent);
    return () => window.removeEventListener('tend-preview-test-identity', handleIdentityTestEvent);
  }, [generation]);

  return <App identity={identity} />;
}

createRoot(rootElement).render(
  <StrictMode>
    {isPagesBuild
      ? <PreviewIdentityHost />
      : isCatalog
        ? <CatalogApp />
        : import.meta.env.DEV
          ? <DevelopmentPreviewHost />
          : <App identity={PREVIEW_AUTH_PENDING} />}
  </StrictMode>
);
