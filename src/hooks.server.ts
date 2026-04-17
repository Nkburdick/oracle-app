import type { Handle } from '@sveltejs/kit';

/**
 * Security headers middleware.
 *
 * Adds Content-Security-Policy and other hardening headers to every response.
 * Auth is handled in +layout.server.ts (not here) due to Vite 7 PWA build
 * compatibility — see that file's comment.
 *
 * CSP policy rationale:
 * - script-src 'self': only our own bundled scripts, no inline (Svelte 5 doesn't need it)
 * - style-src 'self' 'unsafe-inline': Svelte uses inline styles for transitions/animations
 * - img-src 'self' data:: app uses data: URIs for SVG checkbox icons in CSS
 * - connect-src 'self' https://*.push.services.mozilla.com https://fcm.googleapis.com
 *   https://*.notify.windows.com: same-origin API + SSE, plus Web Push service endpoints
 * - worker-src 'self': service worker for PWA
 * - manifest-src 'self': PWA manifest
 * - frame-ancestors 'none': prevent clickjacking (equivalent to X-Frame-Options DENY)
 * - base-uri 'self': prevent base tag hijacking
 * - form-action 'self': restrict form submissions to same origin
 */

const CSP_DIRECTIVES = [
	"default-src 'self'",
	"script-src 'self'",
	"style-src 'self' 'unsafe-inline'",
	"img-src 'self' data:",
	"font-src 'self'",
	"connect-src 'self' https://*.push.services.mozilla.com https://fcm.googleapis.com https://*.notify.windows.com",
	"worker-src 'self'",
	"manifest-src 'self'",
	"frame-ancestors 'none'",
	"base-uri 'self'",
	"form-action 'self'"
].join('; ');

export const handle: Handle = async ({ event, resolve }) => {
	const response = await resolve(event);

	response.headers.set('Content-Security-Policy', CSP_DIRECTIVES);
	response.headers.set('X-Content-Type-Options', 'nosniff');
	response.headers.set('X-Frame-Options', 'DENY');
	response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
	response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

	return response;
};
