<script lang="ts">
	import { onMount } from "svelte";
	import { basicSetup } from "codemirror";
	import { EditorState } from "@codemirror/state";
	import { EditorView } from "@codemirror/view";
	import { evaluateSource, formatValue } from "../lib/evaluator";
	import { storageKey, sampleFormula, sampleFormulaEnglish, mathFunctions, mathConstants } from "../lib/constants";
	import type { LineResult } from "../lib/types";
	import { isColorValue } from "../lib/builtins/colors";
	import { isMatrix } from "../lib/language/matrix";
	import { formatOptions, formatResult, type FormatOption, type ResultFormat, type ResultValueKind } from "../lib/resultFormatting";
	import { editorUiField, setEditorUi, syntaxDecorations } from "../lib/editorExtensions";
	import { calcukoAutocomplete } from "../lib/autocomplete";

	import { constantDescription, detectLocale, functionDescription, setLocale, t, type Locale } from "../lib/i18n";
	const BASE_URL = import.meta.env.BASE_URL.replace(/\/?$/, "");
	const APP_VERSION = import.meta.env.PUBLIC_APP_VERSION?.trim() || "dev";
	const formatStorageKey = "calcuko-result-formats";
	type StoredLineFormat = { lineText: string; kind: ResultValueKind; format: ResultFormat };

	const helpCode = (value: string) => `<code class="rounded bg-base-200 px-1.5 py-0.5 font-mono text-xs">${value}</code>`;
	let locale: Locale = "zh-CN";
	let source = sampleFormula;
	let editorHost: HTMLDivElement;
	let editorView: EditorView | undefined;
	let resultsPanel: HTMLDivElement | undefined;
	let helpCloseButton: HTMLButtonElement | undefined;
	let variableSnapshot: Record<string, unknown> = {};
	let lineResults: LineResult[] = [];
	let lines: string[] = [];
	let activeLine = 1;
	let hoverLine: number | null = null;
	let resultHeights: number[] = [];
	let lineFormats: Record<number, StoredLineFormat> = {};
	let formatMenuLine: number | null = null;
	let formatMenuPosition = { top: 0, left: 0 };
	let helpDialogOpen = false;
	let showCopyToast = false;
	let copyToastText = "";
	let undoSource: string | null = null;

	const persistFormats = () => localStorage.setItem(formatStorageKey, JSON.stringify({ source, formats: lineFormats }));
	function reconcileFormats(oldSource: string, nextSource: string) {
		const oldLines = oldSource.split("\n"), nextLines = nextSource.split("\n");
		const migrated: Record<number, StoredLineFormat> = {}, used = new Set<number>();
		for (const [key, stored] of Object.entries(lineFormats)) {
			const oldIndex = Number(key) - 1;
			const candidates = nextLines.map((text, index) => ({ text, index })).filter(({ text, index }) => text === stored.lineText && !used.has(index));
			let index = candidates.sort((a, b) => Math.abs(a.index - oldIndex) - Math.abs(b.index - oldIndex))[0]?.index;
			if (index === undefined && oldIndex < nextLines.length && nextLines[oldIndex].trim()) index = oldIndex;
			if (index !== undefined) { used.add(index); migrated[index + 1] = { ...stored, lineText: nextLines[index] }; }
		}
		lineFormats = migrated;
	}
	function cleanFormats() {
		let changed = false;
		const cleaned: Record<number, StoredLineFormat> = {};
		for (const [key, stored] of Object.entries(lineFormats)) {
			const index = Number(key) - 1, result = lineResults[index];
			if (lines[index]?.trim() && result?.type === "success" && result.valueKind === stored.kind) cleaned[index + 1] = { ...stored, lineText: lines[index] };
			else changed = true;
		}
		if (changed) { lineFormats = cleaned; if (typeof localStorage !== "undefined") persistFormats(); }
	}
	function dispatchEditorUi() {
		if (!editorView) return;
		editorView.dispatch({ effects: setEditorUi.of({ activeLine, hoverLine, errorLines: lineResults.flatMap((item, index) => item.type === "error" ? [index + 1] : []), resultHeights }) });
	}
	function replaceSource(next: string) {
		if (!editorView) { source = next; return; }
		editorView.dispatch({ changes: { from: 0, to: editorView.state.doc.length, insert: next } });
	}
	function resetSample() {
		if (!window.confirm(t("loadConfirm", {}, locale))) return;
		undoSource = source; replaceSource(locale === "zh-CN" ? sampleFormula : sampleFormulaEnglish);
	}
	function clearEditor() {
		if (!window.confirm(t("clearConfirm", {}, locale))) return;
		undoSource = source; lineFormats = {}; localStorage.removeItem(formatStorageKey); replaceSource("");
	}
	function toggleLocale() { locale = locale === "zh-CN" ? "en" : "zh-CN"; setLocale(locale); }
	function undoProgrammaticChange() { if (undoSource !== null) { const previous = source; replaceSource(undoSource); undoSource = previous; } }
	function openHelp() { helpDialogOpen = true; queueMicrotask(() => helpCloseButton?.focus()); }
	function closeHelp() { helpDialogOpen = false; queueMicrotask(() => editorView?.focus()); }
	function handleWindowClick() { formatMenuLine = null; }
	function toggleFormatMenu(event: MouseEvent, index: number) {
		if (!formatOptions(lineResults[index]?.value).length) return;
		if (formatMenuLine === index + 1) { formatMenuLine = null; return; }
		const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
		const width = 208, estimatedHeight = 340;
		formatMenuPosition = { left: Math.max(8, Math.min(window.innerWidth - width - 8, rect.right - width)), top: rect.bottom + estimatedHeight <= window.innerHeight ? rect.bottom + 4 : Math.max(8, rect.top - estimatedHeight - 4) };
		formatMenuLine = index + 1;
	}
	function syncResultsScroll() { if (editorView && resultsPanel && Math.abs(editorView.scrollDOM.scrollTop - resultsPanel.scrollTop) > 1) editorView.scrollDOM.scrollTop = resultsPanel.scrollTop; }
	function handleWindowKeydown(event: KeyboardEvent) { if (event.key === "Escape") { if (formatMenuLine !== null) formatMenuLine = null; else if (helpDialogOpen) closeHelp(); } }
	function handleDialogOverlayClick(event: MouseEvent) { if ((event.target as HTMLElement).classList.contains("dialog-overlay")) closeHelp(); }
	function copyValue(value: string) {
		navigator.clipboard.writeText(value).then(() => { copyToastText = t("copied", { value }, locale); showCopyToast = true; setTimeout(() => showCopyToast = false, 2000); }).catch(() => { copyToastText = t("copyFailed", {}, locale); showCopyToast = true; setTimeout(() => showCopyToast = false, 2000); });
	}
	function resultText(item: LineResult, format?: ResultFormat) { return item.type === "success" && item.value !== undefined ? formatResult(item.value, format, item.hasSi) : item.text; }
	function chooseFormat(index: number, option: FormatOption) {
		const item = lineResults[index]; if (item.value === undefined || !item.valueKind) return;
		lineFormats = { ...lineFormats, [index + 1]: { lineText: lines[index], kind: item.valueKind, format: { name: option.name, precision: option.precisionMode === "decimalPlaces" ? 4 : option.precisionMode ? 6 : undefined } } };
		persistFormats();
	}
	function choosePrecision(index: number, precision: number) {
		const stored = lineFormats[index + 1]; if (!stored) return;
		lineFormats = { ...lineFormats, [index + 1]: { ...stored, format: { ...stored.format, precision } } }; persistFormats();
	}
	function measureResult(node: HTMLElement, index: number) {
		const update = () => { const next = resultHeights.slice(); next[index] = Math.max(24, Math.ceil(node.getBoundingClientRect().height)); resultHeights = next; queueMicrotask(dispatchEditorUi); };
		const observer = new ResizeObserver(update); observer.observe(node); update();
		return { update(nextIndex: number) { index = nextIndex; update(); }, destroy() { observer.disconnect(); } };
	}

	onMount(() => {
		locale = detectLocale(); setLocale(locale, false);
		const saved = localStorage.getItem(storageKey); source = saved !== null ? saved : locale === "zh-CN" ? sampleFormula : sampleFormulaEnglish;
		try {
			const persisted = JSON.parse(localStorage.getItem(formatStorageKey) ?? "null");
			if (persisted?.formats) { lineFormats = persisted.formats; if (typeof persisted.source === "string" && persisted.source !== source) reconcileFormats(persisted.source, source); }
		} catch { localStorage.removeItem(formatStorageKey); }
		editorView = new EditorView({
			parent: editorHost,
			state: EditorState.create({ doc: source, extensions: [basicSetup, calcukoAutocomplete, editorUiField, syntaxDecorations, EditorView.theme({ "&": { height: "100%" }, ".cm-scroller": { overflow: "auto", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }, ".cm-line": { minHeight: "24px", lineHeight: "24px", padding: "0 16px" }, ".cm-content": { padding: "16px 0" }, ".cm-gutters": { backgroundColor: "color-mix(in oklab, var(--color-base-200) 40%, transparent)", borderRight: "1px solid var(--color-base-300)" }, ".cm-activeLine": { backgroundColor: "color-mix(in oklab, var(--color-primary) 10%, transparent)" }, ".cm-activeLineGutter": { backgroundColor: "color-mix(in oklab, var(--color-primary) 12%, transparent)" }, ".cm-result-hover-line": { backgroundColor: "color-mix(in oklab, var(--color-primary) 22%, transparent) !important", boxShadow: "inset 3px 0 var(--color-primary)" }, ".cm-error-line": { backgroundColor: "color-mix(in oklab, var(--color-error) 18%, transparent)", boxShadow: "inset 3px 0 var(--color-error)" } }) , EditorView.updateListener.of((update) => {
				if (update.docChanged) { const next = update.state.doc.toString(); reconcileFormats(source, next); source = next; localStorage.setItem(storageKey, source); persistFormats(); }
				if (update.docChanged || update.selectionSet) activeLine = update.state.doc.lineAt(update.state.selection.main.head).number;
				if (update.selectionSet) queueMicrotask(dispatchEditorUi);
			})] }),
		});
		const syncScroll = () => { if (resultsPanel && editorView) resultsPanel.scrollTop = editorView.scrollDOM.scrollTop; };
		editorView.scrollDOM.addEventListener("scroll", syncScroll, { passive: true });
		queueMicrotask(dispatchEditorUi);
		return () => editorView?.destroy();
	});

	$: {
		const result = evaluateSource(source, locale); lines = result.lines; lineResults = result.lineResults; variableSnapshot = result.variableSnapshot;
		cleanFormats();
		queueMicrotask(dispatchEditorUi);
	}
</script>

<svelte:window on:keydown={handleWindowKeydown} on:click={handleWindowClick} />

<div class="mx-auto flex h-dvh w-full max-w-7xl flex-col gap-4 overflow-hidden px-4 py-4 md:px-6 lg:py-6">
	<header class="flex items-center justify-between rounded-box border border-base-300 bg-base-200 px-6 py-3 shadow-sm">
		<div class="flex items-center gap-3">
			<div class="flex h-10 w-10 items-center justify-center rounded-xl shadow-lg shadow-primary/20">
				<img src={BASE_URL + "/favicon.svg"} alt="Calcuko" class="h-8 w-8" />
			</div>
			<div>
				<div class="flex items-end gap-1.5">
					<h1 class="text-xl font-black tracking-tight">Calcuko</h1>
					<span class="pb-0.5 font-mono text-[10px] leading-none text-base-content/40" aria-label={t("version", {}, locale) + " " + APP_VERSION}>{APP_VERSION}</span>
				</div>
				<p class="text-xs font-medium text-base-content/50 uppercase tracking-widest">{t("tagline", {}, locale)}</p>
			</div>
		</div>
		
		<div class="flex items-center gap-2">
			<button class="btn btn-ghost btn-sm font-mono" type="button" on:click={toggleLocale} aria-label={t("language", {}, locale)} title={t("switchLanguage", {}, locale)}>{locale === "zh-CN" ? "EN" : "中文"}</button>
			<button class="btn btn-ghost btn-sm gap-1 normal-case" type="button" on:click={openHelp}>
				<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg>
				<span class="hidden sm:inline">{t("help", {}, locale)}</span>
			</button>
			<a href="https://github.com/Nigh/calcuko" target="_blank" class="btn btn-ghost btn-sm gap-2 normal-case">
				<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"/><path d="M9 18c-4.51 2-5-2-7-2"/></svg>
				<span class="hidden sm:inline">{t("starGitHub", {}, locale)}</span>
			</a>
		</div>
	</header>

	<section class="grid min-h-0 flex-1 gap-6 overflow-hidden xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
		<div class="card flex min-h-0 flex-col border border-base-300 bg-base-100 shadow-sm overflow-hidden">
			<!-- 编辑器标题栏 -->
			<div class="flex items-center justify-between border-b border-base-300 bg-base-50/50 px-5 py-3">
				<div class="flex items-center gap-2">
					{#if undoSource !== null}<button class="btn btn-ghost btn-xs" type="button" on:click={undoProgrammaticChange} title={t("undoTitle", {}, locale)}>{t("undo", {}, locale)}</button>{/if}
					<div class="h-2 w-2 rounded-full bg-success"></div>
					<h2 class="text-sm font-bold opacity-70">EDITOR</h2>
				</div>
				<div class="flex items-center gap-2">
					<button class="btn btn-ghost btn-xs gap-1 normal-case" type="button" on:click={resetSample} title={t("sampleTitle", {}, locale)}>
						<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M3 21v-5h5"/></svg>
						{t("sample", {}, locale)}
					</button>
					<button class="btn btn-ghost btn-xs gap-1 normal-case text-error" type="button" on:click={clearEditor} title={t("clearTitle", {}, locale)}>
						<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c0 1 2 1 2 2v2"/></svg>
						{t("clear", {}, locale)}
					</button>
					<div class="badge badge-sm badge-outline font-mono opacity-50">UTF-8</div>
				</div>
			</div>

			<div class="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_minmax(180px,320px)] overflow-hidden font-mono text-[13px] leading-6">
				<div bind:this={editorHost} class="min-h-0 overflow-hidden bg-base-100" aria-label={t("editorLabel", {}, locale)}></div>

				<div bind:this={resultsPanel} class="relative overflow-auto border-l border-base-300 bg-base-200/20 py-4" on:scroll={syncResultsScroll}>
					{#each lineResults as item, index}
						<div
							use:measureResult={index}
							class:result-active={activeLine === index + 1}
							class:result-hover={hoverLine === index + 1}
							class:result-error={item.type === "error"}
							class="result-row relative min-h-6 px-4"
							data-result-line={index + 1}
							on:mouseenter={() => { hoverLine = index + 1; dispatchEditorUi(); }}
							on:mouseleave={() => { hoverLine = null; dispatchEditorUi(); }}
						>
							{#if item.type === "success" && item.value !== undefined}
								<button
									type="button"
									class="block min-h-6 w-full overflow-hidden text-left text-success outline-none"
									class:cursor-pointer={formatOptions(item.value).length > 0}
									on:click={(event) => toggleFormatMenu(event, index)}
									aria-haspopup={formatOptions(item.value).length ? "menu" : undefined}
									aria-expanded={formatMenuLine === index + 1}
									on:click|stopPropagation
									title={resultText(item, lineFormats[index + 1]?.format)}
								>
									{#if item.preview?.type === "color"}<span class="mr-1 inline-block h-3 w-3 rounded-sm border border-base-content/20 align-middle" style:background={item.preview.css} aria-label={t("colorPreview", {}, locale)}></span>{/if}
									{#if isMatrix(item.value)}
										<div class="matrix-result inline-flex max-w-full items-stretch align-top">
											<span class="matrix-bracket matrix-bracket-left" aria-hidden="true"></span>
											<div class="matrix-values max-h-[304px] min-w-0 overflow-auto px-1.5">
												<table class="w-max border-separate border-spacing-x-3 border-spacing-y-0.5 text-right">
													<tbody>{#each item.value.rows as row}<tr>{#each row as cell}<td class="whitespace-nowrap">{formatValue(cell)}</td>{/each}</tr>{/each}</tbody>
												</table>
											</div>
											<span class="matrix-bracket matrix-bracket-right" aria-hidden="true"></span>
										</div>
									{:else}{resultText(item, lineFormats[index + 1]?.format)}{/if}
								</button>
							{:else if item.type === "error"}
								<div class="min-h-6 overflow-hidden text-ellipsis whitespace-nowrap font-semibold text-error" title={item.text}>{item.text}</div>
							{:else}<div class="h-6">&nbsp;</div>{/if}
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
						<h2 class="font-bold text-base-content/80">{t("variables", {}, locale)}</h2>
					</div>
					<div class="rounded-xl bg-base-200/50 p-4">
						{#if Object.keys(variableSnapshot).length === 0}
							<p class="text-xs text-base-content/40 italic">{t("noVariables", {}, locale)}</p>
						{:else}
							<div class="flex flex-wrap gap-2">
								{#each Object.entries(variableSnapshot) as [name, value]}
									<button
										class="btn btn-ghost btn-xs h-auto min-h-0 gap-1 rounded-lg border border-base-300 px-2.5 py-1.5 text-xs font-mono normal-case hover:border-primary/40 hover:bg-primary/5"
										type="button"
										on:click={() => copyValue(formatValue(value))}
										title={t("copyValue", {}, locale)}
									>
										{#if isColorValue(value)}<span class="inline-block h-3 w-3 rounded-sm border border-base-content/20" style:background={value.css} aria-label={t("colorPreview", {}, locale)}></span>{/if}
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

{#if formatMenuLine !== null && lineResults[formatMenuLine - 1]?.value !== undefined}
	{@const menuIndex = formatMenuLine - 1}
	{@const menuItem = lineResults[menuIndex]}
	{@const menuOptions = formatOptions(menuItem.value)}
	{@const selectedOption = menuOptions.find((option) => option.name === lineFormats[formatMenuLine!]?.format.name)}
	<div
		class="format-menu fixed z-[100] w-52 rounded-box border border-base-300 bg-base-100 p-2 shadow-2xl"
		style:top={`${formatMenuPosition.top}px`}
		style:left={`${formatMenuPosition.left}px`}
		role="menu"
		on:click|stopPropagation
	>
		<div class="mb-1 px-2 text-[11px] font-bold uppercase tracking-wide text-base-content/50">{t("resultFormat", {}, locale)}</div>
		{#each menuOptions as option}
			<button type="button" class:format-selected={(lineFormats[formatMenuLine!]?.format.name ?? "default") === option.name} class="block w-full rounded px-2 py-1 text-left hover:bg-primary/15" role="menuitem" on:click={() => chooseFormat(menuIndex, option)}>{option.label}</button>
		{/each}
		{#if selectedOption?.precisionMode}
			<div class="mt-2 border-t border-base-300 pt-2">
				<div class="px-2 text-[11px] text-base-content/50">{selectedOption.precisionMode === "decimalPlaces" ? t("decimalPlaces", {}, locale) : t("significantDigits", {}, locale)}</div>
				<div class="mt-1 flex flex-wrap gap-1 px-2">
					{#each selectedOption.precisionMode === "decimalPlaces" ? [0,2,4,6,8,12] : [3,4,6,8,12,16,34] as precision}
						<button type="button" class:btn-primary={lineFormats[formatMenuLine!]?.format.precision === precision} class="btn btn-xs" on:click={() => choosePrecision(menuIndex, precision)}>{precision}</button>
					{/each}
				</div>
			</div>
		{/if}
	</div>
{/if}

<!-- 帮助弹窗 Modal -->
{#if helpDialogOpen}
	<div class="dialog-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" on:click={handleDialogOverlayClick} role="dialog" aria-modal="true">
		<div class="mx-4 max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-base-300 bg-base-100 shadow-2xl">
			<div class="sticky top-0 z-10 flex items-center justify-between border-b border-base-300 bg-base-100 px-6 py-4">
				<div class="flex items-center gap-2">
					<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-primary"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg>
					<h2 class="text-lg font-bold">{t("help", {}, locale)}</h2>
				</div>
				<button bind:this={helpCloseButton} class="btn btn-ghost btn-sm btn-square" type="button" on:click={closeHelp} aria-label={t("closeHelp", {}, locale)}>
					<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
				</button>
			</div>

			<div class="space-y-6 px-6 py-5">
				<div>
					<h3 class="mb-3 text-sm font-bold uppercase tracking-wider text-base-content/50">{t("basics", {}, locale)}</h3>
					<ul class="space-y-2 text-sm leading-relaxed text-base-content/70">
						<li class="flex gap-2">
							<span class="text-primary font-bold">1.</span>
							<span>{@html t("helpAssignment", { code: helpCode("x = 10") }, locale)}</span>
						</li>
						<li class="flex gap-2">
							<span class="text-primary font-bold">2.</span>
							<span>{@html t("helpEvaluation", { code: helpCode("sin(PI/2)") }, locale)}</span>
						</li>
						<li class="flex gap-2">
							<span class="text-primary font-bold">3.</span>
							<span>{@html t("helpComment", { line: helpCode("//"), division: helpCode("//") }, locale)}</span>
						</li>
						<li class="flex gap-2">
							<span class="text-primary font-bold">4.</span>
							<span>{t("helpFunctions", {}, locale)}</span>
						</li>
						<li class="flex gap-2">
							<span class="text-primary font-bold">5.</span>
							<span>{@html t("helpSi", { codes: [helpCode("10k"), helpCode("4.7u"), helpCode("100n")].join(" ") }, locale)}</span>
						</li>
						<li class="flex gap-2">
							<span class="text-primary font-bold">6.</span>
							<span>{t("helpSpaces", {}, locale)}</span>
						</li>
						<li class="flex gap-2">
							<span class="text-primary font-bold">7.</span>
							<span>{@html t("helpImplicit", { codes: [helpCode("2PI"), helpCode("10kOhm")].join(" ") }, locale)}</span>
						</li>
						<li class="flex gap-2">
							<span class="text-primary font-bold">8.</span>
							<span>{@html t("helpRadix", { hex: helpCode("0xFF"), bin: helpCode("0b1010"), oct: helpCode("077"), functions: [helpCode("hex()"), helpCode("bin()"), helpCode("oct()")].join(" ") }, locale)}</span>
						</li>
					</ul>
				</div>

				<div>
					<h3 class="mb-3 text-sm font-bold uppercase tracking-wider text-base-content/50">{t("commonFunctions", {}, locale)}</h3>
					<div class="grid grid-cols-2 gap-2">
						{#each Object.entries(mathFunctions) as [name, desc]}
							<div class="rounded-lg bg-base-200/50 px-3 py-2">
								<div class="font-mono text-xs font-bold text-primary">{name}</div>
								<div class="mt-0.5 text-xs text-base-content/50">{functionDescription(name, desc, locale)}</div>
							</div>
						{/each}
					</div>
				</div>

				<div>
					<h3 class="mb-3 text-sm font-bold uppercase tracking-wider text-base-content/50">{t("constants", {}, locale)}</h3>
					<div class="flex gap-3">
						{#each Object.entries(mathConstants) as [name, desc]}
							<div class="flex-1 rounded-lg bg-base-200/50 px-3 py-2">
								<div class="font-mono text-xs font-bold text-primary">{name}</div>
								<div class="mt-0.5 text-xs text-base-content/50">{constantDescription(name, desc, locale)}</div>
							</div>
						{/each}
					</div>
				</div>
			</div>

			<div class="border-t border-base-300 px-6 py-4">
				<button class="btn btn-primary btn-block" type="button" on:click={closeHelp}>
					{t("gotIt", {}, locale)}
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
	:global(.token-string) { color: #10b981; }
	:global(.token-operator) { color: #ec4899; font-weight: bold; }
	:global(.token-bracket) { color: #6366f1; }
	:global(.token-variable) { color: #0ea5e9; }
	:global(.token-builtin-function) { color: #a78bfa; font-weight: 600; }
	:global(.token-user-function) { color: #22d3ee; font-weight: 600; }
	:global(.token-unknown) { color: var(--color-error); font-weight: bold; text-decoration: underline wavy; }
	:global(.token-error) { color: var(--color-error); font-weight: bold; text-decoration: underline wavy; }

	.result-row { transition: background-color 120ms ease, box-shadow 120ms ease, filter 120ms ease; }
	.result-active { background: color-mix(in oklab, var(--color-primary) 10%, transparent); }
	.result-hover { background: color-mix(in oklab, var(--color-primary) 24%, transparent); box-shadow: inset 3px 0 var(--color-primary); filter: brightness(1.15); }
	.result-error { background: color-mix(in oklab, var(--color-error) 16%, transparent); }
	.format-selected { background: color-mix(in oklab, var(--color-primary) 20%, transparent); color: var(--color-primary); font-weight: 700; }
	.matrix-result { width: max-content; padding-block: 0.125rem; }
	.matrix-bracket { width: 0.4rem; flex: 0 0 0.4rem; border-block: 2px solid currentColor; }
	.matrix-bracket-left { border-left: 2px solid currentColor; }
	.matrix-bracket-right { border-right: 2px solid currentColor; }
	:global(.cm-editor.cm-focused) { outline: none; }
	:global(.cm-cursor), :global(.cm-dropCursor) { border-left: 2px solid var(--color-primary) !important; }
	:global(.cm-selectionBackground) { background: color-mix(in oklab, var(--color-primary) 55%, transparent) !important; }
	:global(.cm-line-spacer-active) { background: color-mix(in oklab, var(--color-primary) 10%, transparent); }
	:global(.cm-line-spacer-hover) { background: color-mix(in oklab, var(--color-primary) 22%, transparent); box-shadow: inset 3px 0 var(--color-primary); }
	:global(.cm-line-spacer-error) { background: color-mix(in oklab, var(--color-error) 18%, transparent); box-shadow: inset 3px 0 var(--color-error); }
	:global(.cm-tooltip.cm-tooltip-autocomplete) { box-sizing: border-box; padding: 0.5rem; background: var(--color-base-200); color: var(--color-base-content); border: 1px solid var(--color-base-300); border-radius: var(--radius-box); box-shadow: 0 16px 40px rgb(0 0 0 / 0.45), 0 0 0 1px color-mix(in oklab, var(--color-primary) 8%, transparent); overflow: hidden; }
	:global(.cm-tooltip-autocomplete > ul) { box-sizing: border-box; min-width: 15rem; max-height: 15rem; height: auto; padding: 0; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
	:global(.cm-tooltip-autocomplete > ul > li) { min-height: 2rem; padding: 0.3rem 0.625rem; border-radius: calc(var(--radius-field) / 2); color: color-mix(in oklab, var(--color-base-content) 82%, transparent); }
	:global(.cm-tooltip-autocomplete > ul > li[aria-selected]) { background: color-mix(in oklab, var(--color-primary) 22%, var(--color-base-200)) !important; color: var(--color-base-content) !important; }
	:global(.cm-completionLabel) { font-weight: 600; }
	:global(.cm-completionMatchedText) { color: var(--color-primary); font-weight: 800; text-decoration: none; }
	:global(.cm-completionDetail) { color: color-mix(in oklab, var(--color-base-content) 48%, transparent); font-style: normal; margin-left: 1rem; }
	:global(.cm-completionIcon-function::after) { color: #a78bfa; }
	:global(.cm-completionIcon-variable::after) { color: #0ea5e9; }

	div::-webkit-scrollbar {
		display: none;
	}
	div {
		-ms-overflow-style: none;
		scrollbar-width: none;
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
