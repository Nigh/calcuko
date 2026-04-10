<script lang="ts">
	const sampleFormula = `Vo = 13
Vref = 2.5
R1 = 11
R2 = 2.87
R3 = 10

a = Vref / (Vo - Vref) * R1
Rt = a * R2 / (R2 - a) - R3`;

	const storageKey = "calcuko-formulas";

	type LineResult = {
		type: "empty" | "success" | "error";
		text: string;
	};

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
	let resultsPanel: HTMLDivElement | undefined;
	let variableSnapshot: Record<string, unknown> = {};
	let lineResults: LineResult[] = [];
	let lines: string[] = [];

	function formatValue(value: unknown) {
		if (typeof value === "number") {
			if (Number.isNaN(value)) return "NaN";
			if (!Number.isFinite(value)) return String(value);
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
			const line = rawLine.trim();

			if (!line) {
				nextLineResults.push({ type: "empty", text: "" });
				continue;
			}

			const match = line.match(/^([A-Za-z_$][\w$]*)\s*=\s*(.+)$/);

			if (!match) {
				nextLineResults.push({
					type: "error",
					text: "语法应为：变量 = 表达式",
				});
				continue;
			}

			const [, name, expression] = match;

			try {
				const evaluator = new Function(
					"scope",
					`with (scope) { return (${expression}); }`,
				) as (scope: Record<string, unknown>) => unknown;

				const value = evaluator(scope);
				scope[name] = value;
				nextSnapshot[name] = value;
				nextLineResults.push({ type: "success", text: formatValue(value) });
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
	}

	function handleScroll() {
		if (!textarea) return;
		if (lineNumbers) lineNumbers.scrollTop = textarea.scrollTop;
		if (resultsPanel) resultsPanel.scrollTop = textarea.scrollTop;
	}

	function resetSample() {
		source = sampleFormula;
		localStorage.setItem(storageKey, source);
		queueMicrotask(handleScroll);
	}

	if (typeof localStorage !== "undefined") {
		source = localStorage.getItem(storageKey) || sampleFormula;
	}
</script>

<div class="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 px-4 py-6 md:px-6 lg:py-10">
	<section class="hero rounded-box border border-base-300 bg-base-200 p-6 shadow-sm">
		<div class="hero-content w-full justify-between gap-6 max-md:flex-col max-md:items-start">
			<div>
				<p class="mb-2 text-sm font-semibold uppercase tracking-[0.2em] text-primary">Calcuko</p>
				<h1 class="text-3xl font-bold md:text-4xl">多行变量公式计算器</h1>
				<p class="mt-3 max-w-2xl text-base-content/70">
					按行编写 <code>变量 = 表达式</code>，右侧会实时显示每一行的结果；修改任意一行后，后续依赖它的结果会自动重新计算。
				</p>
			</div>
			<button class="btn btn-primary" type="button" on:click={resetSample}>恢复示例</button>
		</div>
	</section>

	<section class="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
		<div class="card border border-base-300 bg-base-100 shadow-sm">
			<div class="card-body gap-4 p-0">
				<div class="flex items-center justify-between border-b border-base-300 px-5 py-4">
					<div>
						<h2 class="text-lg font-semibold">公式编辑器</h2>
						<p class="text-sm text-base-content/60">支持空行、变量引用和常用数学函数</p>
					</div>
					<div class="badge badge-outline">实时计算</div>
				</div>

				<div class="grid min-h-[420px] grid-cols-[56px_minmax(0,1fr)_minmax(140px,220px)] overflow-hidden font-mono text-sm">
					<div bind:this={lineNumbers} class="overflow-hidden border-r border-base-300 bg-base-200/60 px-3 py-4 text-right text-base-content/45">
						{#each lines as _, index}
							<div class="h-7 leading-7">{index + 1}</div>
						{/each}
					</div>

					<textarea
						bind:this={textarea}
						bind:value={source}
						class="min-h-[420px] resize-none overflow-auto border-none bg-transparent px-4 py-4 leading-7 outline-none"
						placeholder="例如：&#10;a = 12&#10;b = a * 3&#10;c = sqrt(b)"
						spellcheck="false"
						on:input={handleInput}
						on:scroll={handleScroll}
					></textarea>

					<div bind:this={resultsPanel} class="overflow-hidden border-l border-base-300 bg-base-200/30 px-4 py-4">
						{#each lineResults as item}
							<div class:text-error={item.type === 'error'} class:text-success={item.type === 'success'} class="h-7 overflow-hidden text-ellipsis whitespace-nowrap leading-7">
								{item.text || ' '}
							</div>
						{/each}
					</div>
				</div>
			</div>
		</div>

		<div class="flex flex-col gap-6">
			<div class="card border border-base-300 bg-base-100 shadow-sm">
				<div class="card-body">
					<h2 class="card-title text-lg">变量快照</h2>
					<pre class="max-h-[280px] overflow-auto rounded-box bg-base-200 p-4 text-sm">{JSON.stringify(variableSnapshot, null, 2)}</pre>
				</div>
			</div>

			<div class="card border border-base-300 bg-base-100 shadow-sm">
				<div class="card-body">
					<h2 class="card-title text-lg">使用说明</h2>
					<ul class="list-disc space-y-2 pl-5 text-sm text-base-content/75">
						<li>每行格式固定为：<code>变量 = 表达式</code></li>
						<li>后续行可以直接引用前面已经计算成功的变量</li>
						<li>修改任意一行后，整个公式链会重新计算</li>
						<li>内置 <code>sin</code>、<code>cos</code>、<code>sqrt</code>、<code>pow</code>、<code>PI</code>、<code>E</code> 等</li>
					</ul>
				</div>
			</div>
		</div>
	</section>
</div>
