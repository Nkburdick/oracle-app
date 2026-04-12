import { sveltekit } from '@sveltejs/kit/vite';
import { SvelteKitPWA } from '@vite-pwa/sveltekit';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vitest/config';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8')) as {
	version: string;
};

export default defineConfig({
	plugins: [
		tailwindcss(),
		sveltekit(),
		SvelteKitPWA({
			srcDir: 'src',
			strategies: 'injectManifest',
			registerType: 'prompt',
			injectManifest: {
				globPatterns: ['client/**/*.{js,css,ico,png,svg,webp,woff,woff2}']
			},
			manifest: {
				name: 'Oracle — Personal Operations',
				short_name: 'Oracle',
				description: 'Personal operations system powered by Alfred',
				start_url: '/',
				scope: '/',
				display: 'standalone',
				background_color: '#0D0F11',
				theme_color: '#0D0F11',
				id: '/',
				icons: [
					{ src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
					{ src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
					{ src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
				]
			},
			devOptions: {
				enabled: false
			}
		})
	],
	define: {
		__APP_VERSION__: JSON.stringify(pkg.version)
	},
	server: {
		fs: {
			allow: ['..']
		}
	},
	resolve: {
		// Under Vitest, force the browser resolve condition so Svelte 5's
		// `mount()` (used by @testing-library/svelte) is available. Without
		// this, Svelte resolves to its server entry and component tests fail
		// with "mount(...) is not available on the server".
		conditions: process.env.VITEST ? ['browser'] : []
	},
	test: {
		// Match unit tests under tests/unit/ AND component tests colocated with
		// the components they cover (.svelte.test.ts convention).
		include: ['src/**/*.test.ts', 'tests/unit/**/*.test.ts'],
		// Default to node environment; component tests opt into jsdom via the
		// `// @vitest-environment jsdom` file-level directive at the top of the
		// test file.
		environment: 'node',
		// Setup file loaded for every test — registers @testing-library/jest-dom
		// matchers like `toBeInTheDocument`, `toBeDisabled`, `toHaveTextContent`.
		// Importing the matchers is a no-op in node-environment tests; they only
		// activate when expect() is called against a DOM node.
		setupFiles: ['./tests/setup-jsdom.ts']
	}
});
