<script lang="ts">
	import { onMount } from "svelte";
	const sampleFormula = `Vo = 13
Vref = 2.5
R1 = 11
R2 = 2.87
R3 = 10

// 这是一个纯表达式
Vref / (Vo - Vref) * R1

a = Vref / (Vo - Vref) * R1
Rt = a * R2 / (R2 - a) - R3

// 隐式乘法：数字后直接接变量名
Omega = 2PI*R1 + 3R2

// SI 词缀示例（也支持隐式乘法）
R = 10k
C = 100n
f = 1/(2PI*R*C)`;

	const storageKey = "calcuko-formulas";

	type LineResult = {
		type: "empty" | "success" | "error";
		text: string;
		varName?: string;
	};

	const SI_MAP: Record<string, number> = {
		T: 1e12,
		G: 1e9,
		M: 1e6,
		k: 1e3,
		m: 1e-3,
		u: 1e-6,
		n: 1e-9,
		p: 1e-12,
	};

	function expandSiSuffixes(expr: string, scope: Record<string, unknown>): { expanded: string; hasSi: boolean } {
		let hasSi = false;
		// 按词缀长度降序排列，长词缀优先匹配
		const siEntries = Object.entries(SI_MAP).sort((a, b) => b[0].length - a[0].length);

		const expanded = expr.replace(
			/(\d*\.?\d+)([A-Za-z_$][\w$]*)/g,
			(_match, num: string, ident: string) => {
				// Stage 1: 完整标识符为已知变量/常量 → 隐式乘法
				if (ident in scope) {
					return `(${num}*${ident})`;
				}

				// Stage 2: 检查是否为 SI 词缀(+后续变量)
				for (const [siSuffix, factor] of siEntries) {
					if (ident.startsWith(siSuffix)) {
						const rest = ident.slice(siSuffix.length);
						if (rest === '') {
							// 纯 SI 词缀: 10k → (10*1000)
							hasSi = true;
							return `(${num}*${factor})`;
						} else if (/^[A-Za-z_$][\w$]*$/.test(rest)) {
							// SI 词缀 + 变量: 10kOhm → (10*0.001*Ohm)
							hasSi = true;
							return `(${num}*${factor}*${rest})`;
						}
					}
				}

				// Stage 3: 兜底隐式乘法（eval 时若 ident 不存在会报 ReferenceError）
				return `(${num}*${ident})`;
			},
		);
		return { expanded, hasSi };
	}

	function formatValueWithSi(value: number): string {
		if (value === 0) return "0";
		const absValue = Math.abs(value);
		const suffixes: [number, string][] = [
			[1e12, "T"],
			[1e9, "G"],
			[1e6, "M"],
			[1e3, "k"],
			[1e-3, "m"],
			[1e-6, "u"],
			[1e-9, "n"],
			[1e-12, "p"],
		];

		for (const [threshold, suffix] of suffixes) {
			const normalized = absValue / threshold;
			if (normalized >= 1 && normalized < 1000) {
				const roundedStr = (value / threshold).toFixed(4);
				const rounded = Number(roundedStr);
				// 回环校验：如果取整后的值无法还原原值，说明精度丢失，回退到标准格式
				if (Math.abs(rounded * threshold - value) > 1e-9 * Math.max(1, value)) {
					return formatValue(value);
				}
				return `${Number(roundedStr)}${suffix}`;
			}
		}

		return formatValue(value);
	}

	const mathContext = {
		abs: Math.abs,
		acos: Math.acos,
		asin: Math.asin,
		atan: Math.atan,
		ceil: Math.ceil,
		cos: Math.cos,
		exp: Math.exp,
		floor: Math.floor,
		log: Math.log,
		max: Math.max,
		min: Math.min,
		pow: Math.pow,
		round: Math.round,
		sin: Math.sin,
		sqrt: Math.sqrt,
		tan: Math.tan,
		PI: Math.PI,
		E: Math.E,
	};

	let source = sampleFormula;
	let lineNumbers: HTMLDivElement | undefined;
	let textarea: HTMLTextAreaElement | undefined;
	let backdrop: HTMLDivElement | undefined;
	let resultsPanel: HTMLDivElement | undefined;
	let variableSnapshot: Record<string, unknown> = {};
	let lineResults: LineResult[] = [];
	let lines: string[] = [];

	let cursorPosition = 0;
	let matchedBracketIndex: number | null = null;

	function formatValue(value: unknown) {
		if (typeof value === "number") {
			if (Number.isNaN(value)) return "NaN";
			if (!Number.isFinite(value)) return String(value);
			// 限制小数位数
			if (!Number.isInteger(value)) {
				return Number(value.toFixed(4)).toString();
			}
		}

		if (typeof value === "string") return JSON.stringify(value);
		if (typeof value === "undefined") return "undefined";

		try {
			return JSON.stringify(value);
		} catch {
			return String(value);
		}
	}

	function evaluateSource(input: string) {
		const normalized = input.replace(/\r\n?/g, "\n");
		const nextLines = normalized.split("\n");
		const scope: Record<string, unknown> = { ...mathContext };
		const nextLineResults: LineResult[] = [];
		const nextSnapshot: Record<string, unknown> = {};

		for (const rawLine of nextLines) {
			let line = rawLine.trim();

			if (!line || line.startsWith("//")) {
				nextLineResults.push({ type: "empty", text: "" });
				continue;
			}

			// 分离行内注释
			const commentIdx = line.indexOf("//");
			if (commentIdx !== -1) {
				line = line.slice(0, commentIdx).trim();
			}

			if (!line) {
				nextLineResults.push({ type: "empty", text: "" });
				continue;
			}

			// 忽略行内空格
			line = line.replace(/\s+/g, "");

			// 展开 SI 词缀（传入 scope 以检查已知变量名）
			const { expanded, hasSi } = expandSiSuffixes(line, scope);

			const assignmentMatch = expanded.match(/^([A-Za-z_$][\w$]*)=(.+)$/);

			let name: string | undefined;
			let expression: string;

			if (assignmentMatch) {
				[, name, expression] = assignmentMatch;
			} else {
				expression = expanded;
			}

			try {
				const evaluator = new Function(
					"scope",
					`with (scope) { return (${expression}); }`,
				) as (scope: Record<string, unknown>) => unknown;

				const value = evaluator(scope);
				if (name) {
					scope[name] = value;
					nextSnapshot[name] = value;
					const displayValue = hasSi && typeof value === "number" ? formatValueWithSi(value) : formatValue(value);
					nextLineResults.push({ 
						type: "success", 
						text: `${name} = ${displayValue}`,
						varName: name
					});
				} else {
					const displayValue = hasSi && typeof value === "number" ? formatValueWithSi(value) : formatValue(value);
					nextLineResults.push({ 
						type: "success", 
						text: displayValue,
					});
				}
			} catch (error) {
				nextLineResults.push({
					type: "error",
					text: error instanceof Error ? error.message : String(error),
				});
			}
		}

		lines = nextLines;
		lineResults = nextLineResults;
		variableSnapshot = nextSnapshot;
	}

	$: evaluateSource(source);

	function handleInput() {
		localStorage.setItem(storageKey, source);
		updateCursor();
	}

	function handleScroll() {
		if (!textarea) return;
		const { scrollTop, scrollLeft } = textarea;
		if (lineNumbers) lineNumbers.scrollTop = scrollTop;
		if (resultsPanel) resultsPanel.scrollTop = scrollTop;
		if (backdrop) {
			backdrop.scrollTop = scrollTop;
			backdrop.scrollLeft = scrollLeft;
		}
	}

	function updateCursor() {
		if (!textarea) return;
		cursorPosition = textarea.selectionStart;
		findMatchedBracket();
	}

	function findMatchedBracket() {
		matchedBracketIndex = null;
		if (!source) return;

		const charAtCursor = source[cursorPosition];
		const charBeforeCursor = source[cursorPosition - 1];

		let targetChar = "";
		let direction = 0;
		let startPos = -1;
		let pairChar = "";

		const pairs: Record<string, string> = {
			"(": ")",
			")": "(",
			"[": "]",
			"]": "[",
			"{": "}",
			"}": "{",
		};

		if (pairs[charAtCursor]) {
			startPos = cursorPosition;
			targetChar = charAtCursor;
		} else if (pairs[charBeforeCursor]) {
			startPos = cursorPosition - 1;
			targetChar = charBeforeCursor;
		}

		if (startPos !== -1) {
			pairChar = pairs[targetChar];
			direction = "([{".includes(targetChar) ? 1 : -1;

			let depth = 0;
			for (let i = startPos; i >= 0 && i < source.length; i += direction) {
				if (source[i] === targetChar) depth++;
				else if (source[i] === pairChar) depth--;

				if (depth === 0) {
					matchedBracketIndex = i;
					break;
				}
			}
		}
	}

	function resetSample() {
		source = sampleFormula;
		localStorage.setItem(storageKey, source);
		queueMicrotask(() => {
			handleScroll();
			updateCursor();
		});
	}

	onMount(() => {
		const saved = typeof localStorage !== "undefined" ? localStorage.getItem(storageKey) : null;
		if (saved) {
			source = saved;
		}
		queueMicrotask(() => {
			handleScroll();
			updateCursor();
		});
	});

	// 语法高亮逻辑
	function highlight(text: string, currentIdx: number) {
		// 正则匹配
		// 1. 注释: // ...
		// 2. 数值: \d+(\.\d+)?
		// 3. 运算符: [+*/=-]
		// 4. 变量/关键字: [A-Za-z_$][\w$]*
		// 5. 括号: [()\[\]{}]
		
		const tokens = [
			{ type: 'comment', regex: /\/\/.*/ },
			{ type: 'number', regex: /\d*\.?\d+[TGMkmunp]/ },
			{ type: 'number', regex: /\d*\.?\d+/ },
			{ type: 'operator', regex: /[+\-*/=<>!&|^%]+/ },
			{ type: 'bracket', regex: /[()\[\]{}]/ },
			{ type: 'variable', regex: /[A-Za-z_$][\w$]*/ },
		];

		let result = "";
		let lastIdx = 0;
		
		// 简单的手动扫描或复杂的正则拆分
		// 为了支持匹配括号高亮，我们需要知道每个 token 的原始位置
		// 这里用一个简单的循环来构建 HTML
		
		let i = 0;
		while (i < text.length) {
			let matched = false;
			
			// 检查是否是匹配的括号
			if (i === currentIdx || i === matchedBracketIndex) {
				const char = text[i];
				if ("()[]{}".includes(char)) {
					const escapedChar = char === '&' ? '&' : (char === '<' ? '<' : (char === '>' ? '>' : char));
					result += `<span class="bg-primary/30 text-primary font-bold underline">${escapedChar}</span>`;
					i++;
					matched = true;
					continue;
				}
			}

			for (const token of tokens) {
				const substr = text.slice(i);
				const m = substr.match(token.regex);
				if (m && substr.indexOf(m[0]) === 0) {
					let content = m[0];
					let displayContent = content.replace(/&/g, "&").replace(/</g, "<").replace(/>/g, ">");
					
					result += `<span class="token-${token.type}">${displayContent}</span>`;
					i += content.length;
					matched = true;
					break;
				}
			}

			if (!matched) {
				const char = text[i];
				result += char === '&' ? '&' : (char === '<' ? '<' : (char === '>' ? '>' : char));
				i++;
			}
		}

		return result + "\n"; // 补一个换行确保对齐
	}
</script>

<div class="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-4 px-4 py-4 md:px-6 lg:py-6">
	<!-- 紧凑的 Header -->
	<header class="flex items-center justify-between rounded-box border border-base-300 bg-base-200 px-6 py-3 shadow-sm">
		<div class="flex items-center gap-3">
			<div class="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-content shadow-lg shadow-primary/20">
				<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect width="16" height="20" x="4" y="2" rx="2"/><line x1="8" x2="16" y1="6" y2="6"/><line x1="16" x2="16" y1="14" y2="18"/><path d="M16 10h.01"/><path d="M12 10h.01"/><path d="M8 10h.01"/><path d="M12 14h.01"/><path d="M8 14h.01"/><path d="M12 18h.01"/><path d="M8 18h.01"/></svg>
			</div>
			<div>
				<h1 class="text-xl font-black tracking-tight">Calcuko</h1>
				<p class="text-xs font-medium text-base-content/50 uppercase tracking-widest">Multi-line Formula Calculator</p>
			</div>
		</div>
		
		<div class="flex items-center gap-2">
			<a href="https://github.com/Nigh/calcuko" target="_blank" class="btn btn-ghost btn-sm gap-2 normal-case">
				<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"/><path d="M9 18c-4.51 2-5-2-7-2"/></svg>
				<span class="hidden sm:inline">Star on GitHub</span>
			</a>
		</div>
	</header>

	<section class="grid flex-1 gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
		<div class="card flex flex-col border border-base-300 bg-base-100 shadow-sm overflow-hidden">
			<!-- 编辑器标题栏 -->
			<div class="flex items-center justify-between border-b border-base-300 bg-base-50/50 px-5 py-3">
				<div class="flex items-center gap-2">
					<div class="h-2 w-2 rounded-full bg-success"></div>
					<h2 class="text-sm font-bold opacity-70">EDITOR</h2>
				</div>
				<div class="badge badge-sm badge-outline font-mono opacity-50">UTF-8</div>
			</div>

			<div class="grid flex-1 grid-cols-[48px_minmax(0,1fr)_minmax(160px,280px)] font-mono text-[13px] leading-6">
				<!-- 行号 -->
				<div bind:this={lineNumbers} class="select-none overflow-hidden border-r border-base-300 bg-base-200/40 px-2 py-4 text-right text-base-content/30">
					{#each lines as _, index}
						<div class="h-6">{index + 1}</div>
					{/each}
				</div>

				<!-- 核心编辑器容器 -->
				<div class="relative overflow-hidden bg-base-100">
					<!-- 背景高亮层 -->
					<div 
						bind:this={backdrop}
						class="pointer-events-none absolute inset-0 overflow-auto whitespace-pre px-4 py-4 text-transparent transition-none"
						aria-hidden="true"
					>
						{@html highlight(source, cursorPosition)}
					</div>

					<!-- 输入层 -->
					<textarea
						bind:this={textarea}
						bind:value={source}
						class="absolute inset-0 z-10 block h-full w-full resize-none overflow-auto border-none bg-transparent px-4 py-4 text-transparent caret-primary outline-none"
						placeholder="输入公式，例如：&#10;a = 12&#10;b = a * 3&#10;sqrt(b)"
						spellcheck="false"
						on:input={handleInput}
						on:scroll={handleScroll}
						on:click={updateCursor}
						on:keyup={updateCursor}
					></textarea>
				</div>

				<!-- 结果面板 -->
				<div bind:this={resultsPanel} class="overflow-hidden border-l border-base-300 bg-base-200/20 px-4 py-4">
					{#each lineResults as item}
						<div 
							class:text-error={item.type === 'error'} 
							class:text-success={item.type === 'success'} 
							class:font-bold={item.varName}
							class="h-6 overflow-hidden text-ellipsis whitespace-nowrap opacity-90 transition-opacity hover:opacity-100"
							title={item.text}
						>
							{item.text || ' '}
						</div>
					{/each}
				</div>
			</div>
		</div>

		<!-- 右侧面板 -->
		<div class="flex flex-col gap-6">
			<div class="card border border-base-300 bg-base-100 shadow-sm">
				<div class="card-body p-5">
					<div class="mb-2 flex items-center gap-2">
						<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-primary"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M9 15h6"/><path d="M9 11h6"/></svg>
						<h2 class="font-bold text-base-content/80">变量快照</h2>
					</div>
					<div class="rounded-xl bg-base-200/50 p-4">
						<pre class="max-h-[240px] overflow-auto font-mono text-xs leading-5 text-base-content/70">{JSON.stringify(variableSnapshot, null, 2)}</pre>
					</div>
				</div>
			</div>

			<div class="card border border-base-300 bg-base-100 shadow-sm">
				<div class="card-body p-5">
					<div class="mb-2 flex items-center gap-2">
						<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-primary"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
						<h2 class="font-bold text-base-content/80">快速帮助</h2>
					</div>
					<ul class="space-y-2 text-xs leading-relaxed text-base-content/60">
						<li class="flex gap-2">
							<span class="text-primary font-bold">1.</span>
							<span>赋值：使用 <code>x = 10</code> 定义变量。</span>
						</li>
						<li class="flex gap-2">
							<span class="text-primary font-bold">2.</span>
							<span>求值：直接输入表达式如 <code>sin(PI/2)</code>。</span>
						</li>
						<li class="flex gap-2">
							<span class="text-primary font-bold">3.</span>
							<span>注释：支持 <code>//</code> 开头的行注释。</span>
						</li>
					<li class="flex gap-2">
						<span class="text-primary font-bold">4.</span>
						<span>函数：内置 Math 所有常用函数和常量。</span>
					</li>
					<li class="flex gap-2">
						<span class="text-primary font-bold">5.</span>
						<span>词缀：支持 SI 词缀如 <code>10k</code> <code>4.7u</code> <code>100n</code>。</span>
					</li>
					<li class="flex gap-2">
						<span class="text-primary font-bold">6.</span>
						<span>空格：行内空格会被忽略，支持自由格式输入。</span>
					</li>
					<li class="flex gap-2">
						<span class="text-primary font-bold">7.</span>
						<span>隐式乘法：<code>2PI</code> <code>10kOhm</code> 自动展开。</span>
					</li>
					</ul>
					<div class="mt-4 border-t border-base-300 pt-4">
						<button class="btn btn-primary btn-sm btn-block" type="button" on:click={resetSample}>
							<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mr-1"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M3 21v-5h5"/></svg>
							恢复示例
						</button>
					</div>
				</div>
			</div>
		</div>
	</section>
</div>

<style>
	/* 语法高亮颜色 */
	:global(.token-comment) { color: #94a3b8; font-style: italic; }
	:global(.token-number) { color: #f59e0b; }
	:global(.token-operator) { color: #ec4899; font-weight: bold; }
	:global(.token-bracket) { color: #6366f1; }
	:global(.token-variable) { color: #0ea5e9; }

	/* 隐藏滚动条但保持滚动功能 (针对 lineNumbers 和 resultsPanel) */
	div::-webkit-scrollbar {
		display: none;
	}
	div {
		-ms-overflow-style: none;
		scrollbar-width: none;
	}

	textarea {
		white-space: pre;
		word-wrap: normal;
	}
</style>
