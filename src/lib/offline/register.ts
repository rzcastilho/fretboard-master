/** Page side of the offline copy (040): register the worker after load; never throw. */
export interface OfflineHost {
  navigator: { serviceWorker?: Pick<ServiceWorkerContainer, 'register'> };
  document: Pick<Document, 'readyState'>;
  addEventListener(type: 'load', fn: () => void, opts: { once: true }): void;
}

export function registerOffline(host: OfflineHost, dev: boolean): void {
  if (dev) return;
  const container = host.navigator.serviceWorker;
  if (!container) return;

  const warn = (error: unknown) => console.warn('[fretboard-master] offline unavailable', error);
  const register = () => {
    try {
      container.register('/service-worker.js').catch(warn);
    } catch (error) {
      warn(error);
    }
  };

  if (host.document.readyState === 'complete') register();
  else host.addEventListener('load', register, { once: true });
}
