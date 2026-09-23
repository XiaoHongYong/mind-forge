import { common } from '@kit.AbilityKit';
import { fileIo as fs, fileUri, fileShare, picker } from '@kit.CoreFileKit';
import { BusinessError } from '@kit.BasicServicesKit';
import { hilog } from '@kit.PerformanceAnalysisKit';
import { util } from '@kit.ArkTS';
import { DocRef, LOG_DOMAIN } from './Protocol';

const TAG: string = 'MindForge.DocumentStore';

/** `fileShare` reports an unsupported device as error 801, not a permission denial. */
const ERR_CAPABILITY_UNSUPPORTED: number = 801;

const SYS_CAP_PERSIST: string = 'SystemCapability.FileManagement.AppFileService.FolderAuthorization';

/** A filter option as the frontend already expresses it for the desktop dialogs. */
interface FilterSpec {
  name: string;
  extensions: Array<string>;
}

/** Result of a persist/activate attempt, shaped for the diagnostics screen. */
export interface PermissionOutcome {
  /** Whether the device advertises the capability at all. */
  supported: boolean;
  /** Whether the call itself succeeded. */
  ok: boolean;
  error: string;
}

/**
 * User-file access for the HarmonyOS shell.
 *
 * ## The one thing that differs from the desktop model
 *
 * On desktop the shell can read and write any absolute path the user picked,
 * forever. HarmonyOS runs the app in a sandbox: the picker hands back a `file://`
 * URI carrying a *temporary* grant that the system revokes when the app exits or
 * the device restarts.
 *
 * To reopen a file across sessions the frontend is expected to call
 * {@link persist} right after picking, and {@link activate} before reading a URI
 * from the recent-files list. On 2-in-1 (PC) devices that works. On phones it
 * historically does not — `fileShare` answers 801. That is not a bug to work
 * around here: it is a product-level fork in the document model, which is what
 * the diagnostics screen exists to measure. See `ohos/README.md`.
 */
export class DocumentStore {
  private context: common.UIAbilityContext;

  constructor(context: common.UIAbilityContext) {
    this.context = context;
  }

  /** Opens the picker. Returns `undefined` when the user cancels. */
  async pickOpen(filterSpecsJson: string): Promise<DocRef | undefined> {
    const options: picker.DocumentSelectOptions = {
      maxSelectNumber: 1,
      fileSuffixFilters: DocumentStore.toSuffixFilters(filterSpecsJson)
    };
    const viewPicker = new picker.DocumentViewPicker(this.context);
    const selected: Array<string> = await viewPicker.select(options);
    if (selected.length === 0) {
      return undefined;
    }
    return DocumentStore.toDocRef(selected[0]);
  }

  /** Shows the save dialog. Returns `undefined` when the user cancels. */
  async pickSave(suggestedName: string, filterSpecsJson: string): Promise<DocRef | undefined> {
    const options: picker.DocumentSaveOptions = {
      newFileNames: [suggestedName],
      fileSuffixChoices: DocumentStore.toSuffixFilters(filterSpecsJson)
    };
    const viewPicker = new picker.DocumentViewPicker(this.context);
    const selected: Array<string> = await viewPicker.save(options);
    if (selected.length === 0) {
      return undefined;
    }
    return DocumentStore.toDocRef(selected[0]);
  }

  /** Reads a document as base64 — the bridge only carries strings. */
  read(uri: string): string {
    const file = fs.openSync(uri, fs.OpenMode.READ_ONLY);
    try {
      const size: number = fs.statSync(file.fd).size;
      if (size === 0) {
        return '';
      }
      const buffer: ArrayBuffer = new ArrayBuffer(size);
      const read: number = fs.readSync(file.fd, buffer);
      const bytes: Uint8Array = new Uint8Array(buffer, 0, read);
      return new util.Base64Helper().encodeToStringSync(bytes);
    } finally {
      fs.closeSync(file);
    }
  }

  /** Overwrites a document with base64-encoded bytes. */
  write(uri: string, base64: string): void {
    const bytes: Uint8Array = new util.Base64Helper().decodeSync(base64);
    const file = fs.openSync(uri, fs.OpenMode.READ_WRITE | fs.OpenMode.TRUNC);
    try {
      // `writeSync` takes an ArrayBuffer for binary payloads; the Uint8Array's
      // own buffer may be larger than the decoded data, so copy the exact range.
      const buffer: ArrayBuffer = new ArrayBuffer(bytes.byteLength);
      new Uint8Array(buffer).set(bytes);
      fs.writeSync(file.fd, buffer);
      fs.fsyncSync(file.fd);
    } finally {
      fs.closeSync(file);
    }
  }

  /**
   * Asks the system to keep the temporary grant on `uri` across restarts.
   * Must be called while the picker's grant is still live.
   */
  async persist(uri: string): Promise<PermissionOutcome> {
    return this.applyPermission(uri, true);
  }

  /** Re-establishes a persisted grant, e.g. when reopening a recent file. */
  async activate(uri: string): Promise<PermissionOutcome> {
    return this.applyPermission(uri, false);
  }

  /** Whether this device advertises the persist-capable syscap. */
  canPersist(): boolean {
    return canIUse(SYS_CAP_PERSIST);
  }

  // ── internals ──────────────────────────────────────────────────────────────

  private async applyPermission(uri: string, persist: boolean): Promise<PermissionOutcome> {
    const supported: boolean = this.canPersist();
    if (!supported) {
      return { supported: false, ok: false, error: `${SYS_CAP_PERSIST} not advertised` };
    }
    const policy: fileShare.PolicyInfo = {
      uri: uri,
      operationMode: fileShare.OperationMode.READ_MODE | fileShare.OperationMode.WRITE_MODE
    };
    try {
      if (persist) {
        await fileShare.persistPermission([policy]);
      } else {
        await fileShare.activatePermission([policy]);
      }
      return { supported: true, ok: true, error: '' };
    } catch (err) {
      const e = err as BusinessError;
      // 801 is the signal that matters: the syscap is advertised but this device
      // (a phone, typically) still refuses. Reported distinctly so the
      // diagnostics screen can tell "unsupported" from "denied".
      const unsupported: boolean = e.code === ERR_CAPABILITY_UNSUPPORTED;
      hilog.warn(LOG_DOMAIN, TAG, '%{public}s failed: code=%{public}d %{public}s',
        persist ? 'persistPermission' : 'activatePermission', e.code, e.message);
      return {
        supported: !unsupported,
        ok: false,
        error: `${e.code}: ${e.message}`
      };
    }
  }

  private static toDocRef(uri: string): DocRef {
    let name: string = uri;
    try {
      name = new fileUri.FileUri(uri).name;
    } catch (err) {
      hilog.warn(LOG_DOMAIN, TAG, 'cannot derive display name from uri');
    }
    return { uri: uri, name: name };
  }

  /**
   * Converts the frontend's filter shape into the picker's, which packs the
   * description and the suffixes into one `"Description|.a,.b"` string.
   */
  private static toSuffixFilters(filterSpecsJson: string): Array<string> {
    const out: Array<string> = [];
    try {
      const specs = JSON.parse(filterSpecsJson) as Array<FilterSpec>;
      for (const spec of specs) {
        const suffixes: Array<string> = [];
        for (const ext of spec.extensions) {
          suffixes.push(ext.startsWith('.') ? ext : `.${ext}`);
        }
        if (suffixes.length > 0) {
          out.push(`${spec.name}|${suffixes.join(',')}`);
        }
      }
    } catch (err) {
      hilog.warn(LOG_DOMAIN, TAG, 'unreadable filter spec; falling back to no filter');
    }
    return out;
  }
}
