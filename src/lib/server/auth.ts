import { env } from '$env/dynamic/private';
import { createHmac } from 'crypto';

const COOKIE_NAME = 'oracle_session';
const MAX_AGE_SECONDS = 30 * 24 * 60 * 60; // 30 days

function getSecret(): string {
	const secret = env.ORACLE_AUTH_SECRET;
	if (!secret) throw new Error('ORACLE_AUTH_SECRET is not set');
	return secret;
}

function sign(payload: string): string {
	return createHmac('sha256', getSecret()).update(payload).digest('hex');
}

/** Validate credentials against environment variables. */
export function validateCredentials(username: string, password: string): boolean {
	const expectedUser = env.ORACLE_AUTH_USERNAME;
	const expectedPass = env.ORACLE_AUTH_PASSWORD;
	if (!expectedUser || !expectedPass) return false;
	return username === expectedUser && password === expectedPass;
}

/** Create a signed session cookie value. */
export function createSessionToken(username: string): string {
	const ts = Date.now().toString();
	const sig = sign(`${username}:${ts}`);
	return `${username}:${ts}:${sig}`;
}

/** Validate a session cookie value. Returns the username or null. */
export function validateSessionToken(token: string): string | null {
	const parts = token.split(':');
	if (parts.length !== 3) return null;
	const [username, ts, sig] = parts;
	const expected = sign(`${username}:${ts}`);
	if (sig !== expected) return null;

	// Check expiry
	const created = parseInt(ts, 10);
	if (isNaN(created)) return null;
	if (Date.now() - created > MAX_AGE_SECONDS * 1000) return null;

	return username;
}

export { COOKIE_NAME, MAX_AGE_SECONDS };
