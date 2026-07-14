# Leafmark

Leafmark 是一款面向 Windows 的沉浸式 Markdown 阅读与编辑器。它将阅读视图直接作为编辑界面：打开 `.md` 文件后，用户看到的是排版后的文章，单击正文即可输入和修改，不需要在“预览”和“编辑器”之间反复切换。

## 核心功能

- 阅读排版中直接编辑 Markdown
- 标准 Markdown 双向解析与序列化
- 原始 Markdown 源码模式
- 根据标题实时生成文章目录
- 目录跳转、折叠和宽度调整
- 墨夜、纸张、明亮三套主题
- 选中文字后显示浮动格式栏
- 支持标题、粗体、斜体、引用、列表、链接、图片、表格和代码块
- 支持新建、打开、拖放、保存和另存为
- 自动保存和未保存状态提示
- 外部文件变更自动重载
- 本地存在未保存修改时提供冲突保护
- 最近文件、窗口位置和偏好设置记忆
- 支持 `.md`、`.markdown`、`.mdown` 文件关联

## 界面设计

Leafmark 采用书籍式排版：左侧是章节目录，中间是留有大面积呼吸空间的正文，顶部仅保留必要操作。编辑器默认隐藏边框和传统工具栏，让写作状态与阅读状态保持一致。

应用包含三种工作方式：

1. **阅读即编辑**：默认模式，单击排版后的正文直接编辑。
2. **选区格式化**：选中文字后使用浮动工具栏设置格式。
3. **Markdown 源码**：使用 `Ctrl+/` 查看和修改原始 Markdown。

## 技术架构

- **Electron**：Windows 桌面窗口、文件系统和原生对话框
- **React + TypeScript**：界面和文档状态管理
- **Tiptap / ProseMirror**：所见即所得的结构化编辑
- **@tiptap/markdown**：Markdown 与编辑器文档树之间的双向转换
- **Vite / electron-vite**：开发与生产构建
- **electron-builder**：生成 Windows NSIS 安装包

主进程负责可信文件操作，渲染进程运行在 `contextIsolation` 与 sandbox 环境中。文件能力通过最小化的 preload IPC 接口提供，页面不能直接访问 Node.js。

## 项目结构

```text
leafmark/
├─ build/                    # Windows 应用图标资源
├─ src/
│  ├─ main/                 # Electron 主进程
│  ├─ preload/              # 安全 IPC 桥接
│  ├─ renderer/             # React/Tiptap 编辑界面
│  │  ├─ lib/               # 目录和文档状态逻辑
│  │  └─ styles/            # 阅读与主题样式
│  └─ shared.ts             # 主进程与渲染进程共享类型
├─ electron.vite.config.ts
├─ package.json
├─ package-lock.json
└─ tsconfig.json
```

## 环境要求

- Windows 10 或 Windows 11
- Node.js 20 或更高版本
- npm 10 或更高版本

## 开发运行

```powershell
git clone https://github.com/957115488-dotcom/leafmark.git
cd leafmark
npm ci
npm run dev
```

如果通过 GitHub 的“Download ZIP”下载，解压后在项目目录中执行 `npm ci` 和 `npm run dev` 即可。

## 类型检查与构建

```powershell
npm run typecheck
npm run build
```

生成 Windows 安装包：

```powershell
npm run dist
```

安装包输出到 `dist/`，该目录不会提交到 Git 仓库。

## 快捷键

| 快捷键 | 功能 |
| --- | --- |
| `Ctrl+N` | 新建文稿 |
| `Ctrl+O` | 打开 Markdown |
| `Ctrl+S` | 保存 |
| `Ctrl+Shift+S` | 另存为 |
| `Ctrl+F` | 查找内容 |
| `Ctrl+/` | 切换阅读编辑与源码模式 |
| `Ctrl+Z` | 撤销 |
| `Ctrl+Shift+Z` | 重做 |

## 文件与隐私

Leafmark 直接读写本地 Markdown 文件，不要求账号，也不会将文稿上传到远程服务器。最近文件、窗口状态和主题偏好仅保存在本机应用数据目录中。

## 当前版本

`0.1.0`
