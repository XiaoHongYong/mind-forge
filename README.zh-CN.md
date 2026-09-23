# MindForge

本地桌面思维导图。直接打开、保存本机普通文件——无账号、无云端、无遥测。

原生无损格式：`.mmforge`。亦可打开 / 导出 FreeMind / FreePlane（`.mm`）、
WiseMapping（`.wxml`）、XMind（`.xmind`）与 Markdown（`.md`）。
文件菜单另支持 PNG / PDF 导出。

> English: [`README.md`](README.md)

## 功能

- **文件即文档** — 新建 / 打开 / 保存 / 另存为 / 最近文件；路径留在磁盘。同一绝对路径只对应一个标签（不会重复开缓冲）。
- **多标签编辑器** — 类 VS Code 标签与脏点；退出后可恢复会话（已保存路径重新打开；未保存树在磁盘 hash 仍匹配时从应用数据备份恢复）。
- **左侧栏** — 最近文件与实时文档大纲（与画布联动选中 / 滚动）。
- **右侧格式面板** — 节点填充 / 边框 / 分支色、字体、地图默认值、配色主题、结构（思维导图 ↔ 组织图）。
- **节点内容** — 笔记（Markdown）、图标、复选框、进度、日期规划、URL、标签、图片、文件链接与附件。
- **查找替换**、专注模式、色板 / 图标托盘、缩放 / 适应窗口、撤销 / 重做、子树剪切复制粘贴。
- **界面语言** — English 与简体中文（跟随系统，或在设置中固定）。
- **快捷键布局** — 封闭的 `FreeMind` 与 `Mac` 两套（设置 → 界面）；原生菜单栏同步其中带修饰键的子集。
- **外观** — 浅色 / 深色、强调色、画布背景、工具栏密度（精简 / 标准 / 大号）。

## 架构概览

核心组成：

1. `frontend_app/` — React + TypeScript 编辑器、i18n 与文档会话
2. `desktop/src-tauri/` — Rust / Tauri 2 宿主与用户路径文件 IO
3. 本地文件系统 — 明文 `.mmforge` / 互换格式文件

高层流程：

1. 启动即进入编辑器（无独立首页）。最近文件与大纲在左侧栏；新建 / 打开 / 保存在编辑器与原生菜单中。
2. 每个打开中的缓冲是一个内存中的 `DocumentSession`（一个标签）。
3. 保存将字节写回所选路径（或另存为）。导出经目标对话框序列化为互换或图像格式。
4. 桌面端文件 IO 使用原生对话框 + Tauri `read_user_file` / `write_user_file`；webview 文件系统 ACL 仍限定在应用目录。

相关说明：

- [`docs/file-document-architecture.md`](docs/file-document-architecture.md)
- [`docs/project-structure-and-build.md`](docs/project-structure-and-build.md)
- [`scripts/README.md`](scripts/README.md) — i18n 提取 / 跨平台构建
- [`SECURITY.md`](SECURITY.md)

## 快速开始

前置条件：

- Node.js 20+
- pnpm 10+
- Rust stable 工具链
- 各平台所需的 Tauri 2 依赖

检查环境：

```bash
node -v
pnpm -v
rustc -V
cargo -V
```

### 一条命令本地运行

在仓库根目录：

```bash
./run.sh              # Tauri 桌面（开发）；缺依赖时会先安装
./run.sh app          # 仅前端 Vite
./run.sh --install    # 强制先执行 pnpm install
```

等价的 pnpm 入口：

```bash
pnpm install
pnpm tauri:dev        # 桌面
pnpm dev:app          # 仅 Vite
pnpm build:app
pnpm test:app
pnpm tauri:build
```

### 跨平台发布构建

`scripts/build/` 会探测本机 Xcode / Android SDK·NDK / JDK / Rust / Docker，并构建当前主机上可行的目标（mac / windows / linux / android）。
Android 需一次性 `tauri android init`（`--init-mobile`）。**不支持 iOS**。Windows 包需 Windows 主机或 CI。

```bash
./run.sh build --detect          # 仅探测
./run.sh build                   # 本机原生桌面目标
./run.sh build --all             # 本机所有可构建目标
./run.sh build --targets mac,android --init-mobile
pnpm build:detect
pnpm build:all
```

详见 [`scripts/build/README.md`](scripts/build/README.md)。

### UI i18n

```bash
pnpm i18n:extract                # 提取 key 并写出待译 zh-CN 报告
pnpm i18n:pending                # 不重新提取，仅列出待译项
```

Agent 工作流：[`.cursor/skills/i18n-translate/SKILL.md`](.cursor/skills/i18n-translate/SKILL.md)。
更多见 [`scripts/README.md`](scripts/README.md)。

### macOS 打包

- 产物：`desktop/src-tauri/target/release/bundle/dmg/*.dmg`（宿主架构）
- 需要 macOS 10.15+。Apple Silicon 原生运行（无需 Rosetta）。
- Universal DMG（Apple Silicon + Intel）：

  ```bash
  rustup target add aarch64-apple-darwin x86_64-apple-darwin
  pnpm --dir frontend_app tauri:build --target universal-apple-darwin
  ```

  产物：`desktop/src-tauri/target/universal-apple-darwin/release/bundle/dmg/*.dmg`

- 发布的 DMG 通常未签名。安装后如需清除隔离属性：

  ```bash
  xattr -dr com.apple.quarantine "/Applications/MindForge.app"
  ```

### Linux 打包

- 默认 Tauri 目标含 AppImage（`desktop/src-tauri/target/release/bundle/`）。
- Snap 元数据在 `desktop/snap/`。
- 构建机依赖（Debian/Ubuntu）：

  ```bash
  sudo apt-get install -y libwebkit2gtk-4.1-dev libgtk-3-dev \
    libayatana-appindicator3-dev librsvg2-dev patchelf
  ```

- 非 Linux 主机可用构建脚本的 Linux 路径（有 Docker 时走容器）：

  ```bash
  ./run.sh build --targets linux
  ```

### Windows 说明

- 请在仓库根目录执行命令。
- 若在 `node_modules` 下安装失败并出现 EACCES：

```powershell
Remove-Item -Recurse -Force node_modules
pnpm install
```

- 若 pnpm 忽略构建脚本：

```powershell
pnpm approve-builds
```

## 快捷键

编辑器内置两套封闭布局——在「设置 → 界面」中选择，或按平台默认（Windows/Linux 为 `FreeMind`，macOS 为 `Mac`）。`Mod` 在 macOS 上为 ⌘，其余平台为 Ctrl。在编辑器中按 <kbd>F1</kbd>（FreeMind）或 <kbd>⌘/</kbd>（Mac）可打开实时对照表。

| 操作 | FreeMind（Windows/Linux） | Mac |
|---|---|---|
| **节点** | | |
| 添加子节点 | Tab / Insert | Tab |
| 添加左侧子节点（根） | Shift+Tab | ⇧Tab |
| 添加同级 | Enter | Enter |
| 删除节点 | Delete / Backspace | Delete / Backspace |
| 重命名 | F2 | ⌘Enter |
| 笔记 | F3 | ⌘⇧K |
| 编辑笔记 | Ctrl+E | ⌘E |
| 添加图片 | Alt+K | ⌥K |
| 链接到文件 | Ctrl+K | ⌘K |
| 附加文件 | F6 | ⌘⇧O |
| 折叠 / 展开 | Space | Space |
| 重置位置 | R | R |
| 重置全部位置 | Ctrl+Shift+R | ⌘⇧R |
| 自动对齐子树 | A | A |
| **格式** | | |
| 取色 | F4 | B |
| 图标 | I | I |
| 复选框 | C | C |
| 进度 | P | P |
| 日期 | D | D |
| URL | U | U |
| 标签 | T | T |
| **视图** | | |
| 回到根节点 | Home | H |
| 专注模式 | F5 / F | ⌘⇧F |
| 切换结构 | Ctrl+Shift+M | ⌘⇧M |
| 放大 | + / Alt+↓ | ⌘+ |
| 缩小 | - / Alt+↑ | ⌘− |
| 适应窗口 | F8 | ⌘⇧8 |
| 切换色板托盘 | Ctrl+Shift+1 | ⌘⇧1 |
| 切换图标托盘 | Ctrl+Shift+2 | ⌘⇧2 |
| 切换格式侧栏 | Ctrl+Shift+3 | ⌘⇧3 |
| **编辑** | | |
| 复制 | Ctrl+C | ⌘C |
| 剪切 | Ctrl+X | ⌘X |
| 粘贴 | Ctrl+V | ⌘V |
| 撤销 | F9 / Ctrl+Z | ⌘Z |
| 重做 | F10 / Ctrl+Y / Ctrl+Shift+Z | ⌘⇧Z |
| **查找** | | |
| 搜索 | Ctrl+F | ⌘F |
| 快捷键（本表） | F1 | ⌘/ |
| **文件** | | |
| 打开 | Ctrl+O | ⌘O |
| 保存 | Ctrl+S | ⌘S |

权威来源：`frontend_app/src/shortcuts/registry.ts`。原生菜单栏同步其中含义明确的修饰键子集。复制 / 剪切 / 粘贴是例外：它们是编辑器命令、没有菜单快捷键等价项，以便聚焦的文本框仍能收到按键。单字母快捷键仅在编辑器内生效，以免抢走打字焦点。

## 验证

```bash
pnpm test:app                    # 前端 vitest
pnpm --dir frontend_app build    # 类型检查 + 生产构建
```

跨层改动时，请在 `desktop/src-tauri` 下再跑 `cargo check`。

## 发布产物

常见产物（公开发布时通常附带 `.sha256` 校验和）：

- macOS DMG（按构建方式可为 universal）
- Windows NSIS `.exe` 安装包
- Linux AppImage（以及已配置时的 Snap）
- 在移动端已初始化并构建时的 Android APK / AAB

构建工作流配置见 `.github/workflows/`（若仓库中存在）。

## 贡献

- [`CONTRIBUTING.md`](CONTRIBUTING.md)
- [`CREDITS.md`](CREDITS.md)

期望：改动聚焦、仅本地 / 无遥测、日志中不写密钥、对用户可见行为写清说明。保持前端与桌面端版本号 / 打包元数据一致（当前为 `0.1.0`）。

## 许可

MindForge 以 MIT 许可发布。见 [`LICENSE`](LICENSE)。
