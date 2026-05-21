import type { PageServerLoad } from './$types.js';
import { readAllProjects } from '$lib/server/oracle-reader.js';

export const load: PageServerLoad = async () => {
	const all = await readAllProjects();
	const projects = all.filter((p) => p.state !== 'completed');
	const archived = all.filter((p) => p.state === 'completed');
	return { projects, archived };
};
