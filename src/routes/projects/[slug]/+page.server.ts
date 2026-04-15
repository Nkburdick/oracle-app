import type { PageServerLoad } from './$types.js';
import { getPennyworthBaseUrl, listThreads, getMessages } from '$lib/server/pennyworth-client.js';
import type { ChatLoaderData } from '$lib/types/chat.js';

/**
 * Load chat threads for the project (Phase 2.B Minimal Chat — read path).
 *
 * Project data is provided by the parent layout load (+layout.server.ts).
 * Calling parent() here ensures this load re-runs whenever the layout
 * re-runs (e.g. on oracle:project invalidation from SSE events).
 *
 * The chat fetch is wrapped in a try/catch so a Pennyworth outage degrades
 * to an inline error state inside the Chats tab WITHOUT breaking the rest of
 * the project page (PRD §6.7, AC-35).
 */
export const load: PageServerLoad = async ({ params, parent }) => {
	await parent();
	const chat: ChatLoaderData = await loadChatForProject(params.slug);
	return { chat };
};

/**
 * Best-effort fetch of threads + most-recent thread's messages from Pennyworth.
 * Catches every failure mode and returns a structured error so the page still
 * renders.
 */
async function loadChatForProject(slug: string): Promise<ChatLoaderData> {
	let baseUrl: string;
	try {
		baseUrl = getPennyworthBaseUrl();
	} catch (err) {
		// PENNYWORTH_BASE_URL not set — chat is unconfigured. Don't crash the page.
		return {
			threads: [],
			initialMessages: [],
			error: (err as Error).message
		};
	}

	try {
		const threads = await listThreads(baseUrl, slug, { includeEphemeral: true });
		if (threads.length === 0) {
			return { threads: [], initialMessages: [], error: null };
		}

		// Auto-select most-recent thread per Q8 = (a) — fetch its messages too
		// so the right pane is populated on first paint with no spinner.
		const initialMessages = await getMessages(baseUrl, threads[0].id);
		return { threads, initialMessages, error: null };
	} catch (err) {
		console.error('[oracle-app] Pennyworth chat fetch failed:', (err as Error).message);
		return {
			threads: [],
			initialMessages: [],
			error: (err as Error).message
		};
	}
}
