import type { LayoutServerLoad } from './$types.js';
import {
	readProject,
	readProjectStatus,
	readProjectDecisions
} from '$lib/server/oracle-reader.js';
import { error } from '@sveltejs/kit';

export const load: LayoutServerLoad = async ({ params, depends }) => {
	depends(`oracle:project:${params.slug}`);
	const [project, status, decisions] = await Promise.all([
		readProject(params.slug),
		readProjectStatus(params.slug),
		readProjectDecisions(params.slug)
	]);
	if (!project) {
		error(404, `Project "${params.slug}" not found`);
	}
	// status and decisions are nullable — most projects don't have them yet.
	// Adoption of the 4-tier doc framework is staged per project.
	return { project, status, decisions };
};
