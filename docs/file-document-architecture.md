# 文件文档架构

MindForge 是一款本地优先的思维导图编辑器。文档即磁盘上的文件（或在首次「另存为」之前的未命名缓冲区）。持久化以路径为中心：打开、保存、另存为、最近文件——没有独立的文档库，也无需登录。

## 产品模型

| 决策 | 选择 |
|---|---|
| 持久化 | 以磁盘路径为中心的文档 |
| 静态加密 | 无——文件为明文 |
| 原生格式 | `.mmforge`（无损 JSON 封装） |
| 互换格式 | 打开 / 另存为亦支持 `.md`、`.mm`、`.wxml`、`.xmind` |
| 首页 | 最近文件 + 新建 / 打开 |
| 账户 | 无 |
| 跨图链接 | `NodeLink { type: 'file', path, label? }` |

## 运行时模型

```text
HomePage (/)
  新建  → 未命名 DocumentSession（新 tab）→ /editor
  打开  → 对话框 → 按扩展名解析 → DocumentSession（新 tab；同路径则激活已有）→ /editor
  最近  → openPath → /editor

EditorPage (/editor)
  内存中的多文档 tabs（zustand：sessions[] + activeId）
  标签栏   → VS Code 风格：切换 / 关闭 / 新建；脏点表示未保存
  保存     → 将字节写入 active session.path（未命名则走另存为）
  另存为   → 对话框 → 写入 → 更新 path + 最近文件
  导出     → 序列化器 + 目标对话框（互换格式）
```

每个 `DocumentSession` 是一个打开中的缓冲（一个 tab）：

```ts
{
  id: string;            // tab 生命周期内稳定；不落盘
  path: string | null;   // null = 未命名 / 从未保存
  title: string;
  tree: MindMapTree;
  formatId: 'mmforge' | 'md' | 'mm' | 'wxml' | 'xmind';
  dirty: boolean;
}
```

同一绝对路径只对应一个 tab：再次打开会激活已有缓冲，而不是复制一份。

退出应用后再打开时，会恢复上次的标签：已保存文件按路径重新打开（磁盘未变时带回未保存修改），从未保存的新建文档按快照中的树恢复。快照写在应用数据目录（`__mindforge_workspace__`），浏览器模式则写入 `localStorage`。回到首页不会丢掉这组标签；只有关掉全部标签后，下次启动才回到首页。

路由从不嵌入绝对路径（长度 / 编码 / 隐私）。路径由会话 store 持有。

## 未保存备份

不会自动写入用户文件。保存须显式触发。Undo 历史在保存后仍保留，因此仍可撤销到上次保存之前的编辑。

在离开 / 退出且存在未保存修改时，将当前树写入应用数据目录（`unsaved-backups/`）：

| 类型 | 键 | 恢复规则 |
|---|---|---|
| 已关联路径 | 绝对路径的 hash | 仅当磁盘文件的 SHA-256 仍与备份时记录的 hash 一致时恢复；随后标记为已修改并删除备份。hash 不一致则丢弃备份。 |
| 未命名（从未保存） | `__mindforge_untitled__` | 载荷为 `path: null` 且 `neverSaved: true`（无关联文件）。下次新建 / 进入空编辑会话时恢复为已修改的未命名缓冲区，然后删除备份。 |

另存为成功会清除未命名备份槽；原地保存成功会清除该路径对应的备份槽。

## 桌面端文件 IO

| 外壳 | 文件 IO |
|---|---|
| 桌面（Tauri） | 原生打开/保存对话框 + `read_user_file` / `write_user_file` |

Webview 的 `plugin-fs` ACL 仍限定在应用目录。仅对话框选出的（或最近打开过的）绝对路径走上述 Rust 命令。

| 命令 | 作用 |
|---|---|
| `read_user_file(path)` | 从用户选定的绝对路径读取字节 |
| `write_user_file(path, data_base64)` | 原子写入用户选定的绝对路径 |

最近文件由前端跟踪（持久化到偏好 store）。

## 格式流水线

- **打开：** `IMPORT_FORMATS` 解析器（字节/文本 → 树）
- **保存 / 另存为（未命名）：** 优先 `.mmforge`（`treeToMmforge`）
- **原地保存：** 按路径扩展名所对应的格式序列化
- **导出菜单：** 互换格式矩阵（可能有损）

有损格式（`.md`、`.mm` 等）可能丢失仅编辑器使用的字段；`.mmforge` 不会。

## 安全姿态

隐私依赖操作系统层面：文件权限、可选的全盘加密，以及用户存放导图的位置。
