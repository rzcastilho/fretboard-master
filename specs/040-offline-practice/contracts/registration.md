# Contract: page-side registration

Module: `src/lib/offline/register.ts`. Called once from `init` in `src/hooks.client.ts`, after
`measure.start()`.

```ts
export function registerOffline(host: OfflineHost, dev: boolean): void;
// called as: registerOffline(window, import.meta.env.DEV)
```

| Condition | Behaviour |
|---|---|
| `dev === true` (`vite dev`) | Does nothing (C-09). |
| `!('serviceWorker' in host.navigator)` (including no-JS, which never runs this) | Does nothing (C-16, FR-013). |
| `document.readyState === 'complete'` | Calls `register('/service-worker.js')` straight away. |
| Otherwise | Waits for `load` (`{ once: true }`), then registers (C-09, FR-015). |
| `register()` rejects (private window, blocked storage, quota, SecurityError) | `console.warn('[fretboard-master] offline unavailable', error)`. Nothing appears in the UI (C-17, FR-013). |
| A newer worker is found or installed | The page does nothing. No `updatefound` or `controllerchange` handler, no `location.reload()`, no notice (C-05, FR-007). |

`svelte.config.js` sets:

```js
serviceWorker: { register: false, files: (file) => file !== '_headers' }
```

Kit's automatic registration is turned off (R-01), and `_headers` is left out of
`$service-worker`'s `files`.

`version.name` is set to `process.env.FM_APP_VERSION ?? version`. `vite.config.ts` already
rejects that variable outside `--mode test`.

CSP stays as it is (R-11).
