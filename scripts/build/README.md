# 跨平台构建（scripts/build）

自动探测本机 Xcode·clang / Android SDK·NDK / JDK / Rust / Docker，并构建当前主机上可行的目标。

> MindForge 基于 **Tauri 2**。支持 **mac / windows / linux / android**。
> Android 需先 `cargo tauri android init`（本脚本可用 `--init-mobile`）。
> **不支持 iOS 构建。** Windows 包需 Windows 主机或 CI；脚本会探测后跳过并说明原因。

## 用法

```bash
# 只探测环境
pnpm build:detect
# 或
node scripts/build/build.mjs --detect

# 构建本机默认可构建目标（macOS→mac，Windows→windows，Linux→linux）
node scripts/build/build.mjs

# 构建本机所有「探测为可构建」的目标
pnpm build:all
node scripts/build/build.mjs --all-possible

# 指定目标
node scripts/build/build.mjs --targets mac,android
node scripts/build/build.mjs --targets linux          # 非 Linux 时走 Docker

# 首次 Android：先 init 再编
node scripts/build/build.mjs --targets android --init-mobile

# 只打印命令
node scripts/build/build.mjs --all-possible --dry-run

# 导出鸿蒙工具链路径（给 run.sh ohos 用）
node scripts/build/detect-env.mjs --export-ohos-env
```

## 环境查找路径（节选）

| 组件 | 常见位置 |
|------|----------|
| Android SDK | `$ANDROID_HOME` / `$ANDROID_SDK_ROOT` / `~/Library/Android/sdk` / `~/Android/Sdk` / `%LOCALAPPDATA%\Android\Sdk` |
| Android NDK | `$ANDROID_NDK_HOME` / `SDK/ndk/<最新版本>` / `SDK/ndk-bundle` |
| JDK | `$JAVA_HOME` / macOS `java_home` / Android Studio JBR / `/usr/lib/jvm/*` |
| macOS 工具链 | `xcode-select -p` / `/Applications/Xcode.app` / `clang` |
| Linux 交叉 | `scripts/linux-build.Dockerfile` + Docker |
| DevEco Studio | `$DEVECO_STUDIO_HOME` / macOS `/Applications/DevEco-Studio.app` / `~/Applications/...` / `%LOCALAPPDATA%\Huawei\DevEco Studio` / `C:\Program Files\Huawei\DevEco Studio` / `~/deveco-studio` / `/opt/deveco-studio` |
| HarmonyOS SDK | `<DevEco>/sdk`（macOS 打包在 `.app/Contents/` 下，脚本会归一化） |

探测时会把找到的 SDK/NDK/JAVA_HOME 写入子进程环境变量。

## 鸿蒙（ohos）

鸿蒙壳不走 `build.mjs` 的构建路径，而是由 `run.sh ohos` 驱动
（前端构建 → 同步进 rawfile → hvigor `assembleHap`）。`build.mjs --detect`
仍会报告它的可用性，作为 `harmonyos` 目标：

```bash
node scripts/build/build.mjs --detect

# 把 SDK / hvigorw / hdc 导出成 shell 变量（run.sh ohos 用的就是它）
eval "$(node scripts/build/detect-env.mjs --export-ohos-env)"
```

导出的变量：`DEVECO_SDK_HOME`、`DEVECO_STUDIO_HOME`、`OHOS_HVIGORW`、
`OHOS_HDC`、`OHOS_BUNDLE_NAME`，以及把 hdc 所在目录前置的 `PATH`。

> **签名探测只做启发式判断**：`ohos/build-profile.json5` 的 `signingConfigs`
> 非空即视为已配置。证书是否有效、是否绑定当前 bundle name 与设备 UDID，
> 这里看不出来——真正的签名只能在 DevEco Studio 里完成。

`pnpm check:ohos` 还会跑两项子检查（与上面的启发式探测无关）：

**桥接属性名 keep 检查**（`pnpm check:ohos-bridge`）：release 开了
`-enable-property-obfuscation`（同类于 Android R8 的属性名混淆），
JS 按字符串抵达的名字必须写进 `-keep-property-name`。要比对三份清单——
`BRIDGE_OBJECT_NAME`（桥接对象名，注入为 `window.MindForgeNative`）、
`SYNC_METHODS` / `ASYNC_METHODS`（桥接方法名）、以及 keep 列表——不一致就**失败**。

**签名配置检查**（`pnpm check:ohos-signing`）：不需要密码。检查
`signingConfigs` 与 `products[].signingConfig` 的引用是否接上、三个文件是否存在、
`.cer` 与 `.p7b` 内嵌证书是否同一张、profile 的 bundle name 是否等于
`AppScope/app.json5`、profile 是否过期、是否列了设备 UDID。
**未配置签名时提示并返回 0**（未签名的 HAP 本来就能构建）；配置了才校验，
配坏了才失败。查不了 `.p12` 私钥与证书是否配对——那需要密码。

## 产物位置

- 桌面：`desktop/src-tauri/target/release/bundle/`（dmg / nsis / appimage 等）
- Linux Docker：`dist-linux/`（见根 `pnpm build:linux`）
- Android：Tauri `gen/android` 工程下的标准输出（init 之后）

上次构建摘要：`scripts/build/.cache/last-build.json`（已 gitignore）。
