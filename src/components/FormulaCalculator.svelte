<script lang="ts">
	import { onMount } from "svelte";
	import { evaluateSource, formatValue } from "../lib/evaluator";
	import { highlight } from "../lib/highlight";
	import { storageKey, sampleFormula, mathFunctions, mathConstants } from "../lib/constants";
	import type { LineResult } from "../lib/types";

	const BASE_URL = import.meta.env.BASE_URL.replace(/\/?$/, "");

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

	let helpDialogOpen = false;
	let showCopyToast = false;
	let copyToastText = "";

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
		let startPos = -1;

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
			const pairChar = pairs[targetChar];
			const direction = "([{".includes(targetChar) ? 1 : -1;

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

	function clearEditor() {
		source = "";
		localStorage.setItem(storageKey, source);
		queueMicrotask(() => {
			handleScroll();
			updateCursor();
		});
	}

	function openHelp() {
		helpDialogOpen = true;
	}

	function closeHelp() {
		helpDialogOpen = false;
	}

	function handleDialogOverlayClick(e: MouseEvent) {
		const target = e.target as HTMLElement;
		if (target.classList.contains("dialog-overlay")) {
			closeHelp();
		}
	}

	function copyValue(value: string) {
		navigator.clipboard.writeText(value).then(() => {
			copyToastText = `已复制: ${value}`;
			showCopyToast = true;
			setTimeout(() => {
				showCopyToast = false;
			}, 2000);
		}).catch(() => {
			copyToastText = "复制失败";
			showCopyToast = true;
			setTimeout(() => {
				showCopyToast = false;
			}, 2000);
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

	$: {
		const result = evaluateSource(source);
		lines = result.lines;
		lineResults = result.lineResults;
		variableSnapshot = result.variableSnapshot;
	}
</script>

<div class="mx-auto flex h-dvh w-full max-w-7xl flex-col gap-4 overflow-hidden px-4 py-4 md:px-6 lg:py-6">
	<header class="flex items-center justify-between rounded-box border border-base-300 bg-base-200 px-6 py-3 shadow-sm">
		<div class="flex items-center gap-3">
			<div class="flex h-10 w-10 items-center justify-center rounded-xl shadow-lg shadow-primary/20">
				<img src={BASE_URL + "/favicon.svg"} alt="Calcuko" class="h-8 w-8" />
			</div>
			<div>
				<h1 class="text-xl font-black tracking-tight">Calcuko</h1>
				<p class="text-xs font-medium text-base-content/50 uppercase tracking-widest">Multi-line Formula Calculator</p>
			</div>
		</div>
		
		<div class="flex items-center gap-2">
			<button class="btn btn-ghost btn-sm gap-1 normal-case" type="button" on:click={openHelp}>
				<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg>
				<span class="hidden sm:inline">帮助</span>
			</button>
			<a href="https://github.com/Nigh/calcuko" target="_blank" class="btn btn-ghost btn-sm gap-2 normal-case">
				<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"/><path d="M9 18c-4.51 2-5-2-7-2"/></svg>
				<span class="hidden sm:inline">Star on GitHub</span>
			</a>
		</div>
	</header>

	<section class="grid min-h-0 flex-1 gap-6 overflow-hidden xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
		<div class="card flex min-h-0 flex-col border border-base-300 bg-base-100 shadow-sm overflow-hidden">
			<!-- 编辑器标题栏 -->
			<div class="flex items-center justify-between border-b border-base-300 bg-base-50/50 px-5 py-3">
				<div class="flex items-center gap-2">
					<div class="h-2 w-2 rounded-full bg-success"></div>
					<h2 class="text-sm font-bold opacity-70">EDITOR</h2>
				</div>
				<div class="flex items-center gap-2">
					<button class="btn btn-ghost btn-xs gap-1 normal-case" type="button" on:click={resetSample} title="载入示例公式">
						<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M3 21v-5h5"/></svg>
						示例
					</button>
					<button class="btn btn-ghost btn-xs gap-1 normal-case text-error" type="button" on:click={clearEditor} title="清空编辑器">
						<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c0 1 2 1 2 2v2"/></svg>
						清除
					</button>
					<div class="badge badge-sm badge-outline font-mono opacity-50">UTF-8</div>
				</div>
			</div>

			<div class="grid min-h-0 flex-1 grid-cols-[48px_minmax(0,1fr)_minmax(160px,280px)] grid-rows-[1fr] overflow-hidden font-mono text-[13px] leading-6">
				<!-- 行号 -->
				<div bind:this={lineNumbers} class="select-none overflow-hidden border-r border-base-300 bg-base-200/40 px-2 py-4 text-right text-base-content/30">
					{#each lines as _, index}
						<div class="h-6">{index + 1}</div>
					{/each}
				</div>

				<!-- 核心编辑器容器 -->
				<div class="relative overflow-hidden bg-base-100">
					<div bind:this={backdrop} class="pointer-events-none absolute inset-0 overflow-auto whitespace-pre px-4 py-4 text-transparent transition-none" aria-hidden="true">
						{@html highlight(source, cursorPosition, matchedBracketIndex)}
					</div>

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

				<div bind:this={resultsPanel} class="overflow-hidden border-l border-base-300 bg-base-200/20 px-4 py-4">
					{#each lineResults as item}
						<div class:text-error={item.type === 'error'} class:text-success={item.type === 'success'} class:font-bold={item.varName} class="h-6 overflow-hidden text-ellipsis whitespace-nowrap opacity-90 hover:opacity-100" title={item.text}>
							{item.text || ' '}
						</div>
					{/each}
				</div>
			</div>
		</div>

		<div class="flex flex-col gap-6">
			<div class="card border border-base-300 bg-base-100 shadow-sm">
				<div class="card-body p-5">
					<div class="mb-2 flex items-center gap-2">
						<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-primary"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M9 15h6"/><path d="M9 11h6"/></svg>
						<h2 class="font-bold text-base-content/80">变量快照</h2>
					</div>
					<div class="rounded-xl bg-base-200/50 p-4">
						{#if Object.keys(variableSnapshot).length === 0}
							<p class="text-xs text-base-content/40 italic">暂无变量</p>
						{:else}
							<div class="flex flex-wrap gap-2">
								{#each Object.entries(variableSnapshot) as [name, value]}
									<button
										class="btn btn-ghost btn-xs h-auto min-h-0 gap-1 rounded-lg border border-base-300 px-2.5 py-1.5 text-xs font-mono normal-case hover:border-primary/40 hover:bg-primary/5"
										type="button"
										on:click={() => copyValue(formatValue(value))}
										title="点击复制值"
									>
										<span class="font-semibold text-base-content/70">{name}</span>
										<span class="text-base-content/50">=</span>
										<span class="text-primary">{formatValue(value)}</span>
									</button>
								{/each}
							</div>
						{/if}
					</div>
				</div>
			</div>
		</div>
	</section>
</div>

<!-- 帮助弹窗 Modal -->
{#if helpDialogOpen}
	<div class="dialog-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" on:click={handleDialogOverlayClick} role="dialog" aria-modal="true">
		<div class="mx-4 max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-base-300 bg-base-100 shadow-2xl">
			<div class="sticky top-0 z-10 flex items-center justify-between border-b border-base-300 bg-base-100 px-6 py-4">
				<div class="flex items-center gap-2">
					<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-primary"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg>
					<h2 class="text-lg font-bold">帮助</h2>
				</div>
				<button class="btn btn-ghost btn-sm btn-square" type="button" on:click={closeHelp}>
					<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
				</button>
			</div>

			<div class="space-y-6 px-6 py-5">
				<div>
					<h3 class="mb-3 text-sm font-bold uppercase tracking-wider text-base-content/50">基本用法</h3>
					<ul class="space-y-2 text-sm leading-relaxed text-base-content/70">
						<li class="flex gap-2">
							<span class="text-primary font-bold">1.</span>
							<span>赋值：使用 <code class="rounded bg-base-200 px-1.5 py-0.5 font-mono text-xs">x = 10</code> 定义变量。</span>
						</li>
						<li class="flex gap-2">
							<span class="text-primary font-bold">2.</span>
							<span>求值：直接输入表达式如 <code class="rounded bg-base-200 px-1.5 py-0.5 font-mono text-xs">sin(PI/2)</code>。</span>
						</li>
						<li class="flex gap-2">
							<span class="text-primary font-bold">3.</span>
							<span>注释：支持 <code class="rounded bg-base-200 px-1.5 py-0.5 font-mono text-xs">//</code> 开头的行注释。</span>
						</li>
						<li class="flex gap-2">
							<span class="text-primary font-bold">4.</span>
							<span>函数：内置 Math 所有常用函数和常量。</span>
						</li>
						<li class="flex gap-2">
							<span class="text-primary font-bold">5.</span>
							<span>词缀：支持 SI 词缀如 <code class="rounded bg-base-200 px-1.5 py-0.5 font-mono text-xs">10k</code> <code class="rounded bg-base-200 px-1.5 py-0.5 font-mono text-xs">4.7u</code> <code class="rounded bg-base-200 px-1.5 py-0.5 font-mono text-xs">100n</code>。</span>
						</li>
						<li class="flex gap-2">
							<span class="text-primary font-bold">6.</span>
							<span>空格：行内空格会被忽略，支持自由格式输入。</span>
						</li>
						<li class="flex gap-2">
							<span class="text-primary font-bold">7.</span>
							<span>隐式乘法：<code class="rounded bg-base-200 px-1.5 py-0.5 font-mono text-xs">2PI</code> <code class="rounded bg-base-200 px-1.5 py-0.5 font-mono text-xs">10kOhm</code> 自动展开。</span>
						</li>
						<li class="flex gap-2">
							<span class="text-primary font-bold">8.</span>
							<span>进制：支持 <code class="rounded bg-base-200 px-1.5 py-0.5 font-mono text-xs">0xFF</code>（十六进制）<code class="rounded bg-base-200 px-1.5 py-0.5 font-mono text-xs">0b1010</code>（二进制）<code class="rounded bg-base-200 px-1.5 py-0.5 font-mono text-xs">077</code>（八进制）。使用 <code class="rounded bg-base-200 px-1.5 py-0.5 font-mono text-xs">hex()</code> <code class="rounded bg-base-200 px-1.5 py-0.5 font-mono text-xs">bin()</code> <code class="rounded bg-base-200 px-1.5 py-0.5 font-mono text-xs">oct()</code> 转换结果进制。</span>
						</li>
					</ul>
				</div>

				<div>
					<h3 class="mb-3 text-sm font-bold uppercase tracking-wider text-base-content/50">常用函数</h3>
					<div class="grid grid-cols-2 gap-2">
						{#each Object.entries(mathFunctions) as [name, desc]}
							<div class="rounded-lg bg-base-200/50 px-3 py-2">
								<div class="font-mono text-xs font-bold text-primary">{name}</div>
								<div class="mt-0.5 text-xs text-base-content/50">{desc}</div>
							</div>
						{/each}
					</div>
				</div>

				<div>
					<h3 class="mb-3 text-sm font-bold uppercase tracking-wider text-base-content/50">常量</h3>
					<div class="flex gap-3">
						{#each Object.entries(mathConstants) as [name, desc]}
							<div class="flex-1 rounded-lg bg-base-200/50 px-3 py-2">
								<div class="font-mono text-xs font-bold text-primary">{name}</div>
								<div class="mt-0.5 text-xs text-base-content/50">{desc}</div>
							</div>
						{/each}
					</div>
				</div>
			</div>

			<div class="border-t border-base-300 px-6 py-4">
				<button class="btn btn-primary btn-block" type="button" on:click={closeHelp}>
					知道了
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- 复制成功 Toast -->
{#if showCopyToast}
	<div class="toast toast-top toast-end z-[60]">
		<div class="alert alert-success flex items-center gap-2 shadow-lg">
			<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
			<span class="text-sm">{copyToastText}</span>
		</div>
	</div>
{/if}

<style>
	:global(.token-comment) { color: #94a3b8; font-style: italic; }
	:global(.token-number) { color: #f59e0b; }
	:global(.token-operator) { color: #ec4899; font-weight: bold; }
	:global(.token-bracket) { color: #6366f1; }
	:global(.token-variable) { color: #0ea5e9; }

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

	.toast {
		animation: toast-in 0.3s ease-out;
	}

	@keyframes toast-in {
		from {
			opacity: 0;
			transform: translateY(-0.5rem);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}
</style>
