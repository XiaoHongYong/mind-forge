# CLAUDE.md — mindforge

本仓库的 agent 契约见
**`docs/file-document-architecture.md`**（文档打开 / 保存模型）与
**`AGENTS.md`**（隐私 / 仅本地规则）。改任何东西之前先读这两份。

本文件说明的是：**这里的代码如何测试，以及为什么「显而易见」的测法在这里行不通。**

---

## 这个仓库真正会踩的 bug 类型

编辑器是一份代码库，可以跑在多种壳里：

| 壳 | 路由 | Tauri IPC | 后端 |
|---|---|---|---|
| `desktop/`（Tauri） | `BrowserRouter` | 有 | 无 |
| 托管的兄弟应用（若有） | `BrowserRouter` | 无 | 有 |

单元测试是把组件**隔离渲染**的，也就是组件要什么上下文，测试就给什么。
因此一个无条件调用 `useNavigate()` 的组件可以过掉所有单元测试，然后在
没有 `<Router>`（或 IPC 不对）的壳里把页面弄成白屏。

**教训不是「再多写单元测试」。** 按构造，单元测试看不见这类问题。
编辑器逻辑的覆盖已经够用；壳层 bug 要紧的是按*那个壳*去跑应用。

桌面端用的是**明文文件文档**模型：编辑器直接打开，左侧栏是最近文件与大纲。
壳层冒烟与 E2E 应覆盖打开 / 保存（菜单、对话框），而不是单独的首页。

---

## 各层做什么

在**能看见该 bug 的最便宜一层**加测试。这里多数缺陷只属于某一层，对其他层不可见。

| 层 | 能抓住什么 | 成本 |
|---|---|---|
| **类型检查**（`tsc --noEmit`） | 截断的 JSX、错误 props、缺 import | 秒级 |
| **单元 / 组件**（vitest） | 逻辑、解析器、几何、格式往返 | 秒级 |
| **壳层冒烟**（Playwright，按壳） | 缺上下文、缺 IPC、白屏 | ~1 分钟 |
| **交互**（Playwright） | 面板互不关闭、对话框困住焦点 | ~1 分钟 |
| **桌面 E2E**（WebdriverIO + `@wdio/tauri-service`） | 原生菜单、文件对话框、真实 WebView | 分钟级 |
| **构建门禁**（scripts） | 版本漂移、离线对等、格式往返保真 | 秒级 |

---

## 何时必须跑什么

```
pre-commit（~10 s）tsc --noEmit + 对变更文件跑 vitest
pre-push（~90 s）全量 vitest + 往返门禁 + 版本门禁
CI（分钟级）以上全部 + cargo check/test
release 对真实桌面构建跑 WebdriverIO
```

---

## 踩坑之后定下的规则

**被 skip 的测试等于没测。** 若原因是「找不到选择器」，宁可失败也不要 skip——那就是 bug。

**冒烟测试的主断言是「什么都没抛错」。** 收集 `pageerror` 与 `console.error`，
点一遍壳层，断言列表为空且 `#root` 仍有子节点（白屏检测）。

**只会 warn 的门禁不算门禁。** 值得跑的检查就该失败。

**每种新格式都要在** `utils/__tests__/roundTrip.test.ts` **里加保真 mask 条目**，
不要另起一次性测试文件。

**兼容性用真实文件测**，见 `utils/__tests__/compat.test.ts`。

---

## 命令

```bash
pnpm install
pnpm dev:app          # frontend_app Vite
pnpm test:app         # vitest
pnpm check:roundtrip  # 导入/导出保真门禁
pnpm tauri:build      # 桌面打包
```
