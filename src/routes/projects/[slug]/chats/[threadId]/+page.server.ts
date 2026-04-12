/**
 * Phase 2.B.4 — Mobile Active Thread loader.
 *
 * Loads the project, the specific thread, and its messages from Pennyworth.
 * This route is mobile-only at runtime: the +page.svelte redirects desktop
 * viewports back to /projects/[slug] on mount. However the loader runs
 * server-side regardless of viewport, so it must always validate the thread.
 *
 * Redirect behaviour:
 *   - Project not found → 404
 *   - Pennyworth unconfigured → redirect to /projects/[slug]
 *   - Thread not found (deleted, wrong ID) → redirect to /projects/[slug]
 *   - Messages fetch failure → render page with empty messages (graceful)
 */
import type { PageServerLoad } from './$types.js';
import { readProject } from '$lib/server/oracle-reader.js';
import { getPennyworthBaseUrl, listThreads, getMessages } from '$lib/server/pennyworth-client.js';
import type { Thread, Message } from '$lib/types/chat.js';
import { error, redirect } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ params, depends }) => {
	depends(`oracle:project:${params.slug}`);

	const project = await readProject(params.slug);
	if (!project) {
		error(404, `Project "${params.slug}" not found`);
	}

	// If Pennyworth is unconfigured, bounce to the thread list.
	let baseUrl: string;
	try {
		baseUrl = getPennyworthBaseUrl();
	} catch {
		redirect(302, `/projects/${params.slug}`);
	}

	// Load all threads for this project (needed to validate the threadId and
	// to allow the client to navigate back with a full list if desired).
	let threads: Thread[];
	try {
		threads = await listThreads(baseUrl, params.slug, { includeEphemeral: true });
	} catch {
		// Pennyworth unreachable — can't validate the thread, bounce to list.
		redirect(302, `/projects/${params.slug}`);
	}

	// AC-56: invalid/deleted thread ID redirects to thread list.
	const thread = threads.find((t) => t.id === params.threadId);
	if (!thread) {
		redirect(302, `/projects/${params.slug}`);
	}

	// Load messages — graceful degradation if this fails (page renders empty).
	let messages: Message[] = [];
	try {
		messages = await getMessages(baseUrl, params.threadId);
	} catch (err) {
		console.error(
			`[oracle-app] Failed to load messages for thread ${params.threadId}:`,
			(err as Error).message
		);
	}

	return { project, thread, threads, messages };
};
