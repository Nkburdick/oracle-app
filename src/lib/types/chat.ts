/**
 * Phase 2.B chat types — mirror Pennyworth's `conversations` and `messages`
 * SQLite tables but use camelCase keys (Pennyworth's API already returns
 * camelCase via Drizzle's column-name aliasing).
 *
 * See `app/docs/PHASE_2B_MINIMAL_CHAT_PRD.md` §3 for the API surface and
 * `~/Code/Pennyworth/src/db/schema.ts` for the canonical column shapes.
 */

/** A chat thread (Pennyworth `conversations` row). */
export interface Thread {
	id: string;
	title: string;
	oracleSlug: string | null;
	isEphemeral: boolean;
	/** ISO-8601 string from Pennyworth's JSON serializer */
	createdAt: string;
	/** ISO-8601 string from Pennyworth's JSON serializer */
	updatedAt: string;
}

/** A chat message (Pennyworth `messages` row). */
export interface Message {
	id: string;
	conversationId: string;
	role: 'user' | 'assistant' | 'system';
	content: string;
	/** ISO-8601 string from Pennyworth's JSON serializer */
	createdAt: string;
}

/**
 * What the project page loader returns under the `chat` key. Always returns
 * arrays (never undefined) so the component never has to null-check, and
 * `error` is non-null only when Pennyworth was unreachable so the rest of the
 * project page still renders normally (PRD §6.7, AC-35).
 */
export interface ChatLoaderData {
	threads: Thread[];
	initialMessages: Message[];
	/** Non-null when Pennyworth fetch failed; render the error state in §6.1 */
	error: string | null;
}

/** Body shape for `POST /api/conversations` on Pennyworth. */
export interface CreateThreadBody {
	title?: string;
	oracleSlug?: string;
	isEphemeral?: boolean;
}

/** Body shape for `PATCH /api/conversations/:id` on Pennyworth. */
export interface PatchThreadBody {
	title?: string;
	isEphemeral?: boolean;
}

/** Body shape for `POST /api/chat` on Pennyworth. */
export interface SendMessageBody {
	message: string;
	conversationId: string;
	oracleSlug?: string;
}

/** Successful response from `POST /api/chat`. */
export interface SendMessageResponse {
	response: string;
	conversationId: string;
	/** Opaque artifacts payload — ignored in minimal chat (Phase 2.B.3 reads it) */
	artifacts: unknown;
}
