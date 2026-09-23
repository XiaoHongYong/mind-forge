import { isOhos, ohosLog, shellFacts } from './ohos';

/**
 * Startup self-check for the HarmonyOS shell.
 *
 * `CLAUDE.md` makes the point that a unit test cannot see a shell bug: the
 * component passes because the test hands it the context it needs, and then the
 * real shell renders nothing. The cheap protection is to *look* — collect
 * everything the page throws and assert there is nothing, plus probe the APIs
 * the editor depends on but that a WebView can withhold.
 *
 * Everything here is reported, never acted on. A missing `crypto.subtle` cannot
 * be fixed at runtime; it can only be discovered, and it is invisible in normal
 * use because the unsaved-backup hash comparison degrades to "never restores"
 * rather than raising.
 */

/** Page errors, in the order they happened. Bounded — a crash loop must not grow this. */
const pageErrors: string[] = [];
const MAX_ERRORS = 50;

function record(entry: string): void {
  if (pageErrors.length < MAX_ERRORS) pageErrors.push(entry);
}

function describe(reason: unknown): string {
  if (reason instanceof Error) return `${reason.name}: ${reason.message}`;
  try {
    return typeof reason === 'string' ? reason : JSON.stringify(reason);
  } catch {
    return String(reason);
  }
}

/** Facts only the page can observe. */
function collectPageFacts(): Record<string, unknown> {
  return {
    href: typeof location === 'undefined' ? '' : location.href,
    origin: typeof location === 'undefined' ? '' : location.origin,
    // A secure context is what makes `crypto.subtle` exist at all. Serving the
    // bundle over http:// or file:// would silently cost the editor its
    // document fingerprints, which is the main reason the shell serves from a
    // virtual https origin instead.
    isSecureContext: typeof isSecureContext === 'boolean' ? isSecureContext : null,
    hasSubtleCrypto: typeof crypto !== 'undefined' && typeof crypto.subtle !== 'undefined',
    // Filled in by the async probe below: the API can exist and still reject.
    subtleWorks: null as boolean | null,
    hasLocalStorage: hasLocalStorage(),
    localStorageWritable: tryLocalStorage(),
    hasIndexedDb: typeof indexedDB !== 'undefined',
    userAgent: typeof navigator === 'undefined' ? '' : navigator.userAgent,
    devicePixelRatio: typeof window === 'undefined' ? null : window.devicePixelRatio,
    viewport: typeof window === 'undefined' ? null : { w: window.innerWidth, h: window.innerHeight },
    // The primary assertion: nothing threw.
    pageErrors,
  };
}

function hasLocalStorage(): boolean {
  try {
    return typeof localStorage !== 'undefined' && localStorage !== null;
  } catch {
    // Some WebViews throw on *access*, not just on write.
    return false;
  }
}

function tryLocalStorage(): boolean {
  try {
    const probe = '__mindforge_probe__';
    localStorage.setItem(probe, '1');
    localStorage.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}

/**
 * Collects the async half and writes one merged report to hilog.
 *
 * The shell folds its own facts in and logs the pair, so the returned JSON is
 * the shell half only. Read it on device with:
 *
 *   hdc shell hilog | grep MindForge.Diagnostics
 */
export async function reportDiagnostics(): Promise<string> {
  const facts = collectPageFacts();
  try {
    // Round-trip a real digest. `crypto.subtle` existing is not the same as it
    // working — in a non-secure context it is present and rejects on use.
    const digest = await crypto.subtle.digest('SHA-256', new Uint8Array([1, 2, 3]));
    facts.subtleWorks = digest.byteLength === 32;
  } catch (err) {
    facts.subtleWorks = false;
    record(`subtle.digest: ${describe(err)}`);
  }

  const shell = await shellFacts(facts);
  const merged = JSON.stringify({ page: facts, shell: safeParse(shell) });
  ohosLog('diagnostics', merged);
  return merged;
}

function safeParse(json: string): unknown {
  try {
    return JSON.parse(json);
  } catch {
    return json;
  }
}

/** Hooks the error sources, then reports once the page has settled. */
export function installOhosDiagnostics(): void {
  if (!isOhos()) return;

  window.addEventListener('error', (event) => {
    record(`${event.message} @ ${event.filename}:${event.lineno}:${event.colno}`);
  });
  window.addEventListener('unhandledrejection', (event) => {
    record(`unhandled rejection: ${describe(event.reason)}`);
  });

  // React logs render failures through console.error, which a page-level
  // 'error' listener never sees — without this a crashed render would report
  // a clean run.
  const originalError = console.error;
  console.error = (...args: unknown[]) => {
    record(`console.error: ${args.map(describe).join(' ')}`);
    originalError.apply(console, args);
  };

  // On demand, for a device run with no debugger attached: open the console
  // and call `__mindforgeDiagnostics()`.
  (window as unknown as Record<string, unknown>).__mindforgeDiagnostics = () => reportDiagnostics();

  // After `load`, so module-level failures have already been recorded.
  window.addEventListener('load', () => {
    void reportDiagnostics().catch(() => {
      // The shell itself is unreachable; nothing useful left to report with.
    });
  });
}
