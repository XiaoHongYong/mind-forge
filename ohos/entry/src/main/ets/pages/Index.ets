import { common } from '@kit.AbilityKit';
import { webview } from '@kit.ArkWeb';
import { hilog } from '@kit.PerformanceAnalysisKit';
import { AppDataStore } from '../web/AppDataStore';
import { AssetServer } from '../web/AssetServer';
import { Diagnostics } from '../web/Diagnostics';
import { DocumentStore } from '../web/DocumentStore';
import { ASYNC_METHODS, BRIDGE_OBJECT_NAME, NativeBridge, SYNC_METHODS } from '../web/NativeBridge';
import { LOG_DOMAIN, VIRTUAL_ORIGIN } from '../web/Protocol';

const TAG: string = 'MindForge.Index';

/**
 * Hosts the editor.
 *
 * The Web component is only constructed once the bundled frontend has been read
 * into {@link AssetServer}, because `onInterceptRequest` is synchronous and has
 * nothing to serve until then. If the bundle is missing — the usual cause being
 * a `frontend_app/dist` that was never synced into `rawfile/www` — an explicit
 * message is rendered instead of an empty white rectangle, which is the failure
 * mode this whole shell is arranged to avoid.
 */
@Entry
@Component
struct Index {
  private controller: webview.WebviewController = new webview.WebviewController();
  private assets: AssetServer = new AssetServer();
  private bridge: NativeBridge | undefined = undefined;

  @State private src: string = '';
  @State private loadError: string = '';
  @State private fileCount: number = 0;
  @State private missCount: number = 0;
  @State private lastError: string = '';

  aboutToAppear(): void {
    const context = this.getUIContext().getHostContext() as common.UIAbilityContext;
    this.assets.load(context.resourceManager);

    this.fileCount = this.assets.getFileCount();
    const failure: string = this.assets.getLoadError();
    if (failure.length > 0) {
      this.loadError = failure;
      hilog.error(LOG_DOMAIN, TAG, '%{public}s', failure);
      return;
    }

    const documents = new DocumentStore(context);
    const appData = new AppDataStore(context.filesDir);
    const diagnostics = new Diagnostics(this.assets, documents, appData);
    this.bridge = new NativeBridge(context, documents, appData, diagnostics);
    this.src = `${VIRTUAL_ORIGIN}/index.html`;
  }

  build() {
    Column() {
      if (this.loadError.length > 0) {
        this.ErrorPanel();
      } else {
        Web({ src: this.src, controller: this.controller })
          // ArkWeb defaults every one of these to off; none of them is optional
          // for this app. `domStorageAccess` in particular is what the editor's
          // workspace snapshot falls back to when app-data slots are unavailable.
          .javaScriptAccess(true)
          .domStorageAccess(true)
          .fileAccess(true)
          .imageAccess(true)
          .onlineImageAccess(false)
          .databaseAccess(true)
          .mixedMode(MixedMode.None)
          .zoomAccess(false)
          .metaViewport(true)
          .darkMode(WebDarkMode.Auto)
          .onInterceptRequest((event) => this.assets.handle(event))
          .javaScriptProxy({
            object: this.bridge as NativeBridge,
            name: BRIDGE_OBJECT_NAME,
            methodList: SYNC_METHODS,
            asyncMethodList: ASYNC_METHODS,
            controller: this.controller
          })
          // Console output is surfaced into hilog so a device run can be
          // inspected with `hdc shell hilog | grep MindForge`. Nothing else
          // reads the page console on a real device.
          .onConsole((event) => {
            hilog.info(LOG_DOMAIN, TAG, 'console: %{public}s (%{public}s:%{public}d)',
              event.message.getMessage(),
              event.message.getSourceId(),
              event.message.getLineNumber());
            return false;
          })
          .onErrorReceive((event) => {
            const info: string = event.error.getErrorInfo();
            // A missing favicon is noise; anything else is a real load failure
            // and must be visible, per this repo's "a skipped test is no test"
            // stance on silent failures.
            hilog.error(LOG_DOMAIN, TAG, 'resource failed: %{public}s (%{public}s)',
              event.request.getRequestUrl(), info);
            this.lastError = info;
          })
          .onPageEnd(() => {
            this.missCount = this.assets.getMisses().length;
            hilog.info(LOG_DOMAIN, TAG, 'page loaded; %{public}d asset misses', this.missCount);
          })
          .width('100%')
          .height('100%')
      }
    }
    .width('100%')
    .height('100%')
    .backgroundColor('#0F172A')
  }

  @Builder
  ErrorPanel() {
    Column({ space: 12 }) {
      Text('MindForge could not start')
        .fontSize(20)
        .fontColor('#F8FAFC')
      Text(this.loadError)
        .fontSize(14)
        .fontColor('#FCA5A5')
      Text('The web bundle was not found inside this build.')
        .fontSize(13)
        .fontColor('#94A3B8')
      Text('Run `pnpm build:ohos` from the repository root and rebuild.')
        .fontSize(13)
        .fontColor('#94A3B8')
    }
    .width('100%')
    .height('100%')
    .justifyContent(FlexAlign.Center)
    .padding(24)
  }
}
