import { common } from '@kit.AbilityKit';
import { BusinessError } from '@kit.BasicServicesKit';
import { hilog } from '@kit.PerformanceAnalysisKit';
import { AppDataStore } from './AppDataStore';
import { Diagnostics } from './Diagnostics';
import { DocumentStore, PermissionOutcome } from './DocumentStore';
import { BridgeResult, DocRef, LOG_DOMAIN, encodeResult, fail, ok } from './Protocol';

const TAG: string = 'MindForge.Bridge';

/** `{ uri, name }` from the page, for calls that carry a pair. */
interface DocPayload {
  uri: string;
  name: string;
}

/** `{ key, value }` from the page, for app-data writes. */
interface SlotPayload {
  key: string;
  value: string;
}

/**
 * The object injected into the page as `window.MindForgeNative`.
 *
 * Every method returns a JSON-encoded {@link BridgeResult} rather than throwing:
 * an exception crossing the JS/ArkTS boundary surfaces in the page as an opaque
 * string, which makes the call sites in `frontend_app/src/platform/ohos.ts`
 * guesswork. Wrapping keeps failures typed all the way up.
 *
 * Methods that need I/O are listed in `asyncMethodList` on the Web component
 * (see `pages/Index.ets`) so the page can `await` them directly.
 *
 * NOTE: BRIDGE_OBJECT_NAME and every method name here must also appear in
 * `entry/obfuscation-rules.txt` `-keep-property-name`, or a release build will
 * rename them and the injected object will lose those members.
 */
export class NativeBridge {
  private context: common.UIAbilityContext;
  private documents: DocumentStore;
  private appData: AppDataStore;
  // Named `reporter`, not `diagnostics`: ArkTS rejects a field and a method
  // sharing an identifier, and the method name is fixed by the JS contract.
  private reporter: Diagnostics;

  constructor(
    context: common.UIAbilityContext,
    documents: DocumentStore,
    appData: AppDataStore,
    diagnostics: Diagnostics
  ) {
    this.context = context;
    this.documents = documents;
    this.appData = appData;
    this.reporter = diagnostics;
  }

  // ── documents ──────────────────────────────────────────────────────────────

  /** `filterSpecsJson` is `[{ name, extensions[] }]`, the same shape the desktop dialogs take. */
  async openDocument(filterSpecsJson: string): Promise<string> {
    try {
      const ref: DocRef | undefined = await this.documents.pickOpen(filterSpecsJson);
      return ref === undefined ? encodeResult(ok('')) : encodeResult(ok(JSON.stringify(ref)));
    } catch (err) {
      return encodeResult(fail(NativeBridge.describe(err, 'openDocument')));
    }
  }

  /**
   * `payloadJson` is `{ uri?, suggestedName, filterSpecs }`. A `uri` is only a
   * hint for the dialog's starting location; the picker always returns the URI
   * the user actually chose.
   */
  async saveDocument(payloadJson: string): Promise<string> {
    try {
      const payload = JSON.parse(payloadJson) as Record<string, string>;
      const name: string = payload.suggestedName ?? 'Untitled.mmforge';
      const filters: string = payload.filterSpecs ?? '[]';
      const ref: DocRef | undefined = await this.documents.pickSave(name, filters);
      return ref === undefined ? encodeResult(ok('')) : encodeResult(ok(JSON.stringify(ref)));
    } catch (err) {
      return encodeResult(fail(NativeBridge.describe(err, 'saveDocument')));
    }
  }

  /** Returns base64. An empty string is a legitimately empty document. */
  async readFile(uri: string): Promise<string> {
    try {
      return encodeResult(ok(this.documents.read(uri)));
    } catch (err) {
      return encodeResult(fail(NativeBridge.describe(err, 'readFile')));
    }
  }

  async writeFile(payloadJson: string): Promise<string> {
    try {
      const payload = JSON.parse(payloadJson) as Record<string, string>;
      const uri: string = payload.uri ?? '';
      if (uri.length === 0) {
        return encodeResult(fail('writeFile: empty uri'));
      }
      this.documents.write(uri, payload.base64 ?? '');
      return encodeResult(ok(''));
    } catch (err) {
      return encodeResult(fail(NativeBridge.describe(err, 'writeFile')));
    }
  }

  // ── permission lifetime ────────────────────────────────────────────────────

  /**
   * Asks the system to remember the grant on `uri`. Must be called immediately
   * after picking, while the temporary grant is still valid.
   */
  async persistUri(uri: string): Promise<string> {
    const outcome: PermissionOutcome = await this.documents.persist(uri);
    return encodeResult(outcome.ok ? ok('') : fail(outcome.error));
  }

  /** Re-establishes a persisted grant before reading a recent file. */
  async activateUri(uri: string): Promise<string> {
    const outcome: PermissionOutcome = await this.documents.activate(uri);
    return encodeResult(outcome.ok ? ok('') : fail(outcome.error));
  }

  // ── app-private storage ────────────────────────────────────────────────────

  async readAppData(key: string): Promise<string> {
    try {
      const value: string | undefined = this.appData.read(key);
      return encodeResult(ok(value ?? ''));
    } catch (err) {
      return encodeResult(fail(NativeBridge.describe(err, 'readAppData')));
    }
  }

  async writeAppData(payloadJson: string): Promise<string> {
    try {
      const payload = JSON.parse(payloadJson) as SlotPayload;
      this.appData.write(payload.key, payload.value);
      return encodeResult(ok(''));
    } catch (err) {
      return encodeResult(fail(NativeBridge.describe(err, 'writeAppData')));
    }
  }

  async deleteAppData(key: string): Promise<string> {
    try {
      this.appData.remove(key);
      return encodeResult(ok(''));
    } catch (err) {
      return encodeResult(fail(NativeBridge.describe(err, 'deleteAppData')));
    }
  }

  // ── misc ───────────────────────────────────────────────────────────────────

  /** Opens a link in the system browser. */
  async openExternal(url: string): Promise<string> {
    try {
      await this.context.openLink(url);
      return encodeResult(ok(''));
    } catch (err) {
      return encodeResult(fail(NativeBridge.describe(err, 'openExternal')));
    }
  }

  /**
   * Merges shell facts with page facts and writes them to hilog under
   * `MindForge.Diagnostics`, so a run can be inspected with:
   *
   *   hdc shell hilog | grep MindForge.Diagnostics
   */
  async diagnostics(pageFactsJson: string): Promise<string> {
    try {
      this.reporter.emit(pageFactsJson);
      return encodeResult(ok(this.reporter.getShellFactsJson()));
    } catch (err) {
      return encodeResult(fail(NativeBridge.describe(err, 'diagnostics')));
    }
  }

  /** Sync, fire-and-forget page logging routed into hilog. */
  log(tag: string, payload: string): void {
    hilog.info(LOG_DOMAIN, TAG, '[%{public}s] %{public}s', tag, payload);
  }

  private static describe(err: Object, method: string): string {
    const e = err as BusinessError;
    const message: string = e.message === undefined ? String(err) : e.message;
    hilog.error(LOG_DOMAIN, TAG, '%{public}s failed: %{public}s', method, message);
    return e.code === undefined ? message : `${e.code}: ${message}`;
  }
}

/** Marker the page uses to detect this shell. Mirrors `__TAURI_INTERNALS__`.
 *  Also the javaScriptProxy object name — must stay in `-keep-property-name`. */
export const BRIDGE_OBJECT_NAME: string = 'MindForgeNative';

/** Method names registered with the Web component, split by sync/async.
 *  Each must stay in `-keep-property-name` (same keep list as BRIDGE_OBJECT_NAME). */
export const SYNC_METHODS: Array<string> = ['log'];

export const ASYNC_METHODS: Array<string> = [
  'openDocument',
  'saveDocument',
  'readFile',
  'writeFile',
  'persistUri',
  'activateUri',
  'readAppData',
  'writeAppData',
  'deleteAppData',
  'openExternal',
  'diagnostics'
];
