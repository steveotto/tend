import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.tsx';
import { CatalogApp } from './CatalogApp.tsx';
import './styles.css';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Missing app root element.');
}

const isCatalog = window.location.pathname.endsWith('/preview.html');

createRoot(rootElement).render(
  <StrictMode>
    {isCatalog ? <CatalogApp /> : <App />}
  </StrictMode>
);
