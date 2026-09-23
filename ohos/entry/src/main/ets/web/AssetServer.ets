import { resourceManager } from '@kit.LocalizationKit';
import { BusinessError } from '@kit.BasicServicesKit';
import { hilog } from '@kit.PerformanceAnalysisKit';
import { ASSET_ROOT, LOG_DOMAIN, VIRTUAL_ORIGIN, mimeFor } from './Protocol';

const TAG: string = 'MindForge.AssetServer';

/** A bundled file held in memory, ready to answer a request with zero I/O. */
interface Asset {
  data: ArrayBuffer;
  mime: string;
}

/** Something the shell could not serve, kept for the diagnostics screen. */
export interface MissRecord {
  url: string;
  reason: string;
}

/**
 * Serves the built frontend out of `resources/rawfile/www` under
 * {@link VIRTUAL_ORIGIN}.
 *
 * `onInterceptRequest` is a *synchronous* callback — ArkWeb will not wait for a
 * promise — so every asset is read once at startup into {@link assets} and the
 * handler is a pure map lookup. The bundle is ~1.5 MB, which is why this is
 * affordable.
 */
export class AssetServer {
  private assets: Map<string, Asset> = new Map<string, Asset>();
  private misses: Array<MissRecord> = [];
  private fileCount: number = 0;
  private totalBytes: number = 0;
  private loadError: string = '';

  /** Reads the whole bundle. Call once, before the Web component loads a URL. */
  load(rm: resourceManager.ResourceManager): void {
    this.assets.clear();
    this.fileCount = 0;
    this.totalBytes = 0;
    this.loadError = '';
    this.walk(rm, ASSET_ROOT);
    if (this.fileCount === 0) {
      this.loadError = `no files under rawfile/${ASSET_ROOT} — run \`pnpm build:ohos\` to sync the frontend`;
      hilog.error(LOG_DOMAIN, TAG, '%{public}s', this.loadError);
    } else {
      hilog.info(LOG_DOMAIN, TAG, 'serving %{public}d files (%{public}d bytes) from %{public}s',
        this.fileCount, this.totalBytes, VIRTUAL_ORIGIN);
    }
  }

  getFileCount(): number {
    return this.fileCount;
  }

  getTotalBytes(): number {
    return this.totalBytes;
  }

  getLoadError(): string {
    return this.loadError;
  }

  getMisses(): Array<MissRecord> {
    return this.misses;
  }

  /**
   * Builds the response for a request.
   *
   * This never returns "not intercepted". ArkWeb's callback type is a plain
   * `WebResourceResponse`, and for a local-only app that is the right shape
   * anyway: a request that is not ours gets an explicit refusal rather than
   * being handed to the network stack. ArkWeb only routes `http`/`https` (and
   * schemes opted into via `customizeSchemes`) through here, so `blob:` and
   * `data:` URLs — which the editor uses for attachment previews and downloads —
   * are untouched.
   */
  handle(event: OnInterceptRequestEvent): WebResourceResponse {
    const url: string = event.request.getRequestUrl();
    if (!url.startsWith(VIRTUAL_ORIGIN)) {
      this.recordMiss(url, 'outside virtual origin; refused');
      return this.refused(url);
    }

    const path: string = this.pathOf(url);
    const asset: Asset | undefined = this.lookup(path);
    if (asset === undefined) {
      this.recordMiss(url, `no bundled asset for ${path}`);
      return this.notFound(path);
    }
    return this.respond(asset);
  }

  // ── internals ──────────────────────────────────────────────────────────────

  private lookup(path: string): Asset | undefined {
    const direct: Asset | undefined = this.assets.get(path);
    if (direct !== undefined) {
      return direct;
    }
    // Deep link / directory request: hand back the SPA shell so client-side
    // routing can take over. Only for extension-less paths — a missing `.js`
    // must stay a hard 404 instead of silently becoming HTML.
    const lastSegment: string = path.substring(path.lastIndexOf('/') + 1);
    if (lastSegment.indexOf('.') < 0) {
      return this.assets.get('/index.html');
    }
    return undefined;
  }

  private respond(asset: Asset): WebResourceResponse {
    const response: WebResourceResponse = new WebResourceResponse();
    response.setResponseCode(200);
    response.setReasonMessage('OK');
    response.setResponseMimeType(asset.mime);
    response.setResponseEncoding('utf-8');
    response.setResponseData(asset.data);
    // `crossorigin` is set on the bundle's script/link tags by Vite. Same-origin
    // requests do not need CORS, but the header costs nothing and removes a
    // whole class of "why is this blank" debugging.
    const headers: Array<Header> = [
      { headerKey: 'Access-Control-Allow-Origin', headerValue: '*' },
      { headerKey: 'Cache-Control', headerValue: 'no-store' }
    ];
    response.setResponseHeader(headers);
    return response;
  }

  private notFound(path: string): WebResourceResponse {
    return this.textResponse(404, 'Not Found', `not bundled: ${path}`);
  }

  /** Answer for a request aimed at a host this app has no business reaching. */
  private refused(url: string): WebResourceResponse {
    return this.textResponse(
      403,
      'Forbidden',
      `MindForge is local-only and does not serve ${url}`
    );
  }

  private textResponse(code: number, reason: string, body: string): WebResourceResponse {
    const response: WebResourceResponse = new WebResourceResponse();
    response.setResponseCode(code);
    response.setReasonMessage(reason);
    response.setResponseMimeType('text/plain');
    response.setResponseEncoding('utf-8');
    response.setResponseData(body);
    return response;
  }

  private recordMiss(url: string, reason: string): void {
    hilog.warn(LOG_DOMAIN, TAG, 'miss: %{public}s (%{public}s)', url, reason);
    // Bounded: a runaway page must not grow this without limit.
    if (this.misses.length < 100) {
      this.misses.push({ url: url, reason: reason });
    }
  }

  /** `/a/b.js?x=1#y` → `/a/b.js`, with the origin stripped. */
  private pathOf(url: string): string {
    let path: string = url;
    const schemeEnd: number = path.indexOf('://');
    if (schemeEnd >= 0) {
      const slash: number = path.indexOf('/', schemeEnd + 3);
      path = slash >= 0 ? path.substring(slash) : '/';
    }
    const query: number = path.indexOf('?');
    if (query >= 0) {
      path = path.substring(0, query);
    }
    const hash: number = path.indexOf('#');
    if (hash >= 0) {
      path = path.substring(0, hash);
    }
    return path.length === 0 ? '/' : path;
  }

  /**
   * Recursively reads `relDir`, storing each file under its URL path.
   *
   * `getRawFileListSync` is used defensively: whether it recurses on its own and
   * whether it returns bare names or directory-relative paths has varied across
   * releases. Each entry is therefore probed — if it reads as a file it is
   * stored, otherwise it is descended into as a directory.
   */
  private walk(rm: resourceManager.ResourceManager, relDir: string): void {
    let entries: Array<string> = [];
    try {
      entries = rm.getRawFileListSync(relDir);
    } catch (err) {
      const e = err as BusinessError;
      hilog.warn(LOG_DOMAIN, TAG, 'cannot list %{public}s: %{public}s', relDir, JSON.stringify(e));
      return;
    }

    for (const entry of entries) {
      const rel: string = entry.indexOf('/') >= 0 ? entry : `${relDir}/${entry}`;

      let bytes: Uint8Array | undefined = undefined;
      try {
        bytes = rm.getRawFileContentSync(rel);
      } catch (err) {
        bytes = undefined;
      }

      if (bytes !== undefined) {
        this.store(rel, bytes);
      } else {
        this.walk(rm, rel);
      }
    }
  }

  private store(rawPath: string, bytes: Uint8Array): void {
    const prefix: string = `${ASSET_ROOT}/`;
    const urlPath: string = '/' + (rawPath.startsWith(prefix) ? rawPath.substring(prefix.length) : rawPath);

    // Copy into a standalone buffer: `getRawFileContentSync` may hand back a
    // view over a larger allocation, and `setResponseData` needs one that owns
    // exactly the file's bytes.
    const copy: ArrayBuffer = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(copy).set(bytes);

    this.assets.set(urlPath, { data: copy, mime: mimeFor(urlPath) });
    this.fileCount++;
    this.totalBytes += bytes.byteLength;
  }
}
