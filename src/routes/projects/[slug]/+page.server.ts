import type { PageServerLoad } from './$types.js';
import { readProject } from '$lib/server/oracle-reader.js';
import { getPennyworthBaseUrl, listThreads, getMessages } from '$lib/server/pennyworth-client.js';
import type { ChatLoaderData } from '$lib/types/chat.js';
import { error } from '@sveltejs/kit';

/**
 * Load the project plus its chat threads (Phase 2.B Minimal Chat — read path).
 *
 * The chat fetch is wrapped in a try/catch so a Pennyworth outage degrades to
 * an inline error state inside the Chats tab WITHOUT breaking the rest of the
 * project page (PRD §6.7, AC-35). The loader always returns a `chat` key with
 * arrays — never undefined — so the component can be authored without null
 * checks.
 */
export const load: PageServerLoad = async ({ params, depends }) => {
	depends(`oracle:project:${params.slug}`);
	const project = await readProject(params.slug);
	if (!project) {
		error(404, `Project "${params.slug}" not found`);
	}

	const chat: ChatLoaderData = await loadChatForProject(params.slug);

	return { project, chat };
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
