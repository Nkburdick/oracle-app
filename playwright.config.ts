import type { PlaywrightTestConfig } from '@playwright/test';
import { devices } from '@playwright/test';

const config: PlaywrightTestConfig = {
	webServer: {
		command: 'ORACLE_DATA_PATH=../tests/fixtures bun run preview',
		port: 4173,
		reuseExistingServer: !process.env.CI,
		timeout: 60000
	},
	testDir: 'tests/e2e',
	use: {
		baseURL: 'http://localhost:4173'
	},
	projects: [
		{
			name: 'chromium',
			use: { browserName: 'chromium' }
		},
		{
			name: 'mobile-webkit-iphone15pro',
			use: {
				...devices['iPhone 15 Pro']
			}
		}
	]
};

export default config;
