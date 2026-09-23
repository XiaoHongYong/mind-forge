import { abilityAccessCtrl, bundleManager, Permissions } from '@kit.AbilityKit';
import { BusinessError } from '@kit.BasicServicesKit';
import { hilog } from '@kit.PerformanceAnalysisKit';
import { AppDataStore } from './AppDataStore';
import { AssetServer, MissRecord } from './AssetServer';
import { DocumentStore } from './DocumentStore';
import { LOG_DOMAIN, VIRTUAL_ORIGIN } from './Protocol';

const TAG: string = 'MindForge.Diagnostics';
const PERSIST_PERMISSION: Permissions = 'ohos.permission.FILE_ACCESS_PERSIST';

/** Shell-side facts, serialised to the page and logged for `hdc hilog`. */
interface ShellFacts {
  platform: string;
  bundleName: string;
  versionName: string;
  virtualOrigin: string;
  cachedFileCount: number;
  cachedBytes: number;
  assetLoadError: string;
  missCount: number;
  misses: Array<MissRecord>;
  appDataDir: string;
  appDataSlotCount: number;
  persistSyscap: boolean;
  persistPermissionGranted: boolean;
}

/**
 * Collects the facts that decide whether this shell actually works.
 *
 * The interesting questions cannot all be answered from one side of the bridge:
 * ArkTS knows about bundle loading, syscaps and the permission model, while the
 * page knows about secure contexts and `localStorage`. This class answers the
 * ArkTS half; `frontend_app/src/platform/ohosDiagnostics.ts` answers the other
 * and merges the two. See `ohos/README.md` for what each field is for.
 */
export class Diagnostics {
  private assets: AssetServer;
  private documents: DocumentStore;
  private appData: AppDataStore;

  constructor(assets: AssetServer, documents: DocumentStore, appData: AppDataStore) {
    this.assets = assets;
    this.documents = documents;
    this.appData = appData;
  }

  /** Logs the full report at a grep-able tag. Called at page load and on demand. */
  emit(pageFactsJson: string): void {
    const report: string = JSON.stringify({
      shell: this.collect(),
      page: pageFactsJson
    });
    hilog.info(LOG_DOMAIN, TAG, 'REPORT %{public}s', report);
  }

  getShellFactsJson(): string {
    return JSON.stringify(this.collect());
  }

  private collect(): ShellFacts {
    return {
      platform: 'ohos',
      bundleName: this.bundleName(),
      versionName: this.versionName(),
      virtualOrigin: VIRTUAL_ORIGIN,
      cachedFileCount: this.assets.getFileCount(),
      cachedBytes: this.assets.getTotalBytes(),
      assetLoadError: this.assets.getLoadError(),
      missCount: this.assets.getMisses().length,
      misses: this.assets.getMisses(),
      appDataDir: this.appData.getDir(),
      appDataSlotCount: this.appData.listSlotFiles().length,
      persistSyscap: this.documents.canPersist(),
      persistPermissionGranted: this.isPersistPermissionGranted()
    };
  }

  private bundleInfo(): bundleManager.BundleInfo | undefined {
    try {
      return bundleManager.getBundleInfoForSelfSync(
        bundleManager.BundleFlag.GET_BUNDLE_INFO_WITH_APPLICATION
      );
    } catch (err) {
      const e = err as BusinessError;
      hilog.warn(LOG_DOMAIN, TAG, 'bundle info unavailable: %{public}s', JSON.stringify(e));
      return undefined;
    }
  }

  private bundleName(): string {
    const info: bundleManager.BundleInfo | undefined = this.bundleInfo();
    return info === undefined ? 'unknown' : info.name;
  }

  private versionName(): string {
    const info: bundleManager.BundleInfo | undefined = this.bundleInfo();
    return info === undefined ? 'unknown' : info.versionName;
  }

  /**
   * Whether the install-time `FILE_ACCESS_PERSIST` request was actually granted.
   * Distinguishes "we forgot to declare it" from "the device says no".
   */
  private isPersistPermissionGranted(): boolean {
    const info: bundleManager.BundleInfo | undefined = this.bundleInfo();
    if (info === undefined || info.appInfo === undefined) {
      return false;
    }
    try {
      const status: abilityAccessCtrl.GrantStatus = abilityAccessCtrl
        .createAtManager()
        .checkAccessTokenSync(info.appInfo.accessTokenId, PERSIST_PERMISSION);
      return status === abilityAccessCtrl.GrantStatus.PERMISSION_GRANTED;
    } catch (err) {
      const e = err as BusinessError;
      hilog.warn(LOG_DOMAIN, TAG, 'checkAccessToken failed: %{public}s', JSON.stringify(e));
      return false;
    }
  }
}
