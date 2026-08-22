import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App, { App as NamedApp } from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { registerServiceWorker } from './lib/pwa';
import './index.css';

const AppComponent = App || NamedApp;

// Register PWA Service Worker
registerServiceWorker();

// Guard against third-party extension errors (e.g. MetaMask, Ethereum providers, Web3 injection)
if (typeof window !== 'undefined') {
  const isExtensionOrWeb3Error = (msg?: string | null) => {
    if (!msg) return false;
    const str = String(msg).toLowerCase();
    return (
      str.includes('metamask') ||
      str.includes('failed to connect to metamask') ||
      str.includes('ethereum') ||
      str.includes('web3') ||
      str.includes('chrome-extension://') ||
      str.includes('moz-extension://') ||
      str.includes('safari-extension://') ||
      str.includes('wallet')
    );
  };

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    const msg = (reason && (reason.message || reason.stack || reason)) || '';
    if (isExtensionOrWeb3Error(msg)) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, true);

  window.addEventListener('error', (event) => {
    const msg = event.message || (event.error && event.error.message) || '';
    const filename = event.filename || '';
    if (isExtensionOrWeb3Error(msg) || isExtensionOrWeb3Error(filename)) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, true);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <AppComponent />
    </ErrorBoundary>
  </StrictMode>,
);


