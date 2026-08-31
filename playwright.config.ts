import { defineConfig } from "@playwright/test";

export default defineConfig({
	testDir: "./e2e",
	use: { baseURL: "http://127.0.0.1:4321/calcuko/" },
	webServer: {
		command: "npm run build && npm run preview -- --host 127.0.0.1",
		url: "http://127.0.0.1:4321/calcuko/",
		reuseExistingServer: false,
		timeout: 120_000,
		env: { ASTRO_TELEMETRY_DISABLED: "1" },
	},
});
