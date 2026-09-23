import { AbilityConstant, UIAbility, Want } from '@kit.AbilityKit';
import { hilog } from '@kit.PerformanceAnalysisKit';
import { window } from '@kit.ArkUI';
import { LOG_DOMAIN } from '../web/Protocol';

const TAG: string = 'MindForge.EntryAbility';

/**
 * Entry point for the HarmonyOS shell.
 *
 * OpenHarmony's Ability Manager owns the process, so — unlike the Tauri desktop
 * host, which owns its own `main()` — the entry point must be an ArkTS
 * UIAbility. Everything the platform needs is wired up in `onWindowStageCreate`;
 * the app's own state lives in the web layer.
 */
export default class EntryAbility extends UIAbility {
  onCreate(want: Want, launchParam: AbilityConstant.LaunchParam): void {
    hilog.info(LOG_DOMAIN, TAG, 'onCreate');
  }

  onDestroy(): void {
    hilog.info(LOG_DOMAIN, TAG, 'onDestroy');
  }

  onWindowStageCreate(windowStage: window.WindowStage): void {
    windowStage.loadContent('pages/Index', (err) => {
      if (err.code) {
        hilog.error(LOG_DOMAIN, TAG, 'loadContent failed: %{public}s', JSON.stringify(err));
        return;
      }
      hilog.info(LOG_DOMAIN, TAG, 'content loaded');
    });
  }

  onWindowStageDestroy(): void {
    hilog.info(LOG_DOMAIN, TAG, 'onWindowStageDestroy');
  }

  onForeground(): void {
    hilog.info(LOG_DOMAIN, TAG, 'onForeground');
  }

  onBackground(): void {
    hilog.info(LOG_DOMAIN, TAG, 'onBackground');
  }
}
