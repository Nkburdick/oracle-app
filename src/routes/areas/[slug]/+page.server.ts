import type { PageServerLoad } from './$types.js';
import { readArea } from '$lib/server/oracle-reader.js';
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ params, depends }) => {
	depends(`oracle:area:${params.slug}`);
	const area = await readArea(params.slug);
	if (!area) {
		error(404, `Area "${params.slug}" not found`);
	}

	return { area };
};
