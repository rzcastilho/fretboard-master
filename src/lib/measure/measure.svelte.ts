/**
 * Measurement facade (specs/028 contracts/client-api.md §4, data-model §7). Skeleton: `start()`
 * wires the queue and transport; the per-event methods are no-op stubs that later stories fill.
 * With an empty endpoint nothing is created: no queue, timers or listeners (FR-005a).
 */
import { instrument } from '$lib/state/instrument.svelte';
import { language } from '$lib/state/language.svelte';
import type { FretboardToolId } from '$lib/shell/tools';
import { viewParams } from '$lib/link';
import { currentSnapshot } from '$lib/state/share.svelte';
import { readDeviceClass } from './device';
import { sanitizeMessage } from './sanitize';
import { createQueue, type QueueDeps } from './queue';
import { createTransport, trackingRefused } from './transport';
import { instrumentOf, sameTraits, traitsOf } from './traits';
import type {
  DeviceClass,
  EventTool,
  EventType,
  FailureKind,
  FailureReport,
  InstrumentTraits,
  ReportTool,
  UsageEvent,
  WireItem
} from './wire';

const EDIT_QUIET_MS = 1000;
const MAX_SECS = 3600;

export interface MeasureTestDeps {
  endpoint?: string;
  send?: (body: string) => void;
  refused?: boolean;
  device?: DeviceClass;
  now?: () => number;
  hidden?: boolean;
  setTimer?: QueueDeps['setTimer'];
  clearTimer?: QueueDeps['clearTimer'];
}

interface Queue {
  push(item: WireItem): void;
  flush(): void;
}

let overrides: MeasureTestDeps = {};
let started = false;
/** Page listeners added by `start()` (only when enabled), kept so tests can remove them. */
let teardown: (() => void) | null = null;
/** `opening.start` runs before `measure.start`: hold its link-opened until the facade is ready. */
let earlyLinkOpened: FretboardToolId | null = null;
/** `language.start` also runs before `measure.start`: hold its missing-text keys the same way. */
const earlyMissing: string[] = [];

/** Once-per-load bookkeeping (data-model §7). Plain values, never rendered. */
const seen: {
  tools: Set<EventTool>;
  interacted: boolean;
  sound: boolean;
  linkOpened: boolean;
  hidden: boolean;
  editTimer: unknown;
} = {
  tools: new Set(),
  interacted: false,
  sound: false,
  linkOpened: false,
  hidden: false,
  editTimer: null
};

const nowMs = (): number => (overrides.now ?? (() => performance.now()))();

function clearTimer(handle: unknown): void {
  (overrides.clearTimer ?? ((h) => clearTimeout(h as ReturnType<typeof setTimeout>)))(handle);
}

function setTimer(fn: () => void, ms: number): unknown {
  return (overrides.setTimer ?? ((f, t) => setTimeout(f, t)))(fn, ms);
}

/** Build a usage event with the current device, language and traits (nothing else). */
function usage(type: EventType, tool: EventTool, extra: Partial<UsageEvent> = {}): UsageEvent {
  const t = traitsOf(instrument.active);
  return {
    r: 'e',
    type,
    tool,
    device: page.device,
    lang: language.current,
    strings: t.strings,
    tuning: t.tuning,
    hand: t.hand,
    ...extra
  } as UsageEvent;
}

const NAME = /^[A-Za-z_$][\w$]{0,63}$/;
const KEY = /^[a-z0-9_]{1,96}$/;

/** Build a failure report: instrument shape, view params (never instrument keys), no stack. */
function failure(
  kind: FailureKind,
  tool: ReportTool,
  detail: { name: string; msg: string } | { key: string }
): FailureReport {
  let view: Record<string, string> | undefined;
  if (tool !== 'shell') {
    try {
      view = viewParams(currentSnapshot(tool));
    } catch {
      // The failing state may itself be unreadable: report without the view.
    }
  }
  return {
    r: 'r',
    kind,
    tool,
    device: page.device,
    lang: language.current,
    ...instrumentOf(instrument.active),
    ver: __APP_VERSION__,
    ...(view === undefined ? {} : { view }),
    ...detail
  };
}

/** Run a facade call so nothing it does can reach the caller (FR-004, FR-010). */
function guarded(fn: () => void): void {
  if (!page.enabled) return;
  try {
    fn();
  } catch {
    // Measurement is best-effort and must never disturb the app.
  }
}

/** Page-load state (data-model §7); later stories read and extend it. */
const page: {
  enabled: boolean;
  device: DeviceClass;
  queue: Queue | null;
  lastTraits: InstrumentTraits | null;
  currentTool: EventTool | null;
  /** Queue one item; never throws into the caller (FR-004, FR-010). */
  emit(item: WireItem): void;
} = {
  enabled: false,
  device: 'desktop',
  queue: null,
  lastTraits: null,
  currentTool: null,
  emit(item) {
    try {
      this.queue?.push(item);
    } catch {
      // Measurement is best-effort and must never disturb the app.
    }
  }
};

export const measure = {
  /** Once, from `hooks.client` init, after `opening.start`. Idempotent. */
  start(): void {
    if (started) return;
    started = true;
    try {
      const endpoint = overrides.endpoint ?? __FM_MEASURE_ENDPOINT__;
      page.enabled = endpoint !== '' && !(overrides.refused ?? trackingRefused());
      if (!page.enabled) return;
      page.device = overrides.device ?? readDeviceClass();
      page.lastTraits = traitsOf(instrument.active);
      seen.hidden = overrides.hidden ?? document.visibilityState === 'hidden';
      const onVisibility = (): void => {
        if (document.visibilityState !== 'hidden') return;
        seen.hidden = true;
        page.queue?.flush();
      };
      const onPageHide = (): void => page.queue?.flush();
      document.addEventListener('visibilitychange', onVisibility);
      window.addEventListener('pagehide', onPageHide);
      teardown = () => {
        document.removeEventListener('visibilitychange', onVisibility);
        window.removeEventListener('pagehide', onPageHide);
      };
      const send = overrides.send ?? createTransport(endpoint);
      page.queue = createQueue({
        send,
        setTimer: overrides.setTimer ?? ((fn, ms) => setTimeout(fn, ms)),
        clearTimer:
          overrides.clearTimer ?? ((h) => clearTimeout(h as ReturnType<typeof setTimeout>))
      });
    } catch {
      page.enabled = false;
      page.queue = null;
    }
    const early = earlyLinkOpened;
    earlyLinkOpened = null;
    if (early !== null) measure.linkOpened(early);
    for (const key of earlyMissing.splice(0)) measure.missingText(key);
  },
  toolOpened(tool: FretboardToolId): void {
    guarded(() => {
      page.currentTool = tool;
      if (seen.tools.has(tool)) return;
      const first = seen.tools.size === 0;
      seen.tools.add(tool);
      page.emit(usage('tool-opened', tool, first ? { start: true } : {}));
    });
  },
  firstInteraction(): void {
    guarded(() => {
      if (seen.interacted || page.currentTool === null) return;
      seen.interacted = true;
      const secs = Math.min(MAX_SECS, Math.max(0, Math.floor(nowMs() / 1000)));
      page.emit(usage('first-interaction', page.currentTool, seen.hidden ? {} : { secs }));
    });
  },
  soundPlayed(): void {
    guarded(() => {
      if (seen.sound || page.currentTool === null) return;
      seen.sound = true;
      page.emit(usage('sound-played', page.currentTool));
    });
  },
  linkShared(tool: FretboardToolId): void {
    guarded(() => page.emit(usage('link-shared', tool)));
  },
  linkOpened(tool: FretboardToolId): void {
    if (!started) {
      earlyLinkOpened = tool;
      return;
    }
    guarded(() => {
      if (seen.linkOpened) return;
      seen.linkOpened = true;
      page.emit(usage('link-opened', tool));
    });
  },
  instrumentEdited(): void {
    guarded(() => {
      if (seen.editTimer !== null) clearTimer(seen.editTimer);
      seen.editTimer = setTimer(() => {
        seen.editTimer = null;
        guarded(() => {
          const now = traitsOf(instrument.active);
          if (page.lastTraits !== null && sameTraits(now, page.lastTraits)) return;
          page.lastTraits = now;
          if (page.currentTool !== null) page.emit(usage('instrument-changed', page.currentTool));
        });
      }, EDIT_QUIET_MS);
    });
  },
  /** The tool on screen, for callers that report without knowing it (audio). */
  activeTool(): FretboardToolId | null {
    return page.currentTool;
  },
  report(input: {
    kind: Exclude<FailureKind, 'missing-text'>;
    tool: FretboardToolId | null;
    error: unknown;
  }): void {
    guarded(() => {
      const tool: ReportTool = input.tool ?? 'shell';
      const e = input.error;
      const name = e instanceof Error && NAME.test(e.name) ? e.name : 'UnknownError';
      const msg = sanitizeMessage(e instanceof Error ? e.message : String(e));
      page.emit(failure(input.kind, tool, { name, msg }));
    });
  },
  missingText(key: string): void {
    if (!started) {
      earlyMissing.push(key);
      return;
    }
    guarded(() => {
      if (!KEY.test(key)) return;
      page.emit(failure('missing-text', page.currentTool ?? 'shell', { key }));
    });
  }
};

/** Test seam: replace the environment before `measure.start()` (Vitest only). */
export function useMeasureForTests(deps: MeasureTestDeps): void {
  resetMeasureForTests();
  overrides = deps;
}

/** Test seam: forget all page-load state (Vitest only). */
export function resetMeasureForTests(): void {
  if (seen.editTimer !== null) clearTimer(seen.editTimer);
  teardown?.();
  teardown = null;
  overrides = {};
  started = false;
  earlyLinkOpened = null;
  earlyMissing.length = 0;
  page.enabled = false;
  page.device = 'desktop';
  page.queue = null;
  page.lastTraits = null;
  page.currentTool = null;
  seen.tools.clear();
  seen.interacted = false;
  seen.sound = false;
  seen.linkOpened = false;
  seen.hidden = false;
  seen.editTimer = null;
}
