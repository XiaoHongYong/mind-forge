import { fileIo as fs } from '@kit.CoreFileKit';
import { BusinessError } from '@kit.BasicServicesKit';
import { hilog } from '@kit.PerformanceAnalysisKit';
import { LOG_DOMAIN } from './Protocol';

const TAG: string = 'MindForge.AppDataStore';

/** On-disk envelope. `key` is stored so a hash collision cannot be read as a hit. */
interface SlotFile {
  key: string;
  value: string;
}

/**
 * App-private key/value slots, the HarmonyOS counterpart of the desktop shell's
 * `write_app_data_slot` / `read_app_data_slot` commands.
 *
 * Backs two things in the frontend: the open-tabs workspace snapshot and the
 * unsaved-document backups (`frontend_app/src/document/unsavedBackup.ts`). Both
 * already fall back to `localStorage`, but `localStorage` is evictable, so the
 * sandbox copy is what actually makes crash recovery reliable.
 *
 * Values live in `filesDir/appdata`, which the system removes on uninstall — no
 * data outlives the app, and nothing leaves the device.
 */
export class AppDataStore {
  private dir: string;

  constructor(filesDir: string) {
    this.dir = `${filesDir}/appdata`;
    this.ensureDir();
  }

  getDir(): string {
    return this.dir;
  }

  /** Returns the stored payload, or `undefined` when the slot is absent. */
  read(key: string): string | undefined {
    const path: string = this.pathFor(key);
    if (!this.exists(path)) {
      return undefined;
    }
    try {
      const slot = JSON.parse(fs.readTextSync(path)) as SlotFile;
      if (slot.key !== key) {
        hilog.warn(LOG_DOMAIN, TAG, 'slot hash collision for %{public}s', key);
        return undefined;
      }
      return slot.value;
    } catch (err) {
      const e = err as BusinessError;
      hilog.error(LOG_DOMAIN, TAG, 'read %{public}s failed: %{public}s', key, JSON.stringify(e));
      return undefined;
    }
  }

  /**
   * Writes via a staging file so a kill mid-write leaves the previous slot
   * intact. A plain truncate-and-write would leave a half-written JSON document
   * behind in exactly the crash case this store exists to survive.
   */
  write(key: string, value: string): void {
    const target: string = this.pathFor(key);
    const staging: string = `${target}.tmp`;
    const slot: SlotFile = { key: key, value: value };

    AppDataStore.writeText(staging, JSON.stringify(slot));
    AppDataStore.deleteFile(target);
    fs.renameSync(staging, target);
  }

  remove(key: string): void {
    AppDataStore.deleteFile(this.pathFor(key));
  }

  /** Slot filenames currently on disk — used by the diagnostics screen. */
  listSlotFiles(): Array<string> {
    try {
      return fs.listFileSync(this.dir);
    } catch (err) {
      const e = err as BusinessError;
      hilog.warn(LOG_DOMAIN, TAG, 'list failed: %{public}s', JSON.stringify(e));
      return [];
    }
  }

  // ── internals ──────────────────────────────────────────────────────────────

  private ensureDir(): void {
    if (this.exists(this.dir)) {
      return;
    }
    try {
      fs.mkdirSync(this.dir, true);
    } catch (err) {
      const e = err as BusinessError;
      hilog.error(LOG_DOMAIN, TAG, 'mkdir %{public}s failed: %{public}s', this.dir, JSON.stringify(e));
    }
  }

  private exists(path: string): boolean {
    try {
      return fs.accessSync(path);
    } catch (err) {
      return false;
    }
  }

  /** `fs` has no text helper, so the open/write/close dance is spelled out. */
  private static writeText(path: string, text: string): void {
    const file = fs.openSync(path, fs.OpenMode.READ_WRITE | fs.OpenMode.CREATE | fs.OpenMode.TRUNC);
    try {
      fs.writeSync(file.fd, text);
    } finally {
      fs.closeSync(file);
    }
  }

  private static deleteFile(path: string): void {
    if (!AppDataStore.fileExists(path)) {
      return;
    }
    try {
      fs.unlinkSync(path);
    } catch (err) {
      const e = err as BusinessError;
      hilog.warn(LOG_DOMAIN, TAG, 'unlink %{public}s failed: %{public}s', path, JSON.stringify(e));
    }
  }

  private static fileExists(path: string): boolean {
    try {
      return fs.accessSync(path);
    } catch (err) {
      return false;
    }
  }

  /**
   * Slot keys are arbitrary strings (the frontend builds them from document
   * URIs), so they are hashed rather than used as filenames. A length suffix
   * separates inputs that could otherwise hash alike, and the stored `key`
   * field settles the rest.
   */
  private pathFor(key: string): string {
    return `${this.dir}/${AppDataStore.hash(key)}-${key.length}.json`;
  }

  /** FNV-1a, 32-bit — plenty for a handful of slots and cheap to compute. */
  private static hash(value: string): string {
    let h: number = 0x811c9dc5;
    for (let i = 0; i < value.length; i++) {
      h = h ^ value.charCodeAt(i);
      // `Math.imul` keeps the multiply in 32-bit range without bigint.
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h.toString(16).padStart(8, '0');
  }
}
