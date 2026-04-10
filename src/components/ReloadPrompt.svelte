<script lang="ts">
	import { onMount } from "svelte"
	import { registerSW } from "virtual:pwa-register"

	let needRefresh = false
	let offlineReady = false
	let updateServiceWorker: (reloadPage?: boolean) => Promise<void>

	const close = () => {
		offlineReady = false
		needRefresh = false
	}

	onMount(() => {
		updateServiceWorker = registerSW({
			immediate: true,
			onNeedRefresh() {
				// Shows the prompt when a new SW is waiting
				needRefresh = true
			},
			onOfflineReady() {
				// Optional: Show a message when app is ready for offline use
				offlineReady = true
				setTimeout(() => {
					offlineReady = false
				}, 3000) // Auto-hide offline msg
			},
		})
	})
</script>

{#if needRefresh || offlineReady}
	<div class="toast toast-end toast-bottom z-50">
		{#if offlineReady}
			<div class="alert alert-success text-white shadow-lg">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="h-6 w-6 stroke-current shrink-0"
					fill="none"
					viewBox="0 0 24 24"
					><path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
					/></svg
				>
				<span>App is ready for offline use.</span>
			</div>
		{/if}

		{#if needRefresh}
			<div
				class="alert alert-info text-white shadow-lg flex flex-row gap-4"
				role="alert"
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					fill="none"
					viewBox="0 0 24 24"
					class="h-6 w-6 stroke-current shrink-0"
					><path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
					></path></svg
				>
				<div class="flex flex-col">
					<span class="font-bold">New version available!</span>
					<span class="text-xs">Click reload to update.</span>
				</div>

				<div class="flex gap-2">
					<button class="btn btn-sm btn-ghost" on:click={close}>
						Close
					</button>
					<button
						class="btn btn-sm btn-primary border-white text-white hover:bg-primary-focus hover:border-white"
						on:click={() => updateServiceWorker(true)}
					>
						Reload
					</button>
				</div>
			</div>
		{/if}
	</div>
{/if}
