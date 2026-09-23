# 鸿蒙（HarmonyOS NEXT）壳架构

MindForge 的第三个壳。前两个是 `desktop/`（Tauri）与浏览器构建。
本壳把**同一份前端构建**跑在 HarmonyOS 的 ArkWeb（Chromium）里，只补一层原生桥。

本文说明**设计**。构建、签名与排障步骤在 [`ohos/README.md`](../ohos/README.md)。
文档模型的前提见 [`file-document-architecture.md`](file-document-architecture.md)，
隐私约束见 [`AGENTS.md`](../AGENTS.md)。

> **状态：未在真机上运行过。** ArkTS 壳能编译出 HAP，前端 357 个测试全绿，
> 但没有任何 API 12 设备或真机的实测数据。本文凡是推断而非实测的地方都标了
> ⚠️，汇总在文末「未验证清单」。不要把设计意图读成已验证的结论。

## 分层

```text
┌─ ArkWeb（Chromium） ────────────────────────────────┐
│  前端构建（与桌面端同一份 dist/）                    │
│    src/platform/ohos.ts        桥的封装 + 能力探测    │
│    src/platform/ohosDiagnostics.ts  启动自检          │
└──────────────────────┬──────────────────────────────┘
                       │  javaScriptProxy 注入
                       │  window.MindForgeNative
                       │  每个方法返回 JSON 信封
┌──────────────────────┴──────────────────────────────┐
│  ArkTS 壳（ohos/entry/src/main/ets/）                │
│    web/NativeBridge.ets    注入页面的对象             │
│    web/AssetServer.ets     内存资源服务               │
│    web/DocumentStore.ets   选择器 + 文件读写 + 授权    │
│    web/AppDataStore.ets    应用私有键值槽             │
│    web/Protocol.ets        虚拟源、MIME、信封类型      │
│    web/Diagnostics.ets     自检报告                   │
│    pages/Index.ets         Web 组件装配             │
└──────────────────────┬──────────────────────────────┘
                       │  HarmonyOS 文件与图形 API
┌──────────────────────┴──────────────────────────────┐
│  HarmonyOS NEXT（沙箱 + 授权模型）                   │
└─────────────────────────────────────────────────────┘
```

## 为什么是 ArkWeb 而不是原生重写

编辑器的绝大部分价值在画布布局、格式编解码、撤销栈与 i18n 上，这些与宿主无关。
原生重写意味着把这些逻辑用 ArkTS 再实现一遍，并且从此有两份会各自漂移的实现。
ArkWeb 只要求补一层桥，前端改动集中在少数几处（见第四节「前端触点」）。

代价是真实的，并且集中在下面两节：**资源怎么送达**、**授权怎么续期**。
这两件事在桌面端由 Tauri 挡住，在 HarmonyOS 上必须自己解决。

## 一、从虚拟 https 源提供资源

前端构建被整个预读进内存，由 `onInterceptRequest` 从
`https://mindforge.invalid` 提供（`.invalid` 是 RFC 2606 保留后缀，永远解析不了）。

直接从 `rawfile` 或 `resource://` 加载页面是走不通的，两个理由缺一不可：

- **安全上下文。** `file://` 不是安全上下文，`crypto.subtle` 直接不存在。
  编辑器用 SHA-256 指纹判断未保存备份是否还对得上磁盘
  （[`unsavedBackup.ts`](../frontend_app/src/document/unsavedBackup.ts)），
  没有它恢复路径**静默退化成「永不恢复」**——不报错、不崩溃，正常用看不出来。
- **同源 ES module。** `file://` 下相邻模块会被判为跨源而拒绝加载，页面白屏。

虚拟源一次解决两件事，且不花额外代价。

`.invalid` 与「不申请 `ohos.permission.INTERNET`」是同一件事的两面：
一个逃过拦截的请求会**硬失败**，而不是悄悄抵达真实主机。
网断了看不见、网通了才泄漏，是本地优先应用最不该有的失败模式。

### 同步回调逼出的预读设计

`onInterceptRequest` 是**同步**回调——ArkWeb 不会等 Promise。
所以 `AssetServer.ets` 在启动时把整包（约 1.45 MB / 23 个文件）一次性读进
`Map<string, ArrayBuffer>`，回调里只做查表，返回一个已完成的响应。

这就是为什么 `scripts/build/sync-ohos-assets.mjs` 必须产出确定性的结果：
包在进程启动时被冻结进内存，`index.html` 必须落在包的根，且不能混入
`_redirects` / `_headers` / `_routes.json` 这类托管平台的配置文件——
它们对 ArkWeb 没有意义，只会让体积与清单漂移。

## 二、桥的契约

`NativeBridge.ets` 注入为 `window.MindForgeNative`，方法分两类注册：
`log` 是同步的（`methodList`），其余在 `asyncMethodList` 里，页面可以直接 `await`。

**每个方法都返回 JSON 信封 `{ ok, error, value }`，从不跨边界抛异常。**
异常穿过 JS/ArkTS 边界到页面里只剩一个没法处理的字符串，丢掉栈与类型。
前端 [`src/platform/ohos.ts`](../frontend_app/src/platform/ohos.ts) 负责拆信封、
把失败还原成真正的 `Error`，于是调用点写法与 Tauri 那套完全一致。

`value` 是方法自定义的载荷，需要多字段时自己再套一层 JSON
（例如 `openDocument` 返回 `{ uri, name }`）。

### 名字必须活过混淆（有 keep 检查）

桥是**按字符串名字**从 JavaScript 抵达的（`javaScriptProxy`）。release 构建开了
`-enable-property-obfuscation`（同类于 Android R8 的属性名混淆），任何没进
`entry/obfuscation-rules.txt` `-keep-property-name` 块的桥接属性名都会被改名，
注入的对象就丢了那个成员——不报错、不警告，只是某次桥调用不再解析。

要 keep 的两类名字：

| 常量 | 含义 | 例子 |
|---|---|---|
| `BRIDGE_OBJECT_NAME` | **桥接对象名**（注入为 `window.…`） | `MindForgeNative` |
| `SYNC_METHODS` / `ASYNC_METHODS` | **桥接方法名** | `openDocument`、`deleteAppData` |

这个失败模式离现场很远：漏掉 `deleteAppData` 意味着未保存备份槽永远清不掉。

所以 `pnpm check:ohos-bridge`
（[`scripts/build/check-ohos-bridge.mjs`](../scripts/build/check-ohos-bridge.mjs)）
比对三份清单并**非零退出**：页面注册的名字、类上真实定义的方法、keep 列表。
只 warn 的检查在这里毫无价值——这个 bug 的全部特点就是「直到很贵之前都看不见」。

新增桥方法时改两处：`NativeBridge.ets` 的 `ASYNC_METHODS`，以及
`obfuscation-rules.txt`。检查会拦住漏改。

## 三、授权：与桌面端**不同**的文档模型

桌面端把用户选的绝对路径永久记住，随便重开。
HarmonyOS 是沙箱的：文件选择器返回一个 `file://` URI，
**系统在应用退出时收回授权**。

| 场景 | 行为 |
|---|---|
| 刚选完文件 | 立刻 `persistUri` 请求系统记住授权 |
| 重开最近文件 | 先 `activateUri` 重新激活，再读 |
| 设备拒绝持久化 | 会话内照常读写；**「重开最近」不显示** |

第三行是关键。`persistPermission` 在手机上常报 **801（Capability not supported）**；
能否持久化取决于 syscap `SystemCapability.FileManagement.AppFileService.FolderAuthorization`
与安装期权限。所以前端**不猜**：

```ts
// EditorPage.tsx
const persistFileAccess = usePersistentFileAccess();   // useSyncExternalStore
...
canReopenByPath={isTauri() || persistFileAccess}
```

探测是异步的，因此默认值必须是 `false`：宁可先少一个按钮，
也不给一个**必然失败**的按钮。答案是「否」或「答不出」时，
`canReopenByPath` 保持关闭，左侧栏就不给「重开最近」这个入口。

`rememberGrant()` 故意吞掉 `persistUri` 的失败：拒绝持久化不影响本次会话，
此时弹错误只会误导。需要区分这两种情况的调用点可以直接用 `persistUri()`
（它照常 reject）。

### 由此产生的产品分叉

PC（2in1）接近桌面端的「文件即文档」；手机更接近「导入 / 编辑 / 导出」。
**这条分叉是真实的，不是实现偷懒。** 与其假装两端一样而让手机用户撞上
打不开的最近文件，不如让手机诚实地少一个入口。

## 四、URI 当作路径：前端为什么只改了一处判断

前端原来把「有原生文件系统」等同于 `isTauri()`。现在 `isTauri()` 与 `isOhos()`
并列，浏览器兜底逻辑不动。

关键设计是**把选择器 URI 当成不透明的「路径」**：
`fileNameFromPath`、`titleFromPath`、`formatIdFromPath`、备份键、最近文件键
都只对字符串做结构化处理，不关心它是不是真实路径。
于是整个文档层无需改动。

`session.path` 保持 URI 原样（它是备份 / 最近文件的键），
只有**展示**用的标题与格式走 `shellDisplayPath()`——
它剥掉 scheme、query、hash 并解码百分号转义：

```ts
ohosDisplayPath('file://docs/storage/Users/currentUser/My%20Map.mmforge?x=1#y')
// → 'docs/storage/Users/currentUser/My Map.mmforge'
```

`shellDisplayPath()` 在别的壳上是恒等函数，所以可以无条件调用。

### 前端触点

| 文件 | 改动 |
|---|---|
| `src/platform/ohos.ts` | 桥封装、能力探测、显示路径（新增） |
| `src/platform/ohosDiagnostics.ts` | 启动自检（新增） |
| `document/fileAccess.ts` | 选择器 / 读写分支到桥 |
| `document/io.ts` | `hasFileSystem()` = `isTauri() \|\| isOhos()` |
| `document/unsavedBackup.ts` | 应用私有槽路由到桥 |
| `document/workspace.ts` | 工作区恢复的能力判断 |
| `utils/download.ts` | 导出走「另存为」对话框 |
| `utils/openExternal.ts` | 交外部浏览器，而非 `window.open` |
| `pages/EditorPage.tsx` | 备份落盘、`canReopenByPath` |
| `components/DocumentSidebar.tsx` | 最近文件的路径副标题 |
| `main.tsx` | 安装自检 |

`windowCaption.ts` 与 `syncNativeMenu.ts` 保持原样：ArkWeb 没有窗口标题和原生菜单，
`document.title` 那部分照常生效。

`utils/download.ts` 值得单说：`<a download>` 在 ArkWeb 上是空操作
（和 WKWebView 同一个坑），没有 `WebDownloadDelegate` 就什么也不会发生。
所以导出必须自己走「另存为」对话框 + 写字节。

## 五、诊断：让静默失败在启动时点亮

`ohosDiagnostics.ts` 在启动时把一份自检报告写进 hilog，并在 `load` 时上报。
报告覆盖 ArkWeb 是否给了安全上下文、`crypto.subtle` 是否**真的能用**
（绑定 `crypto.subtle` 不等于它能工作——非安全上下文里 API 存在但会拒绝）、
DOM storage 能否写、桥是否就位，以及**页面抛过的所有错误**。

```bash
hdc shell hilog | grep MindForge.Diagnostics
```

它钩了 `error`、`unhandledrejection`，以及 `console.error`。
三者的必要性不一样：React 把渲染失败走 `console.error`，页面级 error 监听器
永远看不到——只钩前两个，最要命的那类壳层故障恰好是隐形的。

这份自检和 `CLAUDE.md` 里「被 skip 的测试等于没测」是同一条规则：
**看不见的失败必须在启动时点亮**，而不是等用户报「导图丢了」。

## 六、隐私姿态

与桌面端一致，只是换了守法：

- `module.json5` **不申请** `ohos.permission.INTERNET`。
  逃过拦截的请求硬失败。
- 只申请 `ohos.permission.FILE_ACCESS_PERSIST`，且是 `normal`（system_grant）级别，
  用于续期授权。
- 资源从内存提供，不落第二个副本到磁盘。
- 授权拒绝（801）是**正常路径**，不是错误路径——代码不把它当异常上报。

## 构建与产物

```bash
pnpm build:ohos        # 前端构建 + 同步进 rawfile
pnpm check:ohos        # 同步是否最新 + 桥接属性名 keep 检查（CI 用）
./run.sh ohos          # 全套：构建 + 同步 + assembleHap
./run.sh ohos --deploy # 安装已签名的 HAP 到设备
```

| 选项 | 作用 |
|---|---|
| `--sync-only` | 只重建包，不跑 hvigor |
| `--release` | `buildMode=release` |
| `--open` | 在 DevEco Studio 里打开 `ohos/` |
| `--deploy` / `--run` | 装到设备 / 装完再启动 |
| `--logs` | 流式看 hilog（过滤 MindForge） |
| `--device SN` | 指定设备 |
| `--clean` | 清掉构建产物 |

**签名是唯一无法从命令行完成的一步**：证书与 profile 是每个开发者各自的秘密，
需要华为账号登录。`build-profile.json5` 里的 `signingConfigs` 各人本地填写、
**刻意不提交**，`*.p12` / `*.cer` / `*.p7b` 已 gitignore。HAP 能构建但**装不上**。

签名材料必须**成套**（同一对密钥生成的 p12 + cer + p7b，且 profile 的 bundle name
与 `AppScope/app.json5` 一致），并且 `products[].signingConfig` 要引用到配置名——
少了这一句，hvigor 报的是「没有签名文件」，与证书无关。
`pnpm check:ohos-signing` 校验这套一致性（不碰私钥，因此不需要密码），
而 `.p12` 私钥与 `.cer` 是否配对只能靠比对公钥——两者都见
[`ohos/README.md`](../ohos/README.md)。

## 未验证清单（如实列出）

- **API 12 兼容性。** `build-profile.json5` 声明
  `compatibleSdkVersion: "5.0.0(12)"`、`targetSdkVersion: "6.0.2(22)"`，
  但只在 API 22 的 SDK 上编译过，**没有在任何 API 12 设备上跑过**。
  要在 API 12 上发布，这条必须实测。
- **真机行为**：选择器返回的 URI 具体形状、`persistPermission` 在目标机型上
  是否真的报 801、ArkWeb 版本（HarmonyOS 6.0 = Chromium M132）对前端用到的
  API 的支持程度——全部未实测。
- **`onInterceptRequest` 的覆盖范围。** 目前假设 ArkWeb 只把 `http`/`https`
  （及 `customizeSchemes` 注册过的）scheme 送进回调，因此 `blob:` / `data:`
  的附件预览与下载不受影响。未在真机验证。
- **`getRawFileListSync` 的递归语义。** 不同版本行为不一致，所以
  `AssetServer.walk()` 对每个条目先当文件读、失败再当目录递归——
  是防御性写法，不是实测结论。
- **前后台切换时的自动保存。** 桌面端靠 `onCloseRequested` 钩子，ArkWeb
  没有对应物，改由工作区自动保存（400 ms 防抖）承担。
  进程被系统直接杀掉时可能丢掉最后几百毫秒的编辑。
- **手机端的授权降级路径。** 「手机上会报 801 因此隐藏重开入口」是基于文档
  与社区报告的推断，没有在手机上实测过。

## 相关

- [`ohos/README.md`](../ohos/README.md) —— 构建、签名、排障
- [`file-document-architecture.md`](file-document-architecture.md) —— 文档模型（本壳的分叉见第三节）
- [`project-structure-and-build.md`](project-structure-and-build.md) —— 仓库结构与构建
- [`../AGENTS.md`](../AGENTS.md) —— 隐私 / 仅本地规则
- [`../CLAUDE.md`](../CLAUDE.md) —— 为什么单元测试看不见壳层 bug
