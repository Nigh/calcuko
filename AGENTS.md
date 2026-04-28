# AGENT.md - Calcuko 项目上下文

> **本文件供 Coding Agent 快速了解项目全貌。任何对项目的修改都必须同步更新本文件（见底部约束）。**

## 项目概述

| 字段 | 值 |
|---|---|
| 名称 | Calcuko（算子） |
| 用途 | 多行变量公式计算器，支持变量赋值、实时联动求值、语法高亮 |
| 在线地址 | https://Nigh.github.io/calcuko/ |
| 仓库 | https://github.com/Nigh/calcuko |
| 灵感来源 | [calctus](https://github.com/shapoco/calctus)（C# Windows 应用，本项目为其跨平台 Web 方案） |

## 技术栈

| 层 | 技术 | 版本 |
|---|---|---|
| 框架 | Astro | ^5.18.1 |
| UI 组件 | Svelte | ^5.55.2 |
| 样式 | Tailwind CSS v4 + DaisyUI v5 | @tailwindcss/vite ^4.2.2, daisyui ^5.5.19 |
| 语言 | TypeScript | ^5.9.3 |
| PWA | @vite-pwa/astro + workbox-window | ^1.2.0 / ^7.4.0 |

## 目录结构

```
calcuko/
├── AGENTS.md                 # 本文件 - Agent 项目上下文
├── README.md                 # 项目说明文档
├── package.json              # 依赖与脚本
├── astro.config.mjs          # Astro 配置（含 PWA、Svelte、Tailwind 集成）
├── svelte.config.js          # Svelte 配置
├── tsconfig.json             # TypeScript 配置（extends astro/tsconfigs/strict）
├── assets/
│   └── hero.png              # README 截图
├── public/
│   ├── favicon.svg           # 网站图标
│   ├── pwa-192x192.png       # PWA 图标 192
│   └── pwa-512x512.png       # PWA 图标 512
└── src/
    ├── components/
    │   ├── FormulaCalculator.svelte  # ⭐ 核心组件 - 公式编辑器与求值引擎
    │   ├── Counter.svelte            # ⚠️ 模板残留，未被任何页面引用
    │   └── ReloadPrompt.svelte       # PWA 更新提示 Toast
    ├── layouts/
    │   └── Layout.astro              # 全局 HTML 布局（含 ClientRouter、PWA manifest）
    ├── pages/
    │   └── index.astro               # 唯一页面，加载 FormulaCalculator
    └── styles/
        └── global.css                # Tailwind 入口 + DaisyUI 自定义主题 "xianii"
```

## 核心架构

### 页面路由
- 单页面应用，仅 `src/pages/index.astro` 一个路由
- `index.astro` → `Layout.astro`（壳）→ `FormulaCalculator.svelte`（`client:load` 客户端渲染）

### FormulaCalculator.svelte 核心逻辑
- **求值引擎**：逐行解析源码，支持 `变量 = 表达式` 赋值和纯表达式求值
- **实现方式**：`new Function("scope", "with (scope) { return (expr); }")` 执行表达式
- **内置函数**：暴露全部 `Math` 对象方法和常量（abs, sin, cos, sqrt, pow, PI, E 等）
- **变量作用域**：逐行累积 scope 对象，后续行可引用前面定义的变量
- **注释**：`//` 开头的行和空行被跳过
- **结果格式化**：小数限制 4 位，NaN/Infinity 特殊处理
- **语法高亮**：自定义 tokenizer，支持注释、数值、运算符、括号、变量五种 token 类型
- **括号匹配**：光标定位时高亮配对括号 `()[]{}`

### 数据持久化
- 使用 `localStorage`（key: `calcuko-formulas`）保存用户输入
- 页面加载时从 localStorage 恢复，无数据则使用内置示例公式

### PWA 配置
- `registerType: 'autoUpdate'`，自动更新 Service Worker
- `navigateFallback: '/calcuko/404'`
- 缓存策略：`globPatterns: ['**/*.{css,js,html,svg,png,ico,txt}']`
- `ReloadPrompt.svelte` 监听 SW 事件，显示更新/离线就绪 Toast

## 样式系统

- **主题**：自定义 DaisyUI 主题 `xianii`，暗色方案（`color-scheme: dark`）
- **主色调**：`--color-primary: #fb7185`（玫瑰粉）
- **语法高亮颜色**（在 FormulaCalculator.svelte `<style>` 中）：
  - 注释 `#94a3b8`（灰）、数值 `#f59e0b`（琥珀）、运算符 `#ec4899`（粉）、括号 `#6366f1`（靛蓝）、变量 `#0ea5e9`（天蓝）
- **Tailwind v4 语法**：使用 `@import "tailwindcss"` 和 `@plugin "daisyui"` 而非旧版 `@tailwind` 指令
- **字体大小**：在 `@theme` 块中自定义了 `--text-xs` 到 `--text-6xl`

## 部署配置

- **站点**：`https://Nigh.github.io`
- **Base path**：`/calcuko`（GitHub Pages 子路径部署）
- **构建命令**：`npm run build`（输出到 `dist/`）

## 开发命令

```bash
npm install          # 安装依赖
npm run dev          # 启动开发服务器（Astro dev）
npm run build        # 构建生产版本
npm run preview      # 预览构建结果
```

## ⚠️ 注意事项

1. **Counter.svelte 未使用**：模板脚手架残留，无页面引用，可安全删除
2. **`new Function` 安全性**：求值引擎使用 `new Function` + `with` 语句，仅适合本地/受信输入场景
3. **Svelte 4 语法**：组件使用 `on:click`、`$: reactive` 等 Svelte 4 语法（非 Svelte 5 runes）
4. **单文件组件**：所有核心逻辑集中在 `FormulaCalculator.svelte`（436 行），无拆分
5. **无测试**：项目无测试文件和测试框架配置
6. **无 CI/CD 配置文件**：未发现 GitHub Actions 等 CI 配置

---

## 🔒 强制约束：AGENT.md 同步更新规则

> **任何对本项目进行修改的 Coding Agent，都必须遵守以下规则：**

1. **修改代码后必须更新本文件**：当你对项目进行了任何实质性修改（新增/删除/重命名文件、修改架构、更改依赖、变更配置等），你**必须**同步更新 `AGENT.md` 中对应的部分，确保其始终反映项目的最新状态。

2. **需要更新的章节**：
   - 新增/删除/重命名文件 → 更新「目录结构」
   - 修改组件逻辑或架构 → 更新「核心架构」
   - 添加/移除依赖 → 更新「技术栈」和「开发命令」
   - 修改样式/主题 → 更新「样式系统」
   - 修改部署配置 → 更新「部署配置」
   - 新增注意事项或发现 → 更新「注意事项」

3. **更新时机**：在你使用 `attempt_completion` 提交最终结果**之前**，必须先完成 `AGENT.md` 的更新。

4. **保持精简**：更新时保持文档简洁，只记录对后续 Agent 理解项目有帮助的信息，避免冗余。
