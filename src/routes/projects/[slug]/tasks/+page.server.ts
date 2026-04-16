import type { PageServerLoad } from './$types.js';
import { readProject, readProjectTasks } from '$lib/server/oracle-reader.js';
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ params, depends }) => {
	depends(`oracle:tasks:${params.slug}`);
	const project = await readProject(params.slug);
	if (!project) {
		error(404, `Project "${params.slug}" not found`);
	}
	const tasks = await readProjectTasks(params.slug);
	return { project, tasks };
};
