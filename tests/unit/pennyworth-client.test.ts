/**
 * Unit tests for $lib/server/pennyworth-client.ts
 *
 * Covers the two surviving exports (env helpers) after the chat UI removal —
 * `getPennyworthBaseUrl` and `getPennyworthApiToken`. Chat-side helpers and
 * their tests were retired when the in-app chat panel was removed.
 */

import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import {
	getPennyworthBaseUrl,
	getPennyworthApiToken
} from '../../src/lib/server/pennyworth-client.js';

const SAMPLE_BASE_URL = 'http://pennyworth:3000';
const SAMPLE_API_TOKEN = 'test-token-xyz';

const ORIGINAL_BASE_URL = process.env.PENNYWORTH_BASE_URL;
const ORIGINAL_API_TOKEN = process.env.PENNYWORTH_API_TOKEN;

beforeEach(() => {
	process.env.PENNYWORTH_BASE_URL = SAMPLE_BASE_URL;
	process.env.PENNYWORTH_API_TOKEN = SAMPLE_API_TOKEN;
});

afterEach(() => {
	if (ORIGINAL_BASE_URL === undefined) {
		delete process.env.PENNYWORTH_BASE_URL;
	} else {
		process.env.PENNYWORTH_BASE_URL = ORIGINAL_BASE_URL;
	}
	if (ORIGINAL_API_TOKEN === undefined) {
		delete process.env.PENNYWORTH_API_TOKEN;
	} else {
		process.env.PENNYWORTH_API_TOKEN = ORIGINAL_API_TOKEN;
	}
});

describe('getPennyworthBaseUrl', () => {
	test('returns the env var value', () => {
		expect(getPennyworthBaseUrl()).toBe(SAMPLE_BASE_URL);
	});

	test('strips trailing slash', () => {
		process.env.PENNYWORTH_BASE_URL = 'http://pennyworth:3001/';
		expect(getPennyworthBaseUrl()).toBe('http://pennyworth:3001');
	});

	test('throws when env var is missing', () => {
		delete process.env.PENNYWORTH_BASE_URL;
		expect(() => getPennyworthBaseUrl()).toThrow(/PENNYWORTH_BASE_URL is not set/);
	});

	test('throws when env var is empty string', () => {
		process.env.PENNYWORTH_BASE_URL = '   ';
		expect(() => getPennyworthBaseUrl()).toThrow(/PENNYWORTH_BASE_URL is not set/);
	});
});

describe('getPennyworthApiToken', () => {
	test('returns the env var value', () => {
		expect(getPennyworthApiToken()).toBe(SAMPLE_API_TOKEN);
	});

	test('throws when env var is missing', () => {
		delete process.env.PENNYWORTH_API_TOKEN;
		expect(() => getPennyworthApiToken()).toThrow(/PENNYWORTH_API_TOKEN is not set/);
	});

	test('throws when env var is empty string', () => {
		process.env.PENNYWORTH_API_TOKEN = '   ';
		expect(() => getPennyworthApiToken()).toThrow(/PENNYWORTH_API_TOKEN is not set/);
	});
});
