import type { LayoutServerLoad } from './$types.js';
import { readAllProjects, readAllAreas } from '$lib/server/oracle-reader.js';

export const load: LayoutServerLoad = async ({ depends }) => {
	// Register dependencies so SSE-driven invalidate('oracle:projects' | 'oracle:areas')
	// re-runs this loader and refreshes the sidebar live.
	depends('oracle:projects');
	depends('oracle:areas');
	const [projects, areas] = await Promise.all([readAllProjects(), readAllAreas()]);
	return { projects, areas };
};
