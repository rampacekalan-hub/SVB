import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
// Floory brand tokens — pred styles.css aby sme ich mohli prebíjať/používať
import './floory-tokens.css';
import './styles.css';

/**
 * DEV: unregister legacy service workers + clear Cache Storage.
 *
 * V dev móde je PWA vypnutá (vite.config.ts → devOptions.enabled = false),
 * ale Chrome si pamätá SW z predchádzajúcich sessions keď bolo PWA zapnuté
 * a servuje stale bundle, kým user ručne neodregistruje.
 * Tento guard to spraví automaticky pri každom načítaní dev buildu.
 *
 * V prod buildoch (import.meta.env.PROD === true) sa tento kód vynechá,
 * takže produkčný SW ostáva plne funkčný.
 */
if ((import.meta as any).env?.DEV && 'serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((regs) => {
    if (regs.length === 0) return;
    console.info('[dev] Odregistrovávam', regs.length, 'stale service worker(ov)…');
    Promise.all(regs.map((r) => r.unregister()))
      .then(() => (typeof caches !== 'undefined' ? caches.keys() : Promise.resolve([])))
      .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
      .then(() => {
        console.info('[dev] Stale SW + cache vymazané — reload.');
        location.reload();
      });
  });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>,
);
