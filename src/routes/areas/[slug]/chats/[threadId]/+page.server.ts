/**
 * Mobile Active Thread loader for areas.
 * Identical to the projects version but reads an area instead.
 */
import type { PageServerLoad } from './$types.js';
import { readArea } from '$lib/server/oracle-reader.js';
import { getPennyworthBaseUrl, listThreads, getMessages } from '$lib/server/pennyworth-client.js';
import type { Thread, Message } from '$lib/types/chat.js';
import { error, redirect } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ params, depends }) => {
	depends(`oracle:area:${params.slug}`);

	const area = await readArea(params.slug);
	if (!area) {
		error(404, `Area "${params.slug}" not found`);
	}

	let baseUrl: string;
	try {
		baseUrl = getPennyworthBaseUrl();
	} catch {
		redirect(302, `/areas/${params.slug}`);
	}

	let threads: Thread[];
	try {
		threads = await listThreads(baseUrl, params.slug, { includeEphemeral: true });
	} catch {
		redirect(302, `/areas/${params.slug}`);
	}

	const thread = threads.find((t) => t.id === params.threadId);
	if (!thread) {
		redirect(302, `/areas/${params.slug}`);
	}

	let messages: Message[] = [];
	try {
		messages = await getMessages(baseUrl, params.threadId);
	} catch (err) {
		console.error(
			`[oracle-app] Failed to load messages for area thread ${params.threadId}:`,
			(err as Error).message
		);
	}

	return { area, thread, threads, messages };
};
