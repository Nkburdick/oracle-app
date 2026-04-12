import type { PageServerLoad } from './$types.js';
import { readAllProjects } from '$lib/server/oracle-reader.js';

export const load: PageServerLoad = async () => {
	const projects = await readAllProjects();
	return { projects };
};
