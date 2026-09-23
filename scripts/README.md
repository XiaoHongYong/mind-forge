# scripts/

本目录存放构建、发布检查与日常维护用的仓库自动化脚本。优先在此提供可直接运行的
Node / shell 入口，避免在各 package 目录里散落临时脚本。

| 领域 | 路径 | 用途 |
|------|------|------|
| i18n | [`i18n/`](i18n/) | 提取 UI 文案、列出待译 zh-CN、写入译文 |
| build | [`build/`](build/) | 跨平台探测与编译（mac / windows / linux / android） |

根目录 `package.json` 已挂接常用入口（例如 `pnpm i18n:extract`、`pnpm build:detect`）。

## i18n

```bash
# 在仓库根目录 — 提取 key 并写出 pending 报告
pnpm i18n:extract
# 或
node scripts/i18n/extract.mjs

# 不重新提取，仅列出待译项
node scripts/i18n/list-pending.mjs
node scripts/i18n/list-pending.mjs --json

# 应用由 agent / 译者生成的 key→中文 映射
node scripts/i18n/apply-translations.mjs path/to/map.json
```

生成的报告（已 gitignore）：`scripts/i18n/.cache/pending.json`。

提取器配置在 `frontend_app/i18next.config.ts`（i18next-cli）。
Agent 工作流见 `.cursor/skills/i18n-translate/SKILL.md`。

## build

```bash
# 探测本机 Xcode / Android SDK·NDK / JDK / Rust / Docker
pnpm build:detect

# 构建本机当前可构建的目标（未 init 的 mobile 会自动排除）
pnpm build:all

# 指定平台；首次 mobile 加 --init-mobile
node scripts/build/build.mjs --targets mac,android --init-mobile
node scripts/build/build.mjs --targets windows   # 需在 Windows 上
node scripts/build/build.mjs --targets linux     # Linux 原生或 Docker
```

说明见 [`build/README.md`](build/README.md)。
