import { toBase64, fromBase64 } from '../utils/base64';

/**
 * Adapter for the HarmonyOS NEXT shell (`ohos/`).
 *
 * The shell injects an ArkTS object as `window.MindForgeNative` via ArkWeb's
 * `javaScriptProxy` (see `ohos/entry/src/main/ets/web/NativeBridge.ets`). Every
 * method answers with a JSON envelope — `{ ok, error, value }` — rather than
 * throwing, because an exception crossing the JS/ArkTS boundary arrives in the
 * page as an opaque string. {@link call} unwraps it and rethrows as a real
 * `Error`, so call sites can be written exactly like the Tauri ones.
 *
 * ## The document model differs from desktop
 *
 * The desktop shell reads and writes absolute paths the user picked, forever.
 * HarmonyOS sandboxes the app: the picker returns a `file://` URI carrying a
 * grant the system revokes on exit. Reopening a recent file therefore needs
 * {@link persistUri} right after picking, and {@link activateUri} before the
 * next read. Whether the device honours that is a per-device question — see
 * {@link supportsPersistentFileAccess} and `ohos/README.md`.
 */

/** Wire format returned by every bridge method. */
interface BridgeEnvelope {
  ok: boolean;
  error: string;
  value: string;
}

/** A document reference as the shell describes it. */
export interface OhosDocRef {
  uri: string;
  name: string;
}

/** The injected object. Only the methods the shell registers are listed. */
interface MindForgeNativeBridge {
  openDocument(filterSpecsJson: string): Promise<string>;
  saveDocument(payloadJson: string): Promise<string>;
  readFile(uri: string): Promise<string>;
  writeFile(payloadJson: string): Promise<string>;
  persistUri(uri: string): Promise<string>;
  activateUri(uri: string): Promise<string>;
  readAppData(key: string): Promise<string>;
  writeAppData(payloadJson: string): Promise<string>;
  deleteAppData(key: string): Promise<string>;
  openExternal(url: string): Promise<string>;
  diagnostics(pageFactsJson: string): Promise<string>;
  log(tag: string, payload: string): void;
}

declare global {
  interface Window {
    MindForgeNative?: MindForgeNativeBridge;
  }
}

/** True when running inside the HarmonyOS shell. Cheap; safe to call anywhere. */
export function isOhos(): boolean {
  return typeof window !== 'undefined' && typeof window.MindForgeNative === 'object';
}

function bridge(): MindForgeNativeBridge {
  const native = typeof window === 'undefined' ? undefined : window.MindForgeNative;
  if (!native) {
    throw new Error('Not running inside the MindForge HarmonyOS shell');
  }
  return native;
}

/** Unwraps a bridge envelope, turning a shell-side failure into a thrown Error. */
async function call(promise: Promise<string>, what: string): Promise<string> {
  const raw = await promise;
  let envelope: BridgeEnvelope;
  try {
    envelope = JSON.parse(raw) as BridgeEnvelope;
  } catch {
    throw new Error(`${what}: unreadable bridge response`);
  }
  if (!envelope.ok) {
    throw new Error(`${what}: ${envelope.error}`);
  }
  return envelope.value;
}

/** Silent best-effort logging into hilog; never throws into the caller. */
export function ohosLog(tag: string, payload: string): void {
  if (!isOhos()) return;
  try {
    window.MindForgeNative?.log(tag, payload);
  } catch {
    // Logging must never be able to break the editor.
  }
}

// ── documents ────────────────────────────────────────────────────────────────

/** Opens the system picker. Returns `null` when the user cancels. */
export async function ohosOpenDocument(
  filters: Array<{ name: string; extensions: string[] }>,
): Promise<OhosDocRef | null> {
  const value = await call(bridge().openDocument(JSON.stringify(filters)), 'openDocument');
  return value.length === 0 ? null : (JSON.parse(value) as OhosDocRef);
}

/** Shows the system save dialog. Returns `null` when the user cancels. */
export async function ohosSaveDocument(
  suggestedName: string,
  filters: Array<{ name: string; extensions: string[] }>,
): Promise<OhosDocRef | null> {
  const payload = JSON.stringify({ suggestedName, filterSpecs: JSON.stringify(filters) });
  const value = await call(bridge().saveDocument(payload), 'saveDocument');
  return value.length === 0 ? null : (JSON.parse(value) as OhosDocRef);
}

export async function ohosReadFile(uri: string): Promise<Uint8Array> {
  return fromBase64(await call(bridge().readFile(uri), 'readFile'));
}

export async function ohosWriteFile(uri: string, bytes: Uint8Array): Promise<void> {
  const payload = JSON.stringify({ uri, base64: toBase64(bytes) });
  await call(bridge().writeFile(payload), 'writeFile');
}

// ── permission lifetime ──────────────────────────────────────────────────────

/** Asks the system to remember the grant. Must run while the grant is live. */
export async function persistUri(uri: string): Promise<void> {
  await call(bridge().persistUri(uri), 'persistUri');
}

/**
 * Best-effort grant persistence, for the moment right after a pick.
 *
 * A refusal is not fatal — the file stays readable for this session, it just
 * will not be reopenable later, which is the state {@link getPersistCapability}
 * reports and the sidebar already reflects. Callers therefore do not branch on
 * the outcome, only on the capability.
 */
export async function rememberGrant(uri: string): Promise<void> {
  try {
    await persistUri(uri);
  } catch {
    // Device declined — commonly error 801 on phones.
  }
}

/** Re-establishes a persisted grant. Required before reopening a recent file. */
export async function activateUri(uri: string): Promise<void> {
  await call(bridge().activateUri(uri), 'activateUri');
}

// ── app-private storage ──────────────────────────────────────────────────────

export async function ohosReadAppData(key: string): Promise<string | null> {
  const value = await call(bridge().readAppData(key), 'readAppData');
  return value.length === 0 ? null : value;
}

export async function ohosWriteAppData(key: string, value: string): Promise<void> {
  await call(bridge().writeAppData(JSON.stringify({ key, value })), 'writeAppData');
}

export async function ohosDeleteAppData(key: string): Promise<void> {
  await call(bridge().deleteAppData(key), 'deleteAppData');
}

// ── misc ─────────────────────────────────────────────────────────────────────

export async function ohosOpenExternal(url: string): Promise<void> {
  await call(bridge().openExternal(url), 'openExternal');
}

// ── paths ────────────────────────────────────────────────────────────────────

/**
 * Turns a urified path into one the shared helpers can read a name out of.
 *
 * The editor keys everything off `session.path` and derives the title and the
 * format from it by string surgery (`titleFromPath`, `formatIdFromPath`). A
 * picker URI is close enough for that to work, but it carries a scheme, an
 * optional query, and percent-encoding, none of which belong in a window title.
 * Decoding is best-effort: `decodeURIComponent` throws on a lone `%`, and a
 * literal `%` in a filename is legal, so a failure here falls back to the raw
 * text rather than propagating.
 */
export function ohosDisplayPath(uri: string): string {
  let path = uri;
  const query = path.search(/[?#]/);
  if (query >= 0) path = path.substring(0, query);
  // `file://docs/storage/...` → `docs/storage/...`. Only the display form is
  // stripped; the stored reference keeps its scheme, because that is what the
  // shell's file APIs take.
  path = path.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '');
  try {
    return decodeURIComponent(path);
  } catch {
    return path;
  }
}

/**
 * Shell-aware form of {@link ohosDisplayPath}, for the places that render a
 * stored reference to the user — tab labels, window caption, the recent list.
 * A no-op on every other shell, so callers do not have to branch.
 */
export function shellDisplayPath(path: string): string {
  return isOhos() ? ohosDisplayPath(path) : path;
}

// ── capability probing ───────────────────────────────────────────────────────

/**
 * Whether this device lets the app keep access to a picked file.
 *
 * Answered from the shell's cached view of the device (it probes the
 * `FolderAuthorization` syscap and the install-time `FILE_ACCESS_PERSIST`
 * grant). Used to decide whether "recent files" can be genuinely reopened, or
 * whether the UI should offer import/export instead — the phone-vs-PC fork in
 * the document model.
 *
 * Exposed as a subscribable value rather than a plain promise because the
 * answer decides whether the sidebar offers "reopen recent", which is render
 * state. It resolves `false` until the probe lands, so a device that turns out
 * not to support it never briefly offers something that cannot work.
 */
let persistCapability = false;
const persistListeners = new Set<() => void>();

export function subscribePersistCapability(listener: () => void): () => void {
  persistListeners.add(listener);
  return () => {
    persistListeners.delete(listener);
  };
}

/** Current answer for `useSyncExternalStore`. False until the probe resolves. */
export function getPersistCapability(): boolean {
  return persistCapability;
}

let persistProbe: Promise<boolean> | null = null;

/** Probes once per launch. Safe to call repeatedly. */
export function probePersistCapability(): Promise<boolean> {
  if (!persistProbe) {
    persistProbe = runPersistProbe();
  }
  return persistProbe;
}

async function runPersistProbe(): Promise<boolean> {
  if (!isOhos()) return false;
  let supported = false;
  try {
    const facts = JSON.parse(await shellFacts({ probe: 'persistCapability' })) as {
      persistSyscap: boolean;
      persistPermissionGranted: boolean;
    };
    supported = facts.persistSyscap && facts.persistPermissionGranted;
  } catch {
    // A shell that cannot answer is a shell whose grants must not be relied on.
    supported = false;
  }
  persistCapability = supported;
  for (const listener of persistListeners) listener();
  return supported;
}

/**
 * Shell-side facts, as JSON. The shell also folds in the page facts it is given
 * here and writes the merged report to hilog, so calling this is what produces
 * the log line a device run is inspected through.
 *
 * Page-side collection lives in `ohosDiagnostics.ts`; this is only the wire.
 */
export async function shellFacts(pageFacts: Record<string, unknown>): Promise<string> {
  return call(bridge().diagnostics(JSON.stringify(pageFacts)), 'diagnostics');
}
