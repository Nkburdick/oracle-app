import type { PageServerLoad } from './$types.js';
import { readArea } from '$lib/server/oracle-reader.js';
import { getPennyworthBaseUrl, listThreads, getMessages } from '$lib/server/pennyworth-client.js';
import type { ChatLoaderData } from '$lib/types/chat.js';
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ params, depends }) => {
	depends(`oracle:area:${params.slug}`);
	const area = await readArea(params.slug);
	if (!area) {
		error(404, `Area "${params.slug}" not found`);
	}

	const chat: ChatLoaderData = await loadChatForArea(params.slug);

	return { area, chat };
};

async function loadChatForArea(slug: string): Promise<ChatLoaderData> {
	let baseUrl: string;
	try {
		baseUrl = getPennyworthBaseUrl();
	} catch (err) {
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

		const initialMessages = await getMessages(baseUrl, threads[0].id);
		return { threads, initialMessages, error: null };
	} catch (err) {
		console.error('[oracle-app] Pennyworth chat fetch for area failed:', (err as Error).message);
		return {
			threads: [],
			initialMessages: [],
			error: (err as Error).message
		};
	}
}
