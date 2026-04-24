import type { LayoutServerLoad } from './$types.js';
import { redirect } from '@sveltejs/kit';
import { readAllProjects, readAllAreas } from '$lib/server/oracle-reader.js';
import { COOKIE_NAME, validateSessionToken } from '$lib/server/auth.js';

export const load: LayoutServerLoad = async ({ depends, cookies, url }) => {
	// Auth check — redirect to /login if not authenticated
	// (replaces hooks.server.ts which is incompatible with SvelteKit + Vite 7 PWA builds)
	const publicPaths = ['/login'];
	if (!publicPaths.some((p) => url.pathname === p || url.pathname.startsWith(p + '/'))) {
		const token = cookies.get(COOKIE_NAME);
		if (!token) {
			throw redirect(303, '/login');
		}
		const username = validateSessionToken(token);
		if (!username) {
			cookies.delete(COOKIE_NAME, { path: '/' });
			throw redirect(303, '/login');
		}
	}

	// Skip sidebar data for public pages (login doesn't need it)
	if (publicPaths.some((p) => url.pathname === p || url.pathname.startsWith(p + '/'))) {
		return { projects: [], areas: [] };
	}

	// Register dependencies so SSE-driven invalidate('oracle:projects' | 'oracle:areas')
	// re-runs this loader and refreshes the sidebar live.
	depends('oracle:projects');
	depends('oracle:areas');
	const [projects, areas] = await Promise.all([readAllProjects(), readAllAreas()]);
	return { projects, areas };
};
