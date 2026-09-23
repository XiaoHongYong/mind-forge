# HarmonyOS NEXT 壳（ArkWeb）

这是 MindForge 的第三个壳。前两个是 `desktop/`（Tauri）与浏览器构建；
本目录把**同一份前端构建**跑在 HarmonyOS 的 ArkWeb（Chromium）里，
只补一层原生桥。

设计前提写在 `docs/file-document-architecture.md` 与 `AGENTS.md`：
本地优先、文档是用户自己路径上的明文文件、绝不联网。本壳按同样约束实现——
`module.json5` **没有申请** `ohos.permission.INTERNET`，一个逃过拦截的请求会硬失败，
而不是悄悄把文档内容发出去。

**架构说明在 [`docs/harmonyos-architecture.md`](../docs/harmonyos-architecture.md)**。
本文只讲怎么构建、怎么签名、怎么排障。

## 现在的状态

| 部分 | 状态 |
|---|---|
| ArkTS 壳编译 | ✅ `hvigorw assembleHap` 成功，产出 2.26 MB 未签名 HAP |
| 前端适配层 | ✅ 已接入，357 个前端测试全部通过（含 36 个本壳新增） |
| 资源同步脚本 | ✅ `pnpm sync:ohos` / `pnpm check:ohos` |
| 桥接属性名 keep 检查 | ✅ `pnpm check:ohos-bridge`（`-keep-property-name` 与注册名一致） |
| 签名配置检查 | ✅ `pnpm check:ohos-signing`（证书 / profile / bundle name 一致性；未配置则通过） |
| 签名 | ✅ 已配置；HAP 签名经 `hap-sign-tool verify-app` 独立验证通过 |
| 安装 / 启动 | ✅ `hdc install` + `aa start` 成功（真机，2026-09-23） |
| **页面是否真的渲染出来** | ⚠️ **未确认**（设备锁屏，没能抓到启动自检报告） |
| **API 12 兼容性** | ⚠️ **未验证**（见下） |

**签名 / 安装 / 启动已经跑通并验证过**；标 ⚠️ 的部分仍未实测，
不要当成已完成。完整的未验证清单见架构文档文末。

## 签名

证书与 profile 是**每个开发者各自的秘密**，所以 `build-profile.json5` 里的
`signingConfigs` 刻意不提交（`.gitignore` 也忽略了 `*.p12` / `*.cer` / `*.p7b`）。
签名只能在 DevEco Studio 里完成，需要华为账号登录。

```bash
pnpm check:ohos-signing   # 不碰密钥、不需要密码的结构一致性检查
```

### 签名是「四件套」，必须同一套

签名失败几乎都是**四件里混进了不同套的**。它们必须来自同一次密钥生成：

| 件 | 作用 | 必须与谁配对 |
|---|---|---|
| `.p12` | 私钥（签名用） | 公钥须与 `.cer` 一致 |
| `.cer` | 开发证书 | 须是 `.p7b` 里内嵌的那一张 |
| `.p7b` | profile：授权 bundle name、设备 UDID、ACL | bundle name 须等于 `AppScope/app.json5` |
| `build-profile.json5` 的 `signingConfigs` | 把上面三件串起来 | `products[].signingConfig` 须引用它 |

**最容易漏的是最后一行的引用**：`signingConfigs` 只是*声明*，
真正生效靠 `products[].signingConfig` 指过去。少了它，hvigor 报的是
「没有签名文件」，看起来像证书问题，其实是配置没接上。

`pnpm check:ohos-signing` 会检查上面除「私钥是否配对」之外的全部：
未配置签名时提示并返回 0；配置了但配坏了则**失败**而不是警告。
它查不了 `.p12` 里的私钥——那需要密码。
所以如果它通过了、hvigor 仍报 `11111002 Certificates error`，
剩下的唯一嫌疑就是**`.p12` 的私钥与 `.cer` 不是一对**。

手工验证这一点（不需要任何密码）：

```bash
# 证书里的公钥
openssl x509 -in your.cer -noout -pubkey | openssl md5
# 你当初生成的 CSR 里的公钥（若一致，说明这对密钥是配的）
openssl req -in your.csr -noout -pubkey | openssl md5
```

两个 md5 不一致，就说明这张证书**不是**用这个 p12 里的密钥申请下来的——
这种情况下无论怎么改 `keyAlias` 或密码都不可能签成功。

> ⚠️ `.cer` 通常是 **PEM 证书链**（根 CA → 中间 CA → 开发证书），
> 开发证书是**最后一张**。`openssl x509 -in` 只读第一张（根 CA），
> 直接比会得出假的「不匹配」结论。

### 正确做法：让 DevEco 自己写

**把 `signingConfigs` 整块交给 DevEco 生成**，不要手抄：

1. 用 DevEco Studio 打开 `ohos/` 目录（不是仓库根目录）。
2. 登录华为账号（`File > Project Structure > Signing Configs`）。
3. 勾选 **Automatically generate signature**，为 `com.crintsoft.mindforge` 生成。
4. 让 DevEco 写回 `build-profile.json5`——**四件套由它一次生成，天然配对**。

两点不要自己动手：

- **密码字段**。`storePassword` / `keyPassword` 存的是 DevEco 加密后的值
  （长度 ≥ 32），hvigor 只会**解密**它。手填明文不行——短于 32 字符会被拒，
  够长则解密失败报 `unable to authenticate data`。这两个字段交给 DevEco 写。
- **别把材料散在项目外**。当前配置指向 `~/ProjectsPrivate/ohos/`，
  那是另一个目录。DevEco 的自动签名会把材料放进 `~/.ohos/config/`，
  路径与密码自然对得上。

## 构建与运行

```bash
pnpm install
pnpm build:ohos        # 构建前端 + 同步进 rawfile
pnpm check:ohos        # 同步是否最新 + 桥接属性名 keep 检查（CI 用）
```

或者用 `run.sh`，它把 `DEVECO_SDK_HOME` / `hvigorw` / `hdc` 都找出来并串好：

```bash
./run.sh ohos          # 构建 + 同步 + assembleHap
./run.sh ohos --clean  # 清掉构建产物
./run.sh ohos --run    # 装到设备并启动（需要已签名的 HAP）
./run.sh ohos --logs   # 流式看 hilog
```

然后在 DevEco Studio 里打开 `ohos/` 并 Run。

命令行构建 HAP（不需要 DevEco 界面，但产物未签名）：

```bash
export DEVECO_SDK_HOME="/Applications/DevEco-Studio.app/Contents/sdk"
cd ohos
"$DEVECO_SDK_HOME/../tools/hvigor/bin/hvigorw" \
  --mode module -p product=default -p buildMode=debug assembleHap --no-daemon
```

产物：`ohos/entry/build/default/outputs/default/entry-default-unsigned.hap`

## 看诊断输出

启动时前端会往 hilog 写一份自检报告：ArkWeb 是否给了安全上下文、
`crypto.subtle` 是否真的能用、DOM storage 能不能写、桥是否就位、
以及**页面抛过的所有错误**。

```bash
hdc shell hilog | grep MindForge.Diagnostics
```

跑起来之后想看当时的快照，在 ArkWeb 的 console 里调：

```js
__mindforgeDiagnostics()
```

为什么是这些项：`crypto.subtle` 缺失时，`unsavedBackup.ts` 的 SHA-256 比对会
**静默退化成「永不恢复」**，不报错、不崩溃——正常用根本看不出来。
`CLAUDE.md` 里那句「被 skip 的测试等于没测」是同一件事：看不见的失败要在启动时就点亮。

## 架构：为什么这么接

### 1. 从虚拟 https 源提供资源，而不是 `file://`

前端构建被整个预读进内存，由 `onInterceptRequest` 从
`https://mindforge.invalid` 提供（`.invalid` 是 RFC 2606 保留后缀，永远解析不了）。

这么做的两个理由，缺一不可：

- **安全上下文**：`file://` 不是安全上下文，`crypto.subtle` 会直接不存在，
  文档指纹功能静默失效。
- **同源 ES module**：`file://` 下相邻模块会被判为跨源而拒绝加载，页面白屏。

`onInterceptRequest` 是**同步**回调——ArkWeb 不会等 Promise。所以
`AssetServer.ets` 在启动时把 1.45 MB 的包一次性读进 `Map`，回调里只做查表。

### 2. 桥的契约

`NativeBridge.ets` 注入为 `window.MindForgeNative`。
**每个方法都返回 JSON 信封 `{ ok, error, value }`，从不跨边界抛异常**——
异常穿过 JS/ArkTS 边界到页面里只剩一个没法处理的字符串。
前端 `src/platform/ohos.ts` 负责拆信封、把失败还原成真正的 `Error`，
这样调用点和 Tauri 那套写法完全一致。

⚠️ **桥接对象名（`BRIDGE_OBJECT_NAME`）与每个桥接方法名都必须出现在
`entry/obfuscation-rules.txt` 的 `-keep-property-name` 里**——这和 Android R8
keep 成员名是同一类事。否则 release 构建会把它们改名，注入的对象就丢了成员。
`pnpm check:ohos-bridge` 会比对注册名、类上定义的方法与 keep 列表，
不一致直接**失败**——这个 bug 编译期不报、运行期不报，只表现为某次调用不再解析。

### 3. 前端只改了一处判断

前端原本把「有原生文件系统」等同于 `isTauri()`。现在 `isTauri()` 与
`isOhos()` 并列，浏览器兜底逻辑不动。改动集中在：

- `src/platform/ohos.ts` —— 桥的封装、能力探测、显示路径
- `src/platform/ohosDiagnostics.ts` —— 启动自检
- `document/{fileAccess,io,unsavedBackup,workspace}.ts`、`utils/{download,openExternal}.ts`
- `pages/EditorPage.tsx`（备份落盘、最近文件能否重开）

`windowCaption.ts` 与 `syncNativeMenu.ts` 保持原样：ArkWeb 没有窗口标题和原生菜单，
`document.title` 那部分照常生效。

## 文档模型与桌面端**不同**（重要）

桌面端把用户选的绝对路径永久记住，随便重开。
HarmonyOS 是沙箱的：文件选择器返回一个 `file://` URI，**系统在应用退出时收回授权**。

所以：

| 场景 | 行为 |
|---|---|
| 刚选完文件 | 立刻 `persistUri` 请求系统记住授权 |
| 重开最近文件 | 先 `activateUri` 重新激活，再读 |
| 设备拒绝持久化（手机上常见，错误码 **801**） | 会话内照常读写；**「重开最近」不显示** |

最后一行是关键：`supportsPersistentFileAccess()` 探测 syscap 与安装期权限，
答不出或答否，左侧栏就不给「重开最近」这个入口。
宁可少一个按钮，也不给一个**必然失败**的按钮。

这让手机与 2in1 分成两条产品路径：PC 接近桌面的「文件即文档」，
手机更接近「导入 / 编辑 / 导出」。这条分叉是真实的，不是实现偷懒。

## 未验证的部分（如实列出）

- **API 12 兼容性**。`build-profile.json5` 声明
  `compatibleSdkVersion: "5.0.0(12)"`、`targetSdkVersion: "6.0.2(22)"`。
  实际只在 API 22 的 SDK 上编译过，**没有在任何 API 12 设备上跑过**。
  如果要在 API 12 上发布，这一条必须实测。
- **真机行为**：文件选择器返回的 URI 具体形状、`persistPermission` 在
  目标机型上是否真的报 801、ArkWeb 版本（HarmonyOS 6.0 = Chromium M132）
  对前端用到的 API 的支持程度——全部未实测。
- **`onInterceptRequest` 的覆盖范围**。目前假设 ArkWeb 只把 `http`/`https`
  （及 `customizeSchemes` 注册过的）scheme 送进回调，因此 `blob:` / `data:`
  的附件预览与下载不受影响。这个假设未在真机验证过。
- **`getRawFileListSync` 的递归语义**。不同版本行为不一致，所以
  `AssetServer.walk()` 对每个条目都先当文件读、失败再当目录递归——
  是防御性写法，不是实测结论。
- **前后台切换时的自动保存**。桌面端靠 `onCloseRequested` 钩子，
  ArkWeb 没有对应物，改由工作区自动保存（400 ms 防抖）承担。
  进程被系统直接杀掉时可能丢掉最后几百毫秒的编辑。

## 目录

```
ohos/
  AppScope/                     应用级配置与图标
  entry/
    obfuscation-rules.txt       保住桥的方法名（release 必须）
    src/main/
      module.json5              权限、deviceTypes（phone / tablet / 2in1）
      ets/
        entryability/           UIAbility 入口
        pages/Index.ets         Web 组件装配、错误面板
        web/
          Protocol.ets          虚拟源、MIME、桥的结果类型
          AssetServer.ets       内存资源服务
          DocumentStore.ets     选择器 + 文件读写 + 权限
          AppDataStore.ets      应用私有键值槽
          NativeBridge.ets      注入页面的对象
          Diagnostics.ets       自检报告
      resources/rawfile/www/    生成物，由 pnpm sync:ohos 写入，勿手改
  build-profile.json5           签名留空（见上）
```

## 相关

- [`docs/harmonyos-architecture.md`](../docs/harmonyos-architecture.md) —— **架构（先读这份）**
- `CLAUDE.md` —— 为什么单元测试看不见壳层 bug
- `docs/file-document-architecture.md` —— 文档模型
- `AGENTS.md` —— 隐私 / 仅本地规则
