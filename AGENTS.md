# MindForge Agent 指南

面向在此本地优先桌面应用上工作的 AI agent 的简明规则。

关键链接：
- 架构：[docs/file-document-architecture.md](docs/file-document-architecture.md)
- 鸿蒙壳架构：[docs/harmonyos-architecture.md](docs/harmonyos-architecture.md)
- 桌面宿主：[desktop/src-tauri/](desktop/src-tauri/)
- 鸿蒙宿主：[ohos/](ohos/)
- 前端应用：[frontend_app/](frontend_app/)

首要规则：
- `docs/` 下普通文档使用小写 + kebab-case（见 `.cursor/rules/docs-naming.mdc`）。
- 仅本地：不要引入云端、遥测或远程账号功能。
- 文档是用户自选路径上的明文文件（打开 / 保存 / 最近文件）。
- 用户路径的文件 IO 在桌面端须经 Tauri `read_user_file` / `write_user_file`
  （对话框选出的路径），不要放宽 webview 文件系统 ACL。
- 在鸿蒙端，同样的约束由 `ohos/` 的 ArkTS 桥承担：只有**选择器返回的授权 URI**
  可读写，且 `module.json5` 不得申请 `ohos.permission.INTERNET`。
  桥接对象名与每个桥接方法名都必须同时在 `ohos/entry/obfuscation-rules.txt`
  的 `-keep-property-name` 里（`pnpm check:ohos` 会失败，不是警告）。
- 切勿建议记录文档内容，或把密钥写进仓库。
  签名材料（`*.p12` / `*.cer` / `*.p7b`）属此类，永不提交。

测试与发布卫生：
- 做跨层改动时，运行 `pnpm --dir frontend_app build`，以及在
  `desktop/src-tauri` 下运行 `cargo check`。
- 保持前端与桌面端的版本号、打包元数据一致。
- UI i18n：通过 `scripts/i18n/` 提取 / 查看待译 / 写入译文（`pnpm i18n:extract`）。
  Agent 工作流：`.cursor/skills/i18n-translate/SKILL.md`。
- 跨平台构建：`scripts/build/`（`pnpm build:detect` / `pnpm build:all`）。
  自动探测 Xcode / Android SDK·NDK / JDK / DevEco Studio；详见 `scripts/build/README.md`。
- 鸿蒙壳：`pnpm build:ohos` / `pnpm check:ohos`（后者是 CI 检查）。
  签名无法从命令行完成，须在 DevEco Studio 里登录华为账号——见 `ohos/README.md`。
