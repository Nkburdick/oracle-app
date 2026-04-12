import type { PageServerLoad } from './$types.js';
import { readDashboardCards } from '$lib/server/oracle-reader.js';

export const load: PageServerLoad = async ({ depends }) => {
	// Register dependency so SSE-driven invalidate('oracle:projects') re-runs this loader
	// and refreshes the dashboard cards live when PROJECT.md files change.
	depends('oracle:projects');
	const projects = await readDashboardCards();
	return { projects };
};
