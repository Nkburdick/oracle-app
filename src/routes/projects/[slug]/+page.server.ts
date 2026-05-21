import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types.js';

export const load: PageServerLoad = async ({ params, url }) => {
	// Bare /projects/[slug] redirects to the Tasks sub-route — that's the
	// landing tab. Other tabs are reached via ?view= and skip this redirect.
	if (!url.searchParams.has('view')) {
		throw redirect(307, `/projects/${params.slug}/tasks`);
	}
	return {};
};
