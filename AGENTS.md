# AGENTS.md - Calcuko 项目上下文

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
| 编辑器 | CodeMirror 6 | codemirror ^6.0.2 |
| 样式 | Tailwind CSS v4 + DaisyUI v5 | @tailwindcss/vite ^4.2.2, daisyui ^5.5.19 |
| 语言 | TypeScript | ^5.9.3 |
| 高精度数值 | decimal.js | ^10.6.0 |
| PWA | @vite-pwa/astro + workbox-window | ^1.2.0 / ^7.4.0 |
| 测试 | Vitest + Playwright | ^4.1.11 / ^1.62.1 |

## 目录结构

```
calcuko/
├── AGENTS.md                 # 本文件 - Agent 项目上下文
├── README.md                 # 项目说明文档
├── package.json              # 依赖与脚本
├── astro.config.mjs          # Astro 配置（含 PWA、Svelte、Tailwind 集成）
├── .github/workflows/ci.yml  # GitHub Actions：测试、类型检查、生产构建
├── playwright.config.ts      # Playwright 生产预览冒烟测试配置
├── vitest.config.ts          # 单元测试范围（排除 e2e 与构建目录）
├── e2e/                      # 编辑器、持久化、错误、颜色、撤销端到端测试
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
    │   ├── FormulaCalculator.svelte  # ⭐ 核心组件 - UI、持久化与编辑历史
    │   └── ReloadPrompt.svelte       # PWA 更新提示 Toast
    ├── layouts/
    │   └── Layout.astro              # 全局 HTML 布局（含 ClientRouter、PWA manifest）
    ├── lib/
    │   ├── builtins/                 # 位运算等分组注册的工程函数及测试
    │   ├── language/                 # 表达式语言 tokenizer、AST、Pratt parser、源码位置类型及测试
    │   ├── types.ts                  # 共享类型定义（LineResult）
    │   ├── constants.ts              # 示例公式和帮助弹窗元数据
    │   ├── evaluator.ts              # ⭐ 内置注册、逐行求值和统一 formatter
    │   ├── resultFormatting.ts        # 行级结果格式选项、精度与显示转换
    │   ├── editorExtensions.ts         # CodeMirror 高亮、错误/hover 行与高度 spacer
    │   └── highlight.ts              # 语法高亮 tokenizer
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
- **编辑器内核**：CodeMirror 6 提供输入、选区、历史和行号；自定义装饰复用语言 tokenizer，并以 spacer 匹配可变高度结果行
- **光标与行高**：CodeMirror 光标显式使用主题主色；多行结果通过实测结果高度创建 block spacer，使下一源码行与下一结果行保持像素级对齐
- **行联动**：当前源码行与对应结果同步高亮，hover 结果时强化结果样式并高亮左侧源码行；两栏双向同步滚动
- **Header 图标**：使用 `<img src="/favicon.svg">` 引用 `public/favicon.svg` 作为品牌 logo，替代之前的内联计算器 SVG
- **BASE_URL 处理**：组件顶部定义 `BASE_URL = import.meta.env.BASE_URL.replace(/\/?$/, "")`，资源路径统一为 `{BASE_URL + "/favicon.svg"}`，适配子路径 `/calcuko` 部署
- **实现方式**：表达式经 tokenizer、Pratt parser 生成 AST，再由受控解释器在显式 scope 中执行，不调用 JavaScript 动态求值
- **内置函数**：暴露全部 `Math` 对象方法和常量（abs, sin, cos, sqrt, pow, PI, E 等），以及进制转换函数 `hex()` `bin()` `oct()`
- **变量作用域**：逐行累积 scope 对象，后续行可引用前面定义的变量
- **Unicode 变量名**：所有变量名正则使用 `\p{ID_Start}` / `\p{ID_Continue}` / `\p{Extended_Pictographic}` Unicode 属性转义，支持中文、希腊字母、emoji 等 Unicode 标识符
- **Tokenizer**：`src/lib/language/tokenizer.ts` 生成带行列与源码区间的 token；字符串内容不会被空格、进制或注释规则改写，只有忽略前导空白后以 `//` 开头的整行才是注释
- **Parser**：`src/lib/language/parser.ts` 使用 Pratt 算法生成 AST，集中定义操作符优先级和结合性，支持赋值、调用、数组、条件表达式与隐式乘法
- **用户函数**：支持 `fn f(a,b)=expr` 与 `x => expr` / `(a,b) => expr`，函数使用词法闭包、支持递归并严格校验参数数量
- **解构赋值**：支持 `[a,b,c]=[10,20,30]`；右侧必须是同长度数组，校验完成后才原子写入 scope
- **范围**：`start..stop` 为不含终点范围，`start..=stop` 包含终点，`range(start,stop,step?)` 支持显式步长；单次最多生成 10,000 项
- **数组运算**：算术操作符支持递归逐元素运算、标量广播及同形校验；内置聚合、平均、映射、过滤、排序、反转和去重函数
- **矩阵**：`matrix(rows)` 将矩形二维数值数组转为独立 Matrix 类型，`row(values...)` 和 `col(values...)` 分别构造单行、单列矩阵；支持矩阵/标量运算、矩阵乘法与 `det()` 精确行列式；结果栏默认以内容自适应宽度、左右方括号包围且最多 12 行的可滚动二维表展示
- **位运算函数**：所有函数接收显式正位宽，支持任意精度掩码、旋转、bit/byte/nibble 翻转、bit count、奇偶校验及 pack/unpack
- **数论函数**：BigInt 原生实现 `isPrime`、`primeFact`、`gcd`、`lcm`，覆盖负数、0 和数组/可变参数输入
- **ECC**：`eccEncode`/`eccDecode` 实现 1–4096 数据位的 Hamming SECDED；解码以 RuntimeRecord 区分 clean、corrected、double-error
- **颜色类型**：ColorValue 保存原色彩空间通道和规范化 sRGB 预览；支持 RGB、HSL、HSV、BT.601 YUV、Web Hex 与 RGB565 严格转换，结果栏和变量快照显示色块
- **编码函数**：UTF-8、Base64 与 URL 编解码严格校验字符串和 0–255 BigInt 字节数组，不用替换字符掩盖损坏输入
- **统计与随机**：总体/样本统计使用 Decimal；`rand`/`randInt` 使用 Web Crypto，随机整数采用拒绝采样并遵循含下界、不含上界
- **方程求解**：`solve` 使用 Decimal 中心差分 Newton-Raphson，支持自动初值、单初值和 101 点区间扫描，带迭代/求值预算及根去重
- **错误模型**：tokenizer、parser 与解释器抛出带错误码和源码区间的 `LanguageError`；行结果包含绝对行号、列号及中文错误消息
- **结构化结果**：`RuntimeRecord` 保存只读、有序的键值结果，统一 formatter 可递归显示、复制并用于变量快照
- **空白与字符串**：tokenizer 仅忽略字符串外的空白，字符串中的空格和 `//` 原样保留，不再做正则剥离或改写
- **注释**：只有忽略前导空白后以 `//` 开头的整行是注释；表达式中的 `//` 是向零截断的整数除法
- **进制字面量**：tokenizer 直接识别 `0x`（十六进制）、`0b`（二进制）和前导 `0`（八进制）并解析为 BigInt
- **进制转换函数**：`hex(n)` / `bin(n)` / `oct(n)` 对任意精度整数生成带前缀的稳定文本，数字部分从低位起每 4 位分组
- **进制结果展示**：`formatValue()` 检测 `isRadixString()` 判断字符串是否为进制表示，对数字部分调用 `formatRadixString()` 进行空格分组；分组结果也显示在变量快照中
- **SI 词缀支持**：数字 token 直接支持 T/G/M/k/m/u/n/p，并在该行结果中使用统一 Decimal formatter 输出合适词缀
- **隐式乘法**：parser 将相邻的数值、标识符与括号按语法规则解析为乘法，例如 `2PI`、`3R1`
- **结果格式化**：结果栏只显示值；BigInt、Decimal、Rational 与颜色支持按行选择显示格式和精度，配置随未改内容迁移并持久化到 localStorage，空行、错误或运行时类型变化时自动清除
- **格式菜单浮层**：菜单渲染为脱离编辑器与结果滚动容器的 fixed 顶层浮层，避免 CodeMirror stacking context 和裁剪冲突
- **数值模型**：整数为任意精度 BigInt，小数使用 34 位有效数字且 half-even 舍入的 Decimal，`a$b` 为自动约分的精确 Rational；混合运算按 BigInt → Rational → Decimal 提升
- **语法高亮**：`src/lib/highlight.ts` 直接消费求值语言 tokenizer 的 token，支持注释、字符串、数值（含 SI 与进制）、运算符（含逗号等标点）、括号和变量；高亮模式按行恢复词法错误，以错误样式显示未知字符和未闭合字符串并继续着色，求值模式仍严格报错
- **括号匹配**：光标定位时高亮配对括号 `()[]{}`
- **帮助弹窗**：Header 中的「帮助」按钮展示基本语法、函数和常量元数据，支持 Escape 关闭、关闭按钮标签及打开/关闭焦点恢复
- **编辑器标题栏操作**：载入示例和清空均先确认、写入同一持久化 key，并提供单步撤销
- **变量快照复制**：变量快照以 button 形式展示 `name = value`，点击通过 `navigator.clipboard.writeText()` 复制值，并显示 2 秒自动消失的「已复制」Toast

### 数据持久化
- 使用 `localStorage`（key: `calcuko-formulas`）保存用户输入
- 页面加载时从 localStorage 恢复，无数据则使用内置示例公式
- 清除按钮把空文档写入原有 key，保持旧版本存储兼容
- 空字符串也会从 localStorage 正确恢复；载入示例和清空前要求确认，并可在编辑器标题栏单步撤销

### PWA 配置
- `registerType: 'autoUpdate'`，自动更新 Service Worker
- `navigateFallback: '/calcuko/index.html'`
- 缓存策略：`globPatterns: ['**/*.{css,js,html,svg,png,ico,txt}']`
- `ReloadPrompt.svelte` 监听 SW 事件，以中文显示更新/离线就绪 Toast 并提供可访问按钮标签

## 样式系统

- **主题**：自定义 DaisyUI 主题 `xianii`，暗色方案（`color-scheme: dark`）
- **主色调**：`--color-primary: #fb7185`（玫瑰粉）
- **语法高亮颜色**（在 FormulaCalculator.svelte `<style>` 中）：
  - 注释 `#94a3b8`（灰）、数值 `#f59e0b`（琥珀）、运算符 `#ec4899`（粉）、括号 `#6366f1`（靛蓝）、变量 `#0ea5e9`（天蓝）
- **编辑器选区**：文本选中背景使用半透明主题主色（玫瑰粉），保持高亮叠层文字可见
- **错误行标识**：编辑器以半透明错误色背景和左侧红色边线标记求值失败的整行，未知字符使用红色波浪下划线显示
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
npm test             # 运行 Vitest 单元测试
npm run check        # TypeScript/Astro 检查
npm run build        # 构建生产版本
npm run preview      # 预览构建结果
npm run test:e2e     # 构建后运行 Playwright 冒烟测试
```

## ⚠️ 注意事项

1. **表达式边界**：求值器只执行 AST 支持的语法和注册到 scope 的函数，不开放浏览器全局对象
2. **Svelte 4 语法**：组件使用 `on:click`、`$: reactive` 等 Svelte 4 语法（非 Svelte 5 runes）
3. **模块拆分**：核心逻辑已拆分为 `src/lib/` 下的 `types.ts`（类型）、`constants.ts`（常量）、`evaluator.ts`（求值引擎）、`highlight.ts`（语法高亮），`FormulaCalculator.svelte` 仅负责 UI 和状态管理（UI、CodeMirror 和交互状态）
4. **测试与 CI**：Vitest 负责单元测试，Playwright 负责生产预览冒烟测试；GitHub Actions 对 `dev`/`main` 的提交和 PR 执行完整验证

---

## 🔒 强制约束：AGENTS.md 同步更新规则

> **任何对本项目进行修改的 Coding Agent，都必须遵守以下规则：**

1. **修改代码后必须更新本文件**：当你对项目进行了任何实质性修改（新增/删除/重命名文件、修改架构、更改依赖、变更配置等），你**必须**同步更新 `AGENTS.md` 中对应的部分，确保其始终反映项目的最新状态。

2. **需要更新的章节**：
   - 新增/删除/重命名文件 → 更新「目录结构」
   - 修改组件逻辑或架构 → 更新「核心架构」
   - 添加/移除依赖 → 更新「技术栈」和「开发命令」
   - 修改样式/主题 → 更新「样式系统」
   - 修改部署配置 → 更新「部署配置」
   - 新增注意事项或发现 → 更新「注意事项」

3. **更新时机**：在你使用 `attempt_completion` 提交最终结果**之前**，必须先完成 `AGENTS.md` 的更新。

4. **保持精简**：更新时保持文档简洁，只记录对后续 Agent 理解项目有帮助的信息，避免冗余。
