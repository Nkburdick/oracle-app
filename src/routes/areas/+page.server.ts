import type { PageServerLoad } from './$types.js';
import { readAllAreas } from '$lib/server/oracle-reader.js';

export const load: PageServerLoad = async () => {
	const areas = await readAllAreas();
	return { areas };
};
