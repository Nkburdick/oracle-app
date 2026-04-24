import type { LayoutServerLoad } from './$types.js';
import { redirect } from '@sveltejs/kit';
import { readAllProjects, readAllAreas } from '$lib/server/oracle-reader.js';
import { COOKIE_NAME, validateSessionToken } from '$lib/server/auth.js';

/**
 * User-Agent based mobile detection. Used to render the correct chat layout
 * at SSR time so we don't depend on client-side $effect / onMount which is
 * unreliable in the iOS standalone PWA (see feedback_ios_pwa_hydration.md).
 *
 * Conservative match: only flip to `true` when the UA clearly indicates a
 * mobile device. Tablets (iPad, Android tablets) stay on desktop layout —
 * that matches the prior matchMedia('(max-width: 767px)') behavior.
 */
function detectMobileFromUA(userAgent: string): boolean {
	if (!userAgent) return false;
	return /iPhone|iPod|Android.*Mobile|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
}

export const load: LayoutServerLoad = async ({ depends, cookies, url, request }) => {
	const isMobile = detectMobileFromUA(request.headers.get('user-agent') ?? '');

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
		return { projects: [], areas: [], isMobile };
	}

	// Register dependencies so SSE-driven invalidate('oracle:projects' | 'oracle:areas')
	// re-runs this loader and refreshes the sidebar live.
	depends('oracle:projects');
	depends('oracle:areas');
	const [projects, areas] = await Promise.all([readAllProjects(), readAllAreas()]);
	return { projects, areas, isMobile };
};
