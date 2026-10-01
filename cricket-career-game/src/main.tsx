import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
// Fonts ship with the app (latin only), so they work offline and never wait on a CDN.
import '@fontsource/poppins/latin-300.css';
import '@fontsource/poppins/latin-400.css';
import '@fontsource/poppins/latin-500.css';
import '@fontsource/poppins/latin-600.css';
import '@fontsource/poppins/latin-700.css';
import '@fontsource/poppins/latin-800.css';
import '@fontsource/caveat/latin-400.css';
import '@fontsource/caveat/latin-600.css';
import './index.css';
import { setupPwa } from './lib/pwa';
import { setupAudio } from './lib/audio/setup';

setupPwa();
setupAudio();

// A code-split chunk that fails to download (a request caught mid-deploy, or a
// stale offline copy) would otherwise leave the screen blank: reload once.
window.addEventListener('vite:preloadError', (event) => {
  const key = 'cc-preload-reload';
  try {
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, '1');
  } catch {
    return; // no session storage: let the start-up safety net in index.html handle it
  }
  event.preventDefault();
  window.location.reload();
});
window.addEventListener('load', () =>
  setTimeout(() => {
    try {
      sessionStorage.removeItem('cc-preload-reload');
    } catch {
      /* ignore */
    }
  }, 10000),
);

const container = document.getElementById('root');
if (!container) throw new Error('Root element #root not found');

createRoot(container).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
