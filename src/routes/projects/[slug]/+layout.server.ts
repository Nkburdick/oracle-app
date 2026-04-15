import type { LayoutServerLoad } from './$types.js';
import { readProject } from '$lib/server/oracle-reader.js';
import { error } from '@sveltejs/kit';

export const load: LayoutServerLoad = async ({ params, depends }) => {
	depends(`oracle:project:${params.slug}`);
	const project = await readProject(params.slug);
	if (!project) {
		error(404, `Project "${params.slug}" not found`);
	}
	return { project };
};
