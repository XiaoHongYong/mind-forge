/**
 * Constants and wire types shared by the HarmonyOS shell.
 *
 * ## Why the web assets are served from a synthetic origin
 *
 * ArkWeb will happily load a bundled page straight from `rawfile`, but two
 * properties of this app make that path unusable on its own:
 *
 *  1. `file://` / `resource://` origins may not fetch sibling resources, so the
 *     ES modules and stylesheets next to `index.html` are blocked as
 *     cross-origin. The page renders blank.
 *  2. `crypto.subtle` is only exposed in a *secure context*. The editor derives
 *     SHA-256 fingerprints of on-disk documents to decide whether an unsaved
 *     backup still matches (`frontend_app/src/document/unsavedBackup.ts`), so
 *     without it the recovery path silently degrades.
 *
 * Answering every request under a real `https://` origin from memory fixes both
 * at once, and costs nothing: {@link AssetServer} holds the whole bundle (about
 * 1.5 MB) in a map, so `onInterceptRequest` can reply synchronously.
 *
 * `mindforge.invalid` is deliberate — `.invalid` is reserved by RFC 2606 and can
 * never resolve, so a request that somehow escapes interception fails loudly
 * instead of quietly reaching a real host. The app does not declare
 * `ohos.permission.INTERNET` for the same reason.
 */
export const VIRTUAL_ORIGIN: string = 'https://mindforge.invalid';

/** Directory under `resources/rawfile/` that the built frontend is synced into. */
export const ASSET_ROOT: string = 'www';

/** hilog domain used by every tag in this module tree. */
export const LOG_DOMAIN: number = 0x0000;

/**
 * A document the app can read and write.
 *
 * `uri` is opaque: the shell hands it back to the picker-facing filesystem APIs
 * verbatim. It is a `file://` URI granting temporary access to a user-chosen
 * file, *not* a sandbox path — see `DocumentStore` for what that implies across
 * restarts.
 */
export interface DocRef {
  uri: string;
  name: string;
}

/** Envelope every bridge method returns, so JS never sees an ArkTS throw. */
export interface BridgeResult {
  ok: boolean;
  /** Human-readable failure reason; empty when `ok` is true. */
  error: string;
  /** Method-specific payload, JSON-encoded. Empty string when absent. */
  value: string;
}

export function ok(value: string): BridgeResult {
  return { ok: true, error: '', value: value };
}

export function fail(error: string): BridgeResult {
  return { ok: false, error: error, value: '' };
}

/** Serialises a {@link BridgeResult}; the only shape the web layer ever parses. */
export function encodeResult(result: BridgeResult): string {
  return JSON.stringify(result);
}

/** Maps a file extension to the MIME type ArkWeb needs to execute it. */
export function mimeFor(path: string): string {
  const dot: number = path.lastIndexOf('.');
  const ext: string = dot < 0 ? '' : path.substring(dot + 1).toLowerCase();
  switch (ext) {
    case 'html':
      return 'text/html';
    case 'js':
    case 'mjs':
      return 'text/javascript';
    case 'css':
      return 'text/css';
    case 'json':
    case 'map':
      return 'application/json';
    case 'svg':
      return 'image/svg+xml';
    case 'png':
      return 'image/png';
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'webp':
      return 'image/webp';
    case 'gif':
      return 'image/gif';
    case 'ico':
      return 'image/x-icon';
    case 'woff':
      return 'font/woff';
    case 'woff2':
      return 'font/woff2';
    case 'ttf':
      return 'font/ttf';
    case 'txt':
      return 'text/plain';
    default:
      // Unknown extensions get an opaque type rather than a guess: a wrong
      // `text/html` would let a stray file be parsed as markup.
      return 'application/octet-stream';
  }
}
