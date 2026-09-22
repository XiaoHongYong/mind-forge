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
```

## 环境查找路径（节选）

| 组件 | 常见位置 |
|------|----------|
| Android SDK | `$ANDROID_HOME` / `$ANDROID_SDK_ROOT` / `~/Library/Android/sdk` / `~/Android/Sdk` / `%LOCALAPPDATA%\Android\Sdk` |
| Android NDK | `$ANDROID_NDK_HOME` / `SDK/ndk/<最新版本>` / `SDK/ndk-bundle` |
| JDK | `$JAVA_HOME` / macOS `java_home` / Android Studio JBR / `/usr/lib/jvm/*` |
| macOS 工具链 | `xcode-select -p` / `/Applications/Xcode.app` / `clang` |
| Linux 交叉 | `scripts/linux-build.Dockerfile` + Docker |

探测时会把找到的 SDK/NDK/JAVA_HOME 写入子进程环境变量。

## 产物位置

- 桌面：`desktop/src-tauri/target/release/bundle/`（dmg / nsis / appimage 等）
- Linux Docker：`dist-linux/`（见根 `pnpm build:linux`）
- Android：Tauri `gen/android` 工程下的标准输出（init 之后）

上次构建摘要：`scripts/build/.cache/last-build.json`（已 gitignore）。
