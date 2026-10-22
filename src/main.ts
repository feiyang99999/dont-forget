import './style.css';
import { boot } from './app.ts';

const root = document.querySelector('#app');
void boot().catch((error: unknown) => {
  if (root) root.textContent = error instanceof Error ? error.message : 'Failed to start';
});

if (import.meta.env.PROD) {
  void import('virtual:pwa-register').then(({ registerSW }) => {
    registerSW({ immediate: true });
  });
}
